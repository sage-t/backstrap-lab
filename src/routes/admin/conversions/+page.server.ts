import type { Actions, PageServerLoad } from './$types';
import { listIngredientsWithConversions, upsertIngredientConversion } from '$lib/server/db';
import { requireUserId } from '$lib/server/auth';
import { estimateDensityFromName, estimateMissingDensitiesWithAI } from '$lib/server/density-estimator';

const parseNumber = (value: FormDataEntryValue | null): number | null => {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

export const load: PageServerLoad = async ({ platform }) => {
  return {
    rows: platform?.env?.DB ? await listIngredientsWithConversions(platform.env.DB) : []
  };
};

export const actions: Actions = {
  update: async ({ request, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    requireUserId(locals);
    const form = await request.formData();
    await upsertIngredientConversion(platform.env.DB, {
      ingredientId: Number(form.get('ingredient_id')),
      gramsPerMl: parseNumber(form.get('grams_per_ml')),
      gramsPerTsp: parseNumber(form.get('grams_per_tsp')),
      sourceNote: String(form.get('source_note') ?? '').trim()
    });

    return { success: true };
  },
  autoEstimateMissing: async ({ platform, locals }) => {
    if (!platform?.env?.DB) return { success: false, message: 'DB binding missing' };
    requireUserId(locals);

    const rows = await listIngredientsWithConversions(platform.env.DB);
    const missing = rows.filter(
      (row) =>
        row.grams_per_ml === null &&
        row.grams_per_tsp === null &&
        (row.total_ratio_uses > 0 || row.default_display_unit !== 'g')
    );

    if (missing.length === 0) {
      return { success: true, message: 'No missing densities to estimate.' };
    }

    let applied = 0;
    let heuristicApplied = 0;
    const unresolvedForAi: Array<{ id: number; name: string }> = [];

    for (const row of missing) {
      const heuristic = estimateDensityFromName(row.name);
      if (!heuristic || (heuristic.gramsPerMl === null && heuristic.gramsPerTsp === null)) {
        unresolvedForAi.push({ id: row.id, name: row.name });
        continue;
      }

      const sourceNote = [
        `name_estimate:${new Date().toISOString().slice(0, 10)}`,
        `confidence=${heuristic.confidence.toFixed(2)}`,
        heuristic.note
      ].join(' | ');
      await upsertIngredientConversion(platform.env.DB, {
        ingredientId: row.id,
        gramsPerMl: heuristic.gramsPerMl,
        gramsPerTsp: heuristic.gramsPerTsp,
        sourceNote
      });
      applied += 1;
      heuristicApplied += 1;
    }

    if (unresolvedForAi.length === 0) {
      return {
        success: true,
        message: `Applied ${applied} density estimate${applied === 1 ? '' : 's'} from ingredient-name rules.`
      };
    }

    const apiKey = platform.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        success: heuristicApplied > 0,
        message:
          heuristicApplied > 0
            ? `Applied ${heuristicApplied} density estimate${heuristicApplied === 1 ? '' : 's'} from ingredient-name rules. OPENAI_API_KEY is missing for deeper AI estimation.`
            : 'OPENAI_API_KEY is missing in environment secrets'
      };
    }

    let estimates: Awaited<ReturnType<typeof estimateMissingDensitiesWithAI>>;
    try {
      estimates = await estimateMissingDensitiesWithAI({
        apiKey,
        ingredients: unresolvedForAi
          .slice(0, 120)
          .map((row) => ({ ingredientId: row.id, name: row.name }))
      });
    } catch (error) {
      if (applied > 0) {
        return {
          success: true,
          message: `Applied ${applied} density estimate${applied === 1 ? '' : 's'} from ingredient-name rules, but AI pass failed: ${error instanceof Error ? error.message : 'AI estimate failed'}.`
        };
      }
      return {
        success: false,
        message: error instanceof Error ? error.message : 'AI estimate failed'
      };
    }

    const missingById = new Map(unresolvedForAi.map((row) => [row.id, row]));
    let skipped = 0;
    let aiApplied = 0;
    for (const estimate of estimates) {
      const target = missingById.get(estimate.ingredientId);
      if (!target) continue;
      if (estimate.gramsPerMl === null && estimate.gramsPerTsp === null) {
        skipped += 1;
        continue;
      }

      const confidenceLabel = estimate.confidence.toFixed(2);
      const sourceNote = [
        `ai_estimate:${new Date().toISOString().slice(0, 10)}`,
        `model=gpt-4.1-mini`,
        `confidence=${confidenceLabel}`,
        estimate.note || undefined
      ]
        .filter(Boolean)
        .join(' | ');

      await upsertIngredientConversion(platform.env.DB, {
        ingredientId: estimate.ingredientId,
        gramsPerMl: estimate.gramsPerMl,
        gramsPerTsp: estimate.gramsPerTsp,
        sourceNote
      });
      applied += 1;
      aiApplied += 1;
    }

    const unresolved = Math.max(0, missing.length - applied);
    const messageParts = [
      `Applied ${applied} total estimate${applied === 1 ? '' : 's'} (${heuristicApplied} name rules, ${aiApplied} AI).`
    ];
    if (unresolved > 0) {
      messageParts.push(`${unresolved} unresolved (low confidence or no estimate).`);
    } else if (skipped > 0) {
      messageParts.push(`${skipped} skipped.`);
    }
    return { success: true, message: messageParts.join(' ') };
  }
};
