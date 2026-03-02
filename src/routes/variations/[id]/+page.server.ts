import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  addVariationCut,
  addVariationNote,
  deleteVariationCut,
  getVariationDetail,
  updateVariation
} from '$lib/server/db';
import { scaleIngredients } from '$lib/scaling';

export const load: PageServerLoad = async ({ params, platform }) => {
  if (!platform?.env?.DB) throw error(500, 'DB binding missing');
  const detail = await getVariationDetail(platform.env.DB, Number(params.id));
  if (!detail) throw redirect(303, '/');

  const scaled = scaleIngredients({
    baseMeatGrams: detail.variation.baseMeatGrams,
    targetMeatGrams: detail.variation.meatGrams,
    rows: detail.recipeIngredients
  });

  return { ...detail, scaled };
};

export const actions: Actions = {
  updateVariation: async ({ request, params, platform }) => {
    if (!platform?.env?.DB) return { success: false };
    const form = await request.formData();
    await updateVariation(platform.env.DB, Number(params.id), {
      cookedAt: String(form.get('cooked_at') ?? '').trim(),
      meatGrams: Number(form.get('meat_grams') ?? 1000),
      animalOverride: String(form.get('animal_override') ?? '').trim()
    });
    return { success: true };
  },
  addCut: async ({ request, params, platform }) => {
    if (!platform?.env?.DB) return { success: false };
    const form = await request.formData();
    await addVariationCut(platform.env.DB, Number(params.id), String(form.get('cut_name') ?? '').trim());
    return { success: true };
  },
  deleteCut: async ({ request, params, platform }) => {
    if (!platform?.env?.DB) return { success: false };
    const form = await request.formData();
    await deleteVariationCut(platform.env.DB, Number(params.id), Number(form.get('cut_id')));
    return { success: true };
  },
  addNote: async ({ request, params, platform }) => {
    if (!platform?.env?.DB) return { success: false };
    const form = await request.formData();
    const noteText = String(form.get('note_text') ?? '').trim();
    const ratingRaw = String(form.get('rating') ?? '').trim();
    const rating = ratingRaw ? Math.min(5, Math.max(1, Number(ratingRaw))) : null;
    if (!noteText) return { success: false };
    await addVariationNote(platform.env.DB, Number(params.id), noteText, rating);
    return { success: true };
  }
};
