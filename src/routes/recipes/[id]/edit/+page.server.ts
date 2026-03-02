import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getRecipeDetail, updateRecipe } from '$lib/server/db';

export const load: PageServerLoad = async ({ params, platform }) => {
  if (!platform?.env?.DB) throw error(500, 'DB binding missing');
  const detail = await getRecipeDetail(platform.env.DB, Number(params.id));
  if (!detail) throw redirect(303, '/');
  return { recipe: detail.recipe };
};

export const actions: Actions = {
  save: async ({ request, params, platform }) => {
    if (!platform?.env?.DB) return { success: false };
    const form = await request.formData();
    await updateRecipe(platform.env.DB, Number(params.id), {
      title: String(form.get('title') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      tags: String(form.get('tags') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      baseMeatGrams: Number(form.get('base_meat_grams') ?? 1000),
      baseAnimal: String(form.get('base_animal') ?? '').trim()
    });
    throw redirect(303, `/recipes/${params.id}`);
  }
};
