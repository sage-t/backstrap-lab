import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createRecipe } from '$lib/server/db';

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
  }
};
