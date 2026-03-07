import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { addRecipeCut, createRecipe, ensureIngredient, upsertRecipeIngredient } from '$lib/server/db';
import { importRecipeFromText } from '$lib/server/recipe-import';
import { normalizeUserId, requireUserId } from '$lib/server/auth';

export const load: PageServerLoad = async () => {
  return {
    recipe: {
      title: '',
      description: '',
      tags: [],
      baseMeatGrams: 1000,
      baseAnimal: ''
    }
  };
};

export const actions: Actions = {
  create: async ({ request, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false, message: 'DB binding missing' };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    const title = String(form.get('title') ?? '').trim();
    if (!title) return { success: false, message: 'Title is required' };
    const baseMeatGrams = Number(form.get('base_meat_grams') ?? NaN);
    if (!Number.isFinite(baseMeatGrams) || baseMeatGrams <= 0) {
      return { success: false, message: 'Base meat grams is required' };
    }

    const id = await createRecipe(platform.env.DB, {
      title,
      description: String(form.get('description') ?? '').trim(),
      tags: String(form.get('tags') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      baseMeatGrams,
      baseAnimal: String(form.get('base_animal') ?? '').trim()
    }, actorUserId);

    throw redirect(303, `/recipes/${id}`);
  },

  importText: async ({ request, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false, message: 'DB binding missing' };
    const actorUserId = normalizeUserId(locals.user);
    if (!actorUserId) {
      return {
        success: false,
        message: 'You must be signed in through Cloudflare Access before importing.'
      };
    }
    const apiKey = platform.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { success: false, message: 'OPENAI_API_KEY is missing in environment secrets' };
    }

    const form = await request.formData();
    const recipeText = String(form.get('recipe_text') ?? '').trim();
    if (!recipeText) return { success: false, message: 'Paste recipe text to import' };

    try {
      const draft = await importRecipeFromText({ apiKey, recipeText });
      return {
        success: true,
        imported: draft,
        importedJson: JSON.stringify(draft),
        message: 'Imported draft ready. Review and save.'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Import failed'
      };
    }
  },

  createFromImport: async ({ request, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false, message: 'DB binding missing' };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    const raw = String(form.get('imported_json') ?? '').trim();
    if (!raw) return { success: false, message: 'Missing imported draft' };

    let draft: {
      title: string;
      description: string;
      tags: string[];
      baseMeatGrams: number;
      baseAnimal: string;
      cuts: string[];
      ingredients: Array<{
        name: string;
        amountGramsPerBase: number | null;
        amountMlPerBase: number | null;
        amountUnitsPerBase: number | null;
        displayUnitOverride: 'g' | 'ml' | 'tsp' | 'tbsp' | 'unit' | null;
      }>;
    };

    try {
      draft = JSON.parse(raw);
    } catch {
      return { success: false, message: 'Imported draft JSON is invalid' };
    }

    const recipeId = await createRecipe(platform.env.DB, {
      title: String(draft.title ?? '').trim() || 'Imported Recipe',
      description: String(draft.description ?? '').trim(),
      tags: Array.isArray(draft.tags) ? draft.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
      baseMeatGrams: Number(draft.baseMeatGrams ?? 1000),
      baseAnimal: String(draft.baseAnimal ?? '').trim()
    }, actorUserId);

    const cuts = Array.isArray(draft.cuts) ? draft.cuts.map((cut) => String(cut).trim()).filter(Boolean) : [];
    for (const cut of cuts) {
      await addRecipeCut(platform.env.DB, recipeId, cut, actorUserId);
    }

    const ingredients = Array.isArray(draft.ingredients) ? draft.ingredients : [];
    for (let index = 0; index < ingredients.length; index += 1) {
      const row = ingredients[index];
      const name = String(row.name ?? '').trim();
      if (!name) continue;

      const ingredientDefaultUnit =
        row.displayUnitOverride && row.displayUnitOverride !== 'unit' ? row.displayUnitOverride : 'g';
      const ingredientId = await ensureIngredient(platform.env.DB, name, ingredientDefaultUnit, actorUserId);
      const amountGramsPerBase =
        row.amountGramsPerBase !== null && Number.isFinite(row.amountGramsPerBase)
          ? row.amountGramsPerBase
          : null;
      const amountMlPerBase =
        row.amountMlPerBase !== null && Number.isFinite(row.amountMlPerBase) ? row.amountMlPerBase : null;
      const amountUnitsPerBase =
        row.amountUnitsPerBase !== null && Number.isFinite(row.amountUnitsPerBase)
          ? row.amountUnitsPerBase
          : null;
      if (amountGramsPerBase === null && amountMlPerBase === null && amountUnitsPerBase === null) continue;

      await upsertRecipeIngredient(platform.env.DB, {
        recipeId,
        ingredientId,
        amountGramsPerBase,
        amountMlPerBase,
        amountUnitsPerBase,
        displayUnitOverride: row.displayUnitOverride ?? null,
        sortOrder: index + 1
      }, actorUserId);
    }

    throw redirect(303, `/recipes/${recipeId}`);
  }
};
