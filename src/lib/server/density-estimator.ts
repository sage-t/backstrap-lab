const MODEL = 'gpt-4.1-mini';
const ML_PER_TSP = 4.92892;

export type DensityEstimateRequestItem = {
  ingredientId: number;
  name: string;
};

export type DensityEstimateItem = {
  ingredientId: number;
  gramsPerTsp: number | null;
  gramsPerMl: number | null;
  confidence: number;
  note: string;
};

export type NameDensityEstimate = {
  gramsPerTsp: number | null;
  gramsPerMl: number | null;
  confidence: number;
  note: string;
};

const NAME_DENSITY_HINTS: Array<{
  includes: string[];
  gramsPerTsp: number;
  note: string;
}> = [
  { includes: ['kosher salt'], gramsPerTsp: 5.7, note: 'rule_of_thumb:kosher_salt' },
  { includes: ['table salt'], gramsPerTsp: 6, note: 'rule_of_thumb:table_salt' },
  { includes: ['black pepper'], gramsPerTsp: 2.3, note: 'rule_of_thumb:black_pepper' },
  { includes: ['paprika'], gramsPerTsp: 2.3, note: 'rule_of_thumb:paprika' },
  { includes: ['garlic powder'], gramsPerTsp: 3.1, note: 'rule_of_thumb:garlic_powder' },
  { includes: ['onion powder'], gramsPerTsp: 2.4, note: 'rule_of_thumb:onion_powder' },
  { includes: ['cumin'], gramsPerTsp: 2.1, note: 'rule_of_thumb:cumin' },
  { includes: ['coriander'], gramsPerTsp: 1.7, note: 'rule_of_thumb:coriander' },
  { includes: ['cayenne'], gramsPerTsp: 2.4, note: 'rule_of_thumb:cayenne' },
  { includes: ['crushed red pepper'], gramsPerTsp: 1.8, note: 'rule_of_thumb:crushed_red_pepper' },
  { includes: ['red pepper flakes'], gramsPerTsp: 1.8, note: 'rule_of_thumb:red_pepper_flakes' },
  { includes: ['chili powder'], gramsPerTsp: 2.6, note: 'rule_of_thumb:chili_powder' }
];

function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function estimateDensityFromName(name: string): NameDensityEstimate | null {
  const normalized = normalizeIngredientName(name);
  if (!normalized) return null;

  for (const hint of NAME_DENSITY_HINTS) {
    if (hint.includes.every((part) => normalized.includes(part))) {
      return {
        gramsPerTsp: hint.gramsPerTsp,
        gramsPerMl: hint.gramsPerTsp / ML_PER_TSP,
        confidence: 0.62,
        note: hint.note
      };
    }
  }

  if (normalized.includes('salt')) {
    const gramsPerTsp = 5.7;
    return {
      gramsPerTsp,
      gramsPerMl: gramsPerTsp / ML_PER_TSP,
      confidence: 0.5,
      note: 'rule_of_thumb:generic_salt'
    };
  }

  const powderOrGround =
    normalized.includes('powder') || normalized.includes('ground') || normalized.includes('spice');
  if (powderOrGround) {
    const gramsPerTsp = 2.5;
    return {
      gramsPerTsp,
      gramsPerMl: gramsPerTsp / ML_PER_TSP,
      confidence: 0.42,
      note: 'rule_of_thumb:generic_powder'
    };
  }

  return null;
}

export async function estimateMissingDensitiesWithAI(params: {
  apiKey: string;
  ingredients: DensityEstimateRequestItem[];
}): Promise<DensityEstimateItem[]> {
  if (params.ingredients.length === 0) return [];

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
            'You estimate ingredient bulk density for cooking conversions. Return JSON only. Be conservative.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'Estimate grams per teaspoon and grams per ml for each ingredient.',
                'If unsure, return null for one or both fields.',
                'Confidence must be 0.0-1.0.',
                'Use typical home-cooking ingredient density, not packed/industrial values.',
                'Ingredients:',
                ...params.ingredients.map((item) => `${item.ingredientId}: ${item.name}`)
              ].join('\n')
            }
          ]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'density_estimates',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              estimates: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    ingredient_id: { type: 'number' },
                    grams_per_tsp: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                    grams_per_ml: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                    confidence: { type: 'number' },
                    note: { type: 'string' }
                  },
                  required: ['ingredient_id', 'grams_per_tsp', 'grams_per_ml', 'confidence', 'note']
                }
              }
            },
            required: ['estimates']
          }
        }
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI estimate failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const rawJson = extractJsonTextFromResponse(payload);
  return parseEstimates(rawJson);
}

function parseEstimates(rawJson: string): DensityEstimateItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('AI returned invalid density JSON');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('AI density response was not an object');
  const estimatesRaw = Array.isArray((parsed as { estimates?: unknown }).estimates)
    ? ((parsed as { estimates: unknown[] }).estimates)
    : [];

  return estimatesRaw
    .map((row) => {
      const r = row as Record<string, unknown>;
      const ingredientId = Number(r.ingredient_id);
      if (!Number.isFinite(ingredientId) || ingredientId <= 0) return null;

      let gramsPerTsp = normalizePositive(r.grams_per_tsp);
      let gramsPerMl = normalizePositive(r.grams_per_ml);

      if (gramsPerTsp === null && gramsPerMl !== null) gramsPerTsp = gramsPerMl * ML_PER_TSP;
      if (gramsPerMl === null && gramsPerTsp !== null) gramsPerMl = gramsPerTsp / ML_PER_TSP;

      const plausibleTsp = gramsPerTsp === null || (gramsPerTsp >= 0.2 && gramsPerTsp <= 60);
      const plausibleMl = gramsPerMl === null || (gramsPerMl >= 0.04 && gramsPerMl <= 20);
      if (!plausibleTsp || !plausibleMl) {
        gramsPerTsp = null;
        gramsPerMl = null;
      }

      const confidenceRaw = Number(r.confidence);
      const confidence = Number.isFinite(confidenceRaw)
        ? Math.min(1, Math.max(0, confidenceRaw))
        : 0.35;

      return {
        ingredientId,
        gramsPerTsp,
        gramsPerMl,
        confidence,
        note: String(r.note ?? '').trim()
      } satisfies DensityEstimateItem;
    })
    .filter((item): item is DensityEstimateItem => item !== null);
}

function normalizePositive(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
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

  return '{"estimates":[]}';
}
