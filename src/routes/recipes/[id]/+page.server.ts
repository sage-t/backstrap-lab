import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  addRecipeCut,
  createVariation,
  deleteRecipe as removeRecipe,
  deleteRecipeCut,
  deleteRecipeIngredient,
  deleteVariation,
  ensureIngredient,
  getRecipeDetail,
  listIngredients,
  reorderRecipeIngredients,
  setRecipeRating,
  updateRecipe,
  upsertRecipeIngredient
} from '$lib/server/db';
import type { DisplayUnit } from '$lib/scaling';
import { normalizeUserId, requireUserId } from '$lib/server/auth';

const isDisplayUnit = (value: string): value is DisplayUnit => ['g', 'ml', 'tsp', 'tbsp', 'unit'].includes(value);
type DisplayUnitInput = DisplayUnit | 'lb' | 'oz';
type RatioType = 'g' | 'ml' | 'unit';
type AmountInputUnit = 'g' | 'lb' | 'oz' | 'ml' | 'tsp' | 'tbsp' | 'cup' | 'unit';

const GRAMS_PER_LB = 453.59237;
const GRAMS_PER_OZ = 28.349523125;
const ML_PER_TSP = 4.92892;
const ML_PER_TBSP = ML_PER_TSP * 3;
const ML_PER_CUP = 240;

function parseDisplayUnitInput(value: string): DisplayUnit {
  const unit = value.trim().toLowerCase() as DisplayUnitInput;
  if (unit === 'lb' || unit === 'oz' || unit === 'unit') return 'g';
  return isDisplayUnit(unit) ? unit : 'g';
}

function parseRatioAmounts(
  ratioType: string,
  amount: number,
  amountUnitRaw: string
): { amountGramsPerBase: number | null; amountMlPerBase: number | null; amountUnitsPerBase: number | null } {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const unit = amountUnitRaw.toLowerCase() as AmountInputUnit;
  if (ratioType === 'g') {
    if (unit === 'g') return { amountGramsPerBase: amount, amountMlPerBase: null, amountUnitsPerBase: null };
    if (unit === 'lb') return { amountGramsPerBase: amount * GRAMS_PER_LB, amountMlPerBase: null, amountUnitsPerBase: null };
    if (unit === 'oz') return { amountGramsPerBase: amount * GRAMS_PER_OZ, amountMlPerBase: null, amountUnitsPerBase: null };
    throw new Error('For grams/base ratios, use unit g, lb, or oz');
  }

  if (ratioType === 'ml') {
    if (unit === 'ml') return { amountGramsPerBase: null, amountMlPerBase: amount, amountUnitsPerBase: null };
    if (unit === 'tsp') return { amountGramsPerBase: null, amountMlPerBase: amount * ML_PER_TSP, amountUnitsPerBase: null };
    if (unit === 'tbsp') return { amountGramsPerBase: null, amountMlPerBase: amount * ML_PER_TBSP, amountUnitsPerBase: null };
    if (unit === 'cup') return { amountGramsPerBase: null, amountMlPerBase: amount * ML_PER_CUP, amountUnitsPerBase: null };
    throw new Error('For ml/base ratios, use unit ml, tsp, tbsp, or cup');
  }

  if (ratioType === 'unit') {
    return { amountGramsPerBase: null, amountMlPerBase: null, amountUnitsPerBase: amount };
  }

  throw new Error('Invalid ratio type');
}

function inferRatioTypeFromAmountUnit(rawUnit: string): RatioType {
  const unit = rawUnit.trim().toLowerCase();
  if (unit === 'g' || unit === 'lb' || unit === 'oz') return 'g';
  if (unit === 'ml' || unit === 'tsp' || unit === 'tbsp' || unit === 'cup') return 'ml';
  return 'unit';
}

function parseOrderedIds(raw: string): number[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.trunc(value));
    }
  } catch {
    // Accept comma-separated as fallback.
  }
  return trimmed
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.trunc(value));
}

export const load: PageServerLoad = async ({ params, platform, locals }) => {
  if (!platform?.env?.DB) throw error(500, 'DB binding missing');
  const recipeId = Number(params.id);
  const viewerUserId = normalizeUserId(locals.user);
  const detail = await getRecipeDetail(platform.env.DB, recipeId, viewerUserId);
  if (!detail) throw redirect(303, '/');
  const ingredientCatalog = await listIngredients(platform.env.DB);
  const canEditRecipe = viewerUserId !== null && viewerUserId === detail.recipe.ownerUserId;
  return {
    ...detail,
    recipeIngredients: detail.ingredients,
    ingredientCatalog,
    canEditRecipe,
    canDeleteRecipe: canEditRecipe,
    canRateRecipe: viewerUserId !== null,
    today: new Date().toISOString().slice(0, 10)
  };
};

export const actions: Actions = {
  updateRecipe: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const recipeId = Number(params.id);
    const form = await request.formData();
    await updateRecipe(platform.env.DB, recipeId, {
      title: String(form.get('title') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      tags: String(form.get('tags') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      baseMeatGrams: Number(form.get('base_meat_grams') ?? 1000),
      baseAnimal: String(form.get('base_animal') ?? '').trim()
    }, actorUserId);
    return { success: true };
  },

  addCut: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    const cutName = String(form.get('cut_name') ?? '').trim();
    if (!cutName) return { success: false };
    await addRecipeCut(platform.env.DB, Number(params.id), cutName, actorUserId);
    return { success: true };
  },

  deleteCut: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    await deleteRecipeCut(platform.env.DB, Number(form.get('cut_id')), Number(params.id), actorUserId);
    return { success: true };
  },

  addIngredient: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();

    const ingredientIdRaw = String(form.get('ingredient_id') ?? '').trim();
    const newName = String(form.get('new_ingredient_name') ?? '').trim();
    const unitRaw = String(form.get('new_ingredient_unit') ?? 'g');
    const ratioTypeRaw = String(form.get('ratio_type') ?? '').trim().toLowerCase();
    const amount = Number(form.get('amount') ?? NaN);
    const amountUnit = String(form.get('amount_input_unit') ?? '').trim().toLowerCase();
    const ratioType: RatioType =
      ratioTypeRaw === 'g' || ratioTypeRaw === 'ml' || ratioTypeRaw === 'unit'
        ? ratioTypeRaw
        : inferRatioTypeFromAmountUnit(amountUnit);
    const overrideRaw = String(form.get('display_unit_override') ?? '').trim();

    let ingredientId = ingredientIdRaw ? Number(ingredientIdRaw) : 0;
    if (!ingredientId) {
      if (!newName) return { success: false, message: 'Pick ingredient or create a new one' };
      ingredientId = await ensureIngredient(
        platform.env.DB,
        newName,
        parseDisplayUnitInput(unitRaw),
        actorUserId
      );
    }

    const displayUnitOverride = isDisplayUnit(overrideRaw) ? overrideRaw : null;
    let parsedAmounts: { amountGramsPerBase: number | null; amountMlPerBase: number | null; amountUnitsPerBase: number | null };
    try {
      parsedAmounts = parseRatioAmounts(
        ratioType,
        amount,
        amountUnit || (ratioType === 'ml' ? 'ml' : ratioType === 'unit' ? 'unit' : 'g')
      );
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Invalid amount' };
    }

    await upsertRecipeIngredient(platform.env.DB, {
      recipeId: Number(params.id),
      ingredientId,
      amountGramsPerBase: parsedAmounts.amountGramsPerBase,
      amountMlPerBase: parsedAmounts.amountMlPerBase,
      amountUnitsPerBase: parsedAmounts.amountUnitsPerBase,
      displayUnitOverride: ratioType === 'unit' ? (displayUnitOverride ?? 'unit') : displayUnitOverride,
      sortOrder: Number(form.get('sort_order') ?? 10)
    }, actorUserId);

    return { success: true };
  },

  updateIngredient: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    const ratioType = String(form.get('ratio_type') ?? 'g') as RatioType;
    const amount = Number(form.get('amount') ?? NaN);
    const amountUnit = String(form.get('amount_input_unit') ?? (ratioType === 'ml' ? 'ml' : ratioType === 'unit' ? 'unit' : 'g')).trim().toLowerCase();
    const overrideRaw = String(form.get('display_unit_override') ?? '').trim();
    let parsedAmounts: { amountGramsPerBase: number | null; amountMlPerBase: number | null; amountUnitsPerBase: number | null };
    try {
      parsedAmounts = parseRatioAmounts(ratioType, amount, amountUnit);
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Invalid amount' };
    }

    await upsertRecipeIngredient(platform.env.DB, {
      id: Number(form.get('id')),
      recipeId: Number(params.id),
      ingredientId: Number(form.get('ingredient_id')),
      amountGramsPerBase: parsedAmounts.amountGramsPerBase,
      amountMlPerBase: parsedAmounts.amountMlPerBase,
      amountUnitsPerBase: parsedAmounts.amountUnitsPerBase,
      displayUnitOverride:
        ratioType === 'unit'
          ? (isDisplayUnit(overrideRaw) ? overrideRaw : 'unit')
          : (isDisplayUnit(overrideRaw) ? overrideRaw : null),
      sortOrder: Number(form.get('sort_order') ?? 10)
    }, actorUserId);

    return { success: true };
  },

  deleteIngredient: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    await deleteRecipeIngredient(platform.env.DB, Number(form.get('id')), Number(params.id), actorUserId);
    return { success: true };
  },

  reorderIngredients: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    const orderedIds = parseOrderedIds(String(form.get('ordered_ids') ?? ''));
    if (orderedIds.length === 0) return { success: false, message: 'No ingredient order provided' };
    await reorderRecipeIngredients(platform.env.DB, Number(params.id), orderedIds, actorUserId);
    return { success: true };
  },

  createVariation: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    const parentRaw = String(form.get('parent_variation_id') ?? '').trim();
    const ratingRaw = String(form.get('rating') ?? '').trim();
    let id: number;
    try {
      id = await createVariation(platform.env.DB, {
        recipeId: Number(params.id),
        cookedAt: String(form.get('cooked_at') ?? new Date().toISOString().slice(0, 10)),
        meatGrams: Number(form.get('meat_grams') ?? 1000),
        animalOverride: String(form.get('animal_override') ?? '').trim(),
        parentVariationId: parentRaw ? Number(parentRaw) : null,
        rating: ratingRaw ? Number(ratingRaw) : null,
        actorUserId
      });
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Failed to create variation' };
    }

    throw redirect(303, `/variations/${id}`);
  },

  deleteVariation: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    const deleted = await deleteVariation(
      platform.env.DB,
      Number(form.get('variation_id')),
      actorUserId,
      Number(params.id)
    );
    if (!deleted) return { success: false, message: 'Only the recipe owner can delete variations.' };
    return { success: true };
  },

  rateRecipe: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    const rating = Number(form.get('rating') ?? NaN);
    if (!Number.isFinite(rating)) return { success: false, message: 'Rating is required' };
    await setRecipeRating(platform.env.DB, Number(params.id), rating, actorUserId);
    return { success: true };
  },

  deleteRecipe: async ({ params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const deleted = await removeRecipe(platform.env.DB, Number(params.id), actorUserId);
    if (!deleted) return { success: false, message: 'Only the recipe owner can delete this recipe.' };
    throw redirect(303, '/');
  }
};
