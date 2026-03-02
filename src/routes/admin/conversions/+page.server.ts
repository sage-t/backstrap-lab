import type { Actions, PageServerLoad } from './$types';
import { listIngredientsWithConversions, upsertIngredientConversion } from '$lib/server/db';
import { requireUserId } from '$lib/server/auth';

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
  }
};
