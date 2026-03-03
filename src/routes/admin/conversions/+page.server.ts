import type { Actions, PageServerLoad } from './$types';
import { listIngredientsWithConversions, upsertIngredientConversion } from '$lib/server/db';
import { requireUserId } from '$lib/server/auth';
import { estimateMissingDensitiesWithAI } from '$lib/server/density-estimator';

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

    const apiKey = platform.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { success: false, message: 'OPENAI_API_KEY is missing in environment secrets' };
    }

    const rows = await listIngredientsWithConversions(platform.env.DB);
    const missing = rows.filter(
      (row) =>
        row.grams_per_ml === null &&
        row.grams_per_tsp === null &&
        (row.volume_ratio_uses > 0 || row.default_display_unit !== 'g')
    );

    if (missing.length === 0) {
      return { success: true, message: 'No missing densities to estimate.' };
    }

    let estimates: Awaited<ReturnType<typeof estimateMissingDensitiesWithAI>>;
    try {
      estimates = await estimateMissingDensitiesWithAI({
        apiKey,
        ingredients: missing.slice(0, 120).map((row) => ({ ingredientId: row.id, name: row.name }))
      });
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'AI estimate failed'
      };
    }

    const missingById = new Map(missing.map((row) => [row.id, row]));
    let applied = 0;
    let skipped = 0;
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
    }

    const unresolved = Math.max(0, missing.length - applied);
    const messageParts = [`Applied AI density estimates to ${applied} ingredient${applied === 1 ? '' : 's'}.`];
    if (unresolved > 0) {
      messageParts.push(`${unresolved} unresolved (low confidence or no estimate).`);
    } else if (skipped > 0) {
      messageParts.push(`${skipped} skipped.`);
    }
    return { success: true, message: messageParts.join(' ') };
  }
};
