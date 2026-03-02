import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { addRecipeCut, createRecipe, ensureIngredient, upsertRecipeIngredient } from '$lib/server/db';
import { importRecipeFromText } from '$lib/server/recipe-import';

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
  create: async ({ request, platform }) => {
    if (!platform?.env?.DB) return { success: false, message: 'DB binding missing' };
    const form = await request.formData();
    const title = String(form.get('title') ?? '').trim();
    if (!title) return { success: false, message: 'Title is required' };

    const id = await createRecipe(platform.env.DB, {
      title,
      description: String(form.get('description') ?? '').trim(),
      tags: String(form.get('tags') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      baseMeatGrams: Number(form.get('base_meat_grams') ?? 1000),
      baseAnimal: String(form.get('base_animal') ?? '').trim()
    });

    throw redirect(303, `/recipes/${id}`);
  },

  importText: async ({ request, platform }) => {
    if (!platform?.env?.DB) return { success: false, message: 'DB binding missing' };
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

  createFromImport: async ({ request, platform }) => {
    if (!platform?.env?.DB) return { success: false, message: 'DB binding missing' };
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
        displayUnitOverride: 'g' | 'ml' | 'tsp' | 'tbsp' | null;
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
    });

    const cuts = Array.isArray(draft.cuts) ? draft.cuts.map((cut) => String(cut).trim()).filter(Boolean) : [];
    for (const cut of cuts) {
      await addRecipeCut(platform.env.DB, recipeId, cut);
    }

    const ingredients = Array.isArray(draft.ingredients) ? draft.ingredients : [];
    for (let index = 0; index < ingredients.length; index += 1) {
      const row = ingredients[index];
      const name = String(row.name ?? '').trim();
      if (!name) continue;

      const ingredientId = await ensureIngredient(platform.env.DB, name, row.displayUnitOverride ?? 'g');
      await upsertRecipeIngredient(platform.env.DB, {
        recipeId,
        ingredientId,
        amountGramsPerBase:
          row.amountGramsPerBase !== null && Number.isFinite(row.amountGramsPerBase)
            ? row.amountGramsPerBase
            : null,
        amountMlPerBase:
          row.amountMlPerBase !== null && Number.isFinite(row.amountMlPerBase) ? row.amountMlPerBase : null,
        displayUnitOverride: row.displayUnitOverride ?? null,
        sortOrder: index + 1
      });
    }

    throw redirect(303, `/recipes/${recipeId}`);
  }
};
