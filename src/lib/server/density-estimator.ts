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
