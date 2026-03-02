import type { Actions, PageServerLoad } from './$types';
import { createRecipe, listRecipes } from '$lib/server/db';

export const load: PageServerLoad = async ({ platform, url }) => {
  const q = (url.searchParams.get('q') ?? '').trim();
  return {
    recipes: platform?.env?.DB ? await listRecipes(platform.env.DB, q) : []
  };
};

export const actions: Actions = {
  create: async ({ request, platform }) => {
    if (!platform?.env?.DB) return { success: false, message: 'DB not configured' };
    const form = await request.formData();
    const title = String(form.get('title') ?? '').trim();
    if (!title) return { success: false, message: 'Title is required' };
    const id = await createRecipe(platform.env.DB, {
      title,
      description: '',
      tags: [],
      baseMeatGrams: 1000,
      baseAnimal: ''
    });
    return { success: true, id };
  }
};
