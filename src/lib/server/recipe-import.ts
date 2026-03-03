import type { DisplayUnit } from '$lib/scaling';

const MODEL = 'gpt-4.1-mini';

type ImportUnit = 'g' | 'ml' | 'tsp' | 'tbsp';

type ImportedIngredient = {
  name: string;
  amount_per_base: number;
  unit: ImportUnit;
  display_unit?: DisplayUnit;
};

type ImportedRecipeDraft = {
  title: string;
  description: string;
  tags: string[];
  base_meat_grams: number | null;
  base_animal: string;
  meat_description: string;
  meat_weight_basis: 'explicit' | 'estimated_from_description' | 'missing';
  meat_weight_note: string;
  cuts: string[];
  ingredients: ImportedIngredient[];
};

export type NormalizedImportedRecipe = {
  title: string;
  description: string;
  tags: string[];
  baseMeatGrams: number;
  baseAnimal: string;
  meatWeightBasis: 'explicit' | 'estimated_from_description';
  meatWeightNote: string;
  cuts: string[];
  ingredients: Array<{
    name: string;
    amountGramsPerBase: number | null;
    amountMlPerBase: number | null;
    displayUnitOverride: DisplayUnit | null;
  }>;
};

const ML_PER_TSP = 4.92892;

export async function importRecipeFromText(params: {
  apiKey: string;
  recipeText: string;
}): Promise<NormalizedImportedRecipe> {
  const detected = detectMeatWeightFromText(params.recipeText);
  const inferred = inferRecipeFieldsFromText(params.recipeText);

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      input: [
        {
          role: 'system',
          content:
            'You convert pasted cooking text into structured recipe ratio data for wild game. Return strict JSON only.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'Interpret this recipe text.',
                'Infer a canonical base recipe where ingredient amounts are per base meat amount.',
                'For ingredient amounts, prioritize explicit numeric quantities from the text (especially grams in lines like "X g -> Y tbsp").',
                'Do not invent or normalize ingredient amounts beyond what the text supports.',
                'Do NOT default base meat weight.',
                'If explicit meat weight is missing but there is a meat description (example: \"1 deer front leg\"), estimate grams as best as possible.',
                'If neither explicit weight nor a usable meat description exists, set meat_weight_basis to \"missing\" and base_meat_grams to null.',
                `Pre-detected meat signal: ${detected.baseMeatGrams ? `${detected.baseMeatGrams}g (${detected.note})` : 'none'}. Use this if consistent with the text.`,
                'Units allowed: g, ml, tsp, tbsp.',
                'Return cuts array and ingredients array.',
                'Recipe text:',
                params.recipeText
              ].join('\n')
            }
          ]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'recipe_import',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              tags: {
                type: 'array',
                items: { type: 'string' }
              },
              base_meat_grams: {
                anyOf: [{ type: 'number' }, { type: 'null' }]
              },
              base_animal: { type: 'string' },
              meat_description: { type: 'string' },
              meat_weight_basis: {
                type: 'string',
                enum: ['explicit', 'estimated_from_description', 'missing']
              },
              meat_weight_note: { type: 'string' },
              cuts: {
                type: 'array',
                items: { type: 'string' }
              },
              ingredients: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    name: { type: 'string' },
                    amount_per_base: { type: 'number' },
                    unit: { type: 'string', enum: ['g', 'ml', 'tsp', 'tbsp'] },
                    display_unit: {
                      anyOf: [
                        { type: 'string', enum: ['g', 'ml', 'tsp', 'tbsp'] },
                        { type: 'null' }
                      ]
                    }
                  },
                  required: ['name', 'amount_per_base', 'unit', 'display_unit']
                }
              }
            },
            required: [
              'title',
              'description',
              'tags',
              'base_meat_grams',
              'base_animal',
              'meat_description',
              'meat_weight_basis',
              'meat_weight_note',
              'cuts',
              'ingredients'
            ]
          }
        }
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI parse failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const rawJson = extractJsonTextFromResponse(payload);
  const parsed = safeParseRecipeDraft(rawJson);
  return normalizeDraft(parsed, detected, inferred);
}

function safeParseRecipeDraft(json: string): ImportedRecipeDraft {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    const start = json.indexOf('{');
    const end = json.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(json.slice(start, end + 1));
      } catch {
        throw new Error('AI returned invalid JSON');
      }
    } else {
      throw new Error('AI returned invalid JSON');
    }
  }

  if (!parsed || typeof parsed !== 'object') throw new Error('AI response is not an object');
  const obj = parsed as Record<string, unknown>;

  const ingredientsRaw = Array.isArray(obj.ingredients) ? obj.ingredients : [];
  const ingredients: ImportedIngredient[] = ingredientsRaw.map((row) => {
    const r = row as Record<string, unknown>;
    const unit = String(r.unit ?? '').toLowerCase() as ImportUnit;
    const displayUnitRaw = String(r.display_unit ?? '').toLowerCase();
    return {
      name: String(r.name ?? '').trim(),
      amount_per_base: Number(r.amount_per_base ?? 0),
      unit,
      display_unit: isDisplayUnit(displayUnitRaw) ? displayUnitRaw : undefined
    };
  });

  return {
    title: String(obj.title ?? '').trim(),
    description: String(obj.description ?? '').trim(),
    tags: toStringArray(obj.tags),
    base_meat_grams:
      obj.base_meat_grams === null || obj.base_meat_grams === undefined
        ? null
        : Number(obj.base_meat_grams),
    base_animal: String(obj.base_animal ?? '').trim(),
    meat_description: String(obj.meat_description ?? '').trim(),
    meat_weight_basis: toWeightBasis(obj.meat_weight_basis),
    meat_weight_note: String(obj.meat_weight_note ?? '').trim(),
    cuts: toStringArray(obj.cuts),
    ingredients
  };
}

function normalizeDraft(
  draft: ImportedRecipeDraft,
  detected: { baseMeatGrams: number | null; note: string; meatDescription: string },
  inferred: {
    title: string;
    description: string;
    tags: string[];
    baseAnimal: string;
    cuts: string[];
    ingredients: ImportedIngredient[];
  }
): NormalizedImportedRecipe {
  const title = draft.title || inferred.title || 'Imported Recipe';
  let basis = draft.meat_weight_basis;
  let hasDescription = Boolean(draft.meat_description);
  const baseMeatGrams =
    draft.base_meat_grams === null ? null : clampPositive(Math.round(draft.base_meat_grams), null);
  let resolvedBaseMeatGrams = baseMeatGrams;
  let resolvedNote = draft.meat_weight_note;

  // Deterministic fallback: explicit weight patterns from raw text should always win over model miss.
  if (resolvedBaseMeatGrams === null && detected.baseMeatGrams !== null) {
    resolvedBaseMeatGrams = detected.baseMeatGrams;
    basis = 'explicit';
    hasDescription = true;
    resolvedNote = `Detected from text: ${detected.note}`;
  }

  if (basis === 'missing' || resolvedBaseMeatGrams === null) {
    if (!hasDescription) {
      throw new Error(
        'Import failed: no meat weight or meat description found. Please include a weight (grams/lb) or a describable cut/portion.'
      );
    }
    throw new Error(
      'Import failed: could not estimate meat weight from the provided description. Please add an approximate weight.'
    );
  }

  const sourceIngredients = mergeImportedIngredients(draft.ingredients, inferred.ingredients);

  const ingredients = sourceIngredients
    .filter((item) => item.name && Number.isFinite(item.amount_per_base) && item.amount_per_base > 0)
    .map((item) => {
      if (item.unit === 'g') {
        return {
          name: item.name,
          amountGramsPerBase: item.amount_per_base,
          amountMlPerBase: null,
          displayUnitOverride: item.display_unit ?? null
        };
      }

      const ml = item.unit === 'ml' ? item.amount_per_base : item.unit === 'tsp' ? item.amount_per_base * ML_PER_TSP : item.amount_per_base * ML_PER_TSP * 3;

      return {
        name: item.name,
        amountGramsPerBase: null,
        amountMlPerBase: ml,
        displayUnitOverride: item.display_unit ?? null
      };
    });

  return {
    title,
    description: draft.description || inferred.description,
    tags: draft.tags.length > 0 ? draft.tags : inferred.tags,
    baseMeatGrams: resolvedBaseMeatGrams,
    baseAnimal: draft.base_animal || inferred.baseAnimal,
    meatWeightBasis: basis === 'estimated_from_description' ? 'estimated_from_description' : 'explicit',
    meatWeightNote: resolvedNote,
    cuts: (draft.cuts.length > 0 ? draft.cuts : inferred.cuts).filter(Boolean),
    ingredients
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

function clampPositive(value: number, fallback: number | null): number | null {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function isDisplayUnit(value: string): value is DisplayUnit {
  return value === 'g' || value === 'ml' || value === 'tsp' || value === 'tbsp';
}

function toWeightBasis(value: unknown): ImportedRecipeDraft['meat_weight_basis'] {
  const v = String(value ?? '').trim();
  if (v === 'explicit' || v === 'estimated_from_description' || v === 'missing') return v;
  return 'missing';
}

function normalizeIngredientKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bopt(?:ional)?\.?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mergeImportedIngredients(
  aiIngredients: ImportedIngredient[],
  detectedIngredients: ImportedIngredient[]
): ImportedIngredient[] {
  const detectedByKey = new Map<string, ImportedIngredient>();
  for (const item of detectedIngredients) {
    const key = normalizeIngredientKey(item.name);
    if (!key) continue;
    if (!detectedByKey.has(key)) detectedByKey.set(key, item);
  }

  const merged: ImportedIngredient[] = [];
  const seen = new Set<string>();

  for (const ai of aiIngredients) {
    const key = normalizeIngredientKey(ai.name);
    if (!key || seen.has(key)) continue;

    const detected = detectedByKey.get(key);
    if (detected) {
      merged.push({
        name: ai.name || detected.name,
        amount_per_base: detected.amount_per_base,
        unit: detected.unit,
        display_unit: detected.display_unit ?? ai.display_unit
      });
    } else {
      merged.push(ai);
    }
    seen.add(key);
  }

  for (const detected of detectedIngredients) {
    const key = normalizeIngredientKey(detected.name);
    if (!key || seen.has(key)) continue;
    merged.push(detected);
    seen.add(key);
  }

  if (merged.length > 0) return merged;
  return detectedIngredients.length > 0 ? detectedIngredients : aiIngredients;
}

function detectMeatWeightFromText(text: string): {
  baseMeatGrams: number | null;
  note: string;
  meatDescription: string;
} {
  const meatKeywords = [
    'venison',
    'deer',
    'elk',
    'moose',
    'antelope',
    'boar',
    'pork',
    'beef',
    'bison',
    'lamb',
    'goat',
    'turkey',
    'duck',
    'goose',
    'chicken',
    'pheasant',
    'rabbit',
    'leg',
    'shoulder',
    'loin',
    'backstrap',
    'fat'
  ];
  const nonMeatKeywords = ['cheddar', 'cheese', 'jalapeno', 'salt', 'pepper', 'paprika', 'garlic', 'onion'];

  const lines = text
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);

  let totalGrams = 0;
  const matched: string[] = [];

  for (const line of lines) {
    if (!meatKeywords.some((keyword) => line.includes(keyword))) continue;
    if (nonMeatKeywords.some((keyword) => line.includes(keyword))) continue;

    const pattern = /(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds|kg|g|gram|grams)\b/g;
    let m: RegExpExecArray | null = null;
    while ((m = pattern.exec(line)) !== null) {
      const value = Number(m[1]);
      const unit = m[2];
      if (!Number.isFinite(value) || value <= 0) continue;

      let grams = 0;
      if (unit.startsWith('lb') || unit.startsWith('pound')) grams = value * 453.59237;
      else if (unit === 'kg') grams = value * 1000;
      else grams = value;

      totalGrams += grams;
      matched.push(`${value} ${unit} (${line})`);
    }
  }

  if (totalGrams <= 0) {
    return { baseMeatGrams: null, note: '', meatDescription: '' };
  }

  return {
    baseMeatGrams: Math.round(totalGrams),
    note: matched.join('; '),
    meatDescription: matched.join('; ')
  };
}

function extractJsonTextFromResponse(payload: Record<string, unknown>): string {
  const direct = payload.output_text;
  if (typeof direct === 'string' && direct.trim()) return direct;

  const output = payload.output;
  if (Array.isArray(output)) {
    const chunks: string[] = [];
    for (const item of output) {
      if (!item || typeof item !== 'object') continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (!part || typeof part !== 'object') continue;
        const p = part as { type?: unknown; text?: unknown };
        if (p.type === 'output_text' && typeof p.text === 'string') chunks.push(p.text);
      }
    }
    const merged = chunks.join('\n').trim();
    if (merged) return merged;
  }

  return '{}';
}

function inferRecipeFieldsFromText(text: string): {
  title: string;
  description: string;
  tags: string[];
  baseAnimal: string;
  cuts: string[];
  ingredients: ImportedIngredient[];
} {
  const rawLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const titleCandidates = rawLines
    .filter((line) => !line.startsWith('*') && !line.startsWith('-'))
    .slice(0, 3);
  const title = titleCandidates.slice(0, 2).join(' - ') || 'Imported Recipe';

  const description = rawLines
    .find((line) => !line.startsWith('*') && !line.startsWith('-') && line !== titleCandidates[0])
    ?? '';

  const lower = text.toLowerCase();
  const baseAnimal = detectAnimal(lower);
  const cuts = detectCuts(lower);
  const tags = detectTags(lower, baseAnimal);
  const ingredients = detectIngredientsFromText(rawLines);

  return { title, description, tags, baseAnimal, cuts, ingredients };
}

function detectAnimal(lowerText: string): string {
  const animals = ['venison', 'deer', 'elk', 'moose', 'boar', 'turkey', 'duck', 'goose', 'rabbit'];
  const match = animals.find((animal) => lowerText.includes(animal));
  return match ?? '';
}

function detectCuts(lowerText: string): string[] {
  const cuts = ['backstrap', 'loin', 'shoulder', 'leg', 'hind quarter', 'front leg', 'tenderloin'];
  return cuts.filter((cut) => lowerText.includes(cut));
}

function detectTags(lowerText: string, baseAnimal: string): string[] {
  const tags = new Set<string>();
  if (baseAnimal) tags.add(baseAnimal);
  const keywords = ['sausage', 'smoked', 'grilled', 'jerky', 'spicy', 'cheddar', 'jalapeno'];
  for (const keyword of keywords) {
    if (lowerText.includes(keyword)) tags.add(keyword);
  }
  return Array.from(tags);
}

function detectIngredientsFromText(lines: string[]): ImportedIngredient[] {
  const results: ImportedIngredient[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.replace(/^[*-]\s*/, '').trim();
    if (!line) continue;

    const quantity = extractQuantityUnit(line);
    if (!quantity) continue;

    const name = extractIngredientName(line);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const converted = normalizeQuantityToSupportedUnits(quantity.value, quantity.unit);
    if (!converted) continue;

    results.push({
      name,
      amount_per_base: converted.amount,
      unit: converted.unit,
      display_unit: converted.displayUnit
    });
  }

  return results;
}

function extractQuantityUnit(line: string): { value: number; unit: string } | null {
  const normalized = line.toLowerCase();
  const re = /([~≈]?\s*\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|grams?|g|ml|tbsp|tsp|cups?|cup)\b/g;
  let match: RegExpExecArray | null = null;

  let preferred: { value: number; unit: string; score: number } | null = null;
  while ((match = re.exec(normalized)) !== null) {
    const raw = match[1].replace(/[~≈\s]/g, '');
    const value = Number(raw);
    const unit = match[2];
    if (!Number.isFinite(value) || value <= 0) continue;
    const score =
      unit === 'g' || unit === 'gram' || unit === 'grams'
        ? 5
        : unit === 'ml'
          ? 4
          : unit === 'tbsp'
            ? 3
            : unit === 'tsp'
              ? 2
              : unit.startsWith('cup')
                ? 1
                : 0;
    if (!preferred || score > preferred.score) {
      preferred = { value, unit, score };
    }
  }

  return preferred ? { value: preferred.value, unit: preferred.unit } : null;
}

function normalizeQuantityToSupportedUnits(
  value: number,
  unit: string
): { amount: number; unit: ImportUnit; displayUnit: DisplayUnit } | null {
  if (unit === 'g' || unit === 'gram' || unit === 'grams') return { amount: value, unit: 'g', displayUnit: 'g' };
  if (unit === 'ml') return { amount: value, unit: 'ml', displayUnit: 'ml' };
  if (unit === 'tbsp') return { amount: value, unit: 'tbsp', displayUnit: 'tbsp' };
  if (unit === 'tsp') return { amount: value, unit: 'tsp', displayUnit: 'tsp' };
  if (unit === 'cup' || unit === 'cups') return { amount: value * 240, unit: 'ml', displayUnit: 'ml' };
  if (unit === 'kg') return { amount: value * 1000, unit: 'g', displayUnit: 'g' };
  if (unit === 'lb' || unit === 'lbs' || unit === 'pound' || unit === 'pounds') {
    return { amount: value * 453.59237, unit: 'g', displayUnit: 'g' };
  }
  return null;
}

function extractIngredientName(line: string): string {
  if (line.includes(':')) {
    return line
      .split(':')[0]
      .replace(/[()]/g, '')
      .replace(/\bopt\.?\b/gi, '')
      .trim();
  }

  return line
    .replace(/^[~≈]?\s*\d+(?:\.\d+)?\s*(lbs?|pounds?|kg|grams?|g|ml|tbsp|tsp|cups?|cup)\b/i, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
