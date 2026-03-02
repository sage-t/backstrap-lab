import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getRecipeDetail, updateRecipe } from '$lib/server/db';
import { normalizeUserId, requireUserId } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
  if (!platform?.env?.DB) throw error(500, 'DB binding missing');
  const detail = await getRecipeDetail(platform.env.DB, Number(params.id), normalizeUserId(locals.user));
  if (!detail) throw redirect(303, '/');
  const userId = normalizeUserId(locals.user);
  if (!userId || userId !== detail.recipe.ownerUserId) throw redirect(303, `/recipes/${params.id}`);
  return { recipe: detail.recipe };
};

export const actions: Actions = {
  save: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
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
    }, actorUserId);
    throw redirect(303, `/recipes/${params.id}`);
  }
};
