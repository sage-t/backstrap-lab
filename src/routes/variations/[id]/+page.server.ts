import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  addVariationCut,
  addVariationNote,
  createVariation,
  deleteVariation as removeVariation,
  deleteVariationCut,
  deleteVariationIngredient,
  ensureIngredient,
  getVariationDetail,
  listIngredients,
  upsertVariationIngredient,
  updateVariation
} from '$lib/server/db';
import { scaleIngredients, type DisplayUnit } from '$lib/scaling';
import { normalizeUserId, requireUserId } from '$lib/server/auth';

const isDisplayUnit = (value: string): value is DisplayUnit => ['g', 'ml', 'tsp', 'tbsp', 'unit'].includes(value);
type DisplayUnitInput = DisplayUnit | 'lb' | 'oz';

function parseDisplayUnitInput(value: string): DisplayUnit {
  const unit = value.trim().toLowerCase() as DisplayUnitInput;
  if (unit === 'lb' || unit === 'oz' || unit === 'unit') return 'g';
  return isDisplayUnit(unit) ? unit : 'g';
}

export const load: PageServerLoad = async ({ params, platform, locals }) => {
  if (!platform?.env?.DB) throw error(500, 'DB binding missing');
  const detail = await getVariationDetail(platform.env.DB, Number(params.id));
  if (!detail) throw redirect(303, '/');
  const actorUserId = normalizeUserId(locals.user);

  const scaled = scaleIngredients({
    baseMeatGrams: detail.variation.baseMeatGrams,
    targetMeatGrams: detail.variation.meatGrams,
    rows: detail.scaledIngredientRows
  });

  const ingredientCatalog = await listIngredients(platform.env.DB);
  const canEditVariation =
    actorUserId !== null &&
    (actorUserId === detail.variation.userId || actorUserId === detail.variation.recipeOwnerUserId);
  const canDeleteVariation = actorUserId !== null && actorUserId === detail.variation.recipeOwnerUserId;
  return { ...detail, scaled, ingredientCatalog, canEditVariation, canDeleteVariation };
};

export const actions: Actions = {
  updateVariation: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    const ratingRaw = String(form.get('rating') ?? '').trim();
    await updateVariation(platform.env.DB, Number(params.id), {
      cookedAt: String(form.get('cooked_at') ?? '').trim(),
      meatGrams: Number(form.get('meat_grams') ?? 1000),
      animalOverride: String(form.get('animal_override') ?? '').trim(),
      rating: ratingRaw ? Number(ratingRaw) : null
    }, actorUserId);
    return { success: true };
  },
  addCut: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    await addVariationCut(platform.env.DB, Number(params.id), String(form.get('cut_name') ?? '').trim(), actorUserId);
    return { success: true };
  },
  deleteCut: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    await deleteVariationCut(platform.env.DB, Number(params.id), Number(form.get('cut_id')), actorUserId);
    return { success: true };
  },
  addNote: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    const noteText = String(form.get('note_text') ?? '').trim();
    const ratingRaw = String(form.get('rating') ?? '').trim();
    const rating = ratingRaw ? Math.min(5, Math.max(1, Number(ratingRaw))) : null;
    if (!noteText) return { success: false };
    await addVariationNote(platform.env.DB, Number(params.id), noteText, rating, actorUserId);
    return { success: true };
  },
  upsertRatioOverride: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    const ingredientIdRaw = String(form.get('ingredient_id') ?? '').trim();
    const newName = String(form.get('new_ingredient_name') ?? '').trim();
    const unitRaw = String(form.get('new_ingredient_unit') ?? 'g');
    const ratioType = String(form.get('ratio_type') ?? 'g');
    const amount = Number(form.get('amount') ?? 0);
    const overrideRaw = String(form.get('display_unit_override') ?? '').trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: 'Amount must be greater than 0' };
    }

    let ingredientId = ingredientIdRaw ? Number(ingredientIdRaw) : 0;
    if (!ingredientId) {
      if (!newName) return { success: false, message: 'Pick ingredient or create new one' };
      ingredientId = await ensureIngredient(
        platform.env.DB,
        newName,
        parseDisplayUnitInput(unitRaw),
        actorUserId
      );
    }

    await upsertVariationIngredient(platform.env.DB, {
      id: form.get('id') ? Number(form.get('id')) : undefined,
      variationId: Number(params.id),
      ingredientId,
      amountGramsPerBase: ratioType === 'g' ? amount : null,
      amountMlPerBase: ratioType === 'ml' ? amount : null,
      amountUnitsPerBase: ratioType === 'unit' ? amount : null,
      displayUnitOverride:
        ratioType === 'unit'
          ? (isDisplayUnit(overrideRaw) ? overrideRaw : 'unit')
          : (isDisplayUnit(overrideRaw) ? overrideRaw : null),
      sortOrder: Number(form.get('sort_order') ?? 10)
    }, actorUserId);
    return { success: true };
  },
  deleteRatioOverride: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    await deleteVariationIngredient(platform.env.DB, Number(params.id), Number(form.get('id')), actorUserId);
    return { success: true };
  },
  deleteVariation: async ({ params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const detail = await getVariationDetail(platform.env.DB, Number(params.id));
    if (!detail) return { success: false };
    const deleted = await removeVariation(platform.env.DB, Number(params.id), actorUserId);
    if (!deleted) return { success: false, message: 'Only the recipe owner can delete this variation.' };
    throw redirect(303, `/recipes/${detail.variation.recipeId}`);
  },
  createChildVariation: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const current = await getVariationDetail(platform.env.DB, Number(params.id));
    if (!current) return { success: false };
    const form = await request.formData();
    const ratingRaw = String(form.get('rating') ?? '').trim();
    let id: number;
    try {
      id = await createVariation(platform.env.DB, {
        recipeId: current.variation.recipeId,
        cookedAt: String(form.get('cooked_at') ?? '').trim() || new Date().toISOString().slice(0, 10),
        meatGrams: Number(form.get('meat_grams') ?? current.variation.meatGrams),
        animalOverride: String(form.get('animal_override') ?? '').trim(),
        parentVariationId: current.variation.id,
        recipeRevisionId: current.variation.recipeRevisionId,
        rating: ratingRaw ? Number(ratingRaw) : null,
        actorUserId
      });
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to create child variation'
      };
    }
    throw redirect(303, `/variations/${id}`);
  }
};
