import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  addRecipeCut,
  createVariation,
  deleteRecipeCut,
  deleteRecipeIngredient,
  ensureIngredient,
  getRecipeDetail,
  listIngredients,
  updateRecipe,
  upsertRecipeIngredient
} from '$lib/server/db';
import type { DisplayUnit } from '$lib/scaling';

const isDisplayUnit = (value: string): value is DisplayUnit => ['g', 'ml', 'tsp', 'tbsp'].includes(value);

export const load: PageServerLoad = async ({ params, platform }) => {
  if (!platform?.env?.DB) throw error(500, 'DB binding missing');
  const recipeId = Number(params.id);
  const detail = await getRecipeDetail(platform.env.DB, recipeId);
  if (!detail) throw redirect(303, '/');
  const ingredientCatalog = await listIngredients(platform.env.DB);
  return {
    ...detail,
    recipeIngredients: detail.ingredients,
    ingredientCatalog,
    today: new Date().toISOString().slice(0, 10)
  };
};

export const actions: Actions = {
  updateRecipe: async ({ request, params, platform }) => {
    if (!platform?.env?.DB) return { success: false };
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
    });
    return { success: true };
  },

  addCut: async ({ request, params, platform }) => {
    if (!platform?.env?.DB) return { success: false };
    const form = await request.formData();
    const cutName = String(form.get('cut_name') ?? '').trim();
    if (!cutName) return { success: false };
    await addRecipeCut(platform.env.DB, Number(params.id), cutName);
    return { success: true };
  },

  deleteCut: async ({ request, params, platform }) => {
    if (!platform?.env?.DB) return { success: false };
    const form = await request.formData();
    await deleteRecipeCut(platform.env.DB, Number(form.get('cut_id')), Number(params.id));
    return { success: true };
  },

  addIngredient: async ({ request, params, platform }) => {
    if (!platform?.env?.DB) return { success: false };
    const form = await request.formData();

    const ingredientIdRaw = String(form.get('ingredient_id') ?? '').trim();
    const newName = String(form.get('new_ingredient_name') ?? '').trim();
    const unitRaw = String(form.get('new_ingredient_unit') ?? 'g');
    const ratioType = String(form.get('ratio_type') ?? 'g');
    const amount = Number(form.get('amount') ?? 0);
    const overrideRaw = String(form.get('display_unit_override') ?? '').trim();

    let ingredientId = ingredientIdRaw ? Number(ingredientIdRaw) : 0;
    if (!ingredientId) {
      if (!newName) return { success: false, message: 'Pick ingredient or create a new one' };
      ingredientId = await ensureIngredient(
        platform.env.DB,
        newName,
        isDisplayUnit(unitRaw) ? unitRaw : 'g'
      );
    }

    const displayUnitOverride = isDisplayUnit(overrideRaw) ? overrideRaw : null;

    await upsertRecipeIngredient(platform.env.DB, {
      recipeId: Number(params.id),
      ingredientId,
      amountGramsPerBase: ratioType === 'g' ? amount : null,
      amountMlPerBase: ratioType === 'ml' ? amount : null,
      displayUnitOverride,
      sortOrder: Number(form.get('sort_order') ?? 10)
    });

    return { success: true };
  },

  updateIngredient: async ({ request, params, platform }) => {
    if (!platform?.env?.DB) return { success: false };
    const form = await request.formData();
    const ratioType = String(form.get('ratio_type') ?? 'g');
    const amount = Number(form.get('amount') ?? 0);
    const overrideRaw = String(form.get('display_unit_override') ?? '').trim();

    await upsertRecipeIngredient(platform.env.DB, {
      id: Number(form.get('id')),
      recipeId: Number(params.id),
      ingredientId: Number(form.get('ingredient_id')),
      amountGramsPerBase: ratioType === 'g' ? amount : null,
      amountMlPerBase: ratioType === 'ml' ? amount : null,
      displayUnitOverride: isDisplayUnit(overrideRaw) ? overrideRaw : null,
      sortOrder: Number(form.get('sort_order') ?? 10)
    });

    return { success: true };
  },

  deleteIngredient: async ({ request, params, platform }) => {
    if (!platform?.env?.DB) return { success: false };
    const form = await request.formData();
    await deleteRecipeIngredient(platform.env.DB, Number(form.get('id')), Number(params.id));
    return { success: true };
  },

  createVariation: async ({ request, params, platform }) => {
    if (!platform?.env?.DB) return { success: false };
    const form = await request.formData();
    const id = await createVariation(platform.env.DB, {
      recipeId: Number(params.id),
      cookedAt: String(form.get('cooked_at') ?? new Date().toISOString().slice(0, 10)),
      meatGrams: Number(form.get('meat_grams') ?? 1000),
      animalOverride: String(form.get('animal_override') ?? '').trim()
    });

    throw redirect(303, `/variations/${id}`);
  }
};
