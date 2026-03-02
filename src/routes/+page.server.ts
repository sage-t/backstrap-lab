import type { Actions, PageServerLoad } from './$types';
import { createRecipe, listRecipes } from '$lib/server/db';
import { requireUserId } from '$lib/server/auth';

export const load: PageServerLoad = async ({ platform, url }) => {
  const q = (url.searchParams.get('q') ?? '').trim();
  return {
    recipes: platform?.env?.DB ? await listRecipes(platform.env.DB, q) : []
  };
};

export const actions: Actions = {
  create: async ({ request, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false, message: 'DB not configured' };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    const title = String(form.get('title') ?? '').trim();
    if (!title) return { success: false, message: 'Title is required' };
    const id = await createRecipe(platform.env.DB, {
      title,
      description: '',
      tags: [],
      baseMeatGrams: 1000,
      baseAnimal: ''
    }, actorUserId);
    return { success: true, id };
  }
};
