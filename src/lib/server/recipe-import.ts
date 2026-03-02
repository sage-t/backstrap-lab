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
                'Do NOT default base meat weight.',
                'If explicit meat weight is missing but there is a meat description (example: \"1 deer front leg\"), estimate grams as best as possible.',
                'If neither explicit weight nor a usable meat description exists, set meat_weight_basis to \"missing\" and base_meat_grams to null.',
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
                    display_unit: { type: 'string', enum: ['g', 'ml', 'tsp', 'tbsp'] }
                  },
                  required: ['name', 'amount_per_base', 'unit']
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

  const payload = (await response.json()) as {
    output_text?: string;
  };

  const rawJson = payload.output_text ?? '{}';
  const parsed = safeParseRecipeDraft(rawJson);
  return normalizeDraft(parsed);
}

function safeParseRecipeDraft(json: string): ImportedRecipeDraft {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('AI returned invalid JSON');
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

function normalizeDraft(draft: ImportedRecipeDraft): NormalizedImportedRecipe {
  const title = draft.title || 'Imported Recipe';
  const basis = draft.meat_weight_basis;
  const hasDescription = Boolean(draft.meat_description);
  const baseMeatGrams =
    draft.base_meat_grams === null ? null : clampPositive(Math.round(draft.base_meat_grams), null);

  if (basis === 'missing' || baseMeatGrams === null) {
    if (!hasDescription) {
      throw new Error(
        'Import failed: no meat weight or meat description found. Please include a weight (grams/lb) or a describable cut/portion.'
      );
    }
    throw new Error(
      'Import failed: could not estimate meat weight from the provided description. Please add an approximate weight.'
    );
  }

  const ingredients = draft.ingredients
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
    description: draft.description,
    tags: draft.tags,
    baseMeatGrams,
    baseAnimal: draft.base_animal,
    meatWeightBasis: basis === 'estimated_from_description' ? 'estimated_from_description' : 'explicit',
    meatWeightNote: draft.meat_weight_note,
    cuts: draft.cuts.filter(Boolean),
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
