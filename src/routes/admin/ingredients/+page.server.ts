import type { Actions, PageServerLoad } from './$types';
import { ensureIngredient, listIngredients, updateIngredientDisplayUnit } from '$lib/server/db';
import type { DisplayUnit } from '$lib/scaling';

const isDisplayUnit = (value: string): value is DisplayUnit => ['g', 'ml', 'tsp', 'tbsp'].includes(value);

export const load: PageServerLoad = async ({ platform }) => {
  return {
    ingredients: platform?.env?.DB ? await listIngredients(platform.env.DB) : []
  };
};

export const actions: Actions = {
  create: async ({ request, platform }) => {
    if (!platform?.env?.DB) return { success: false };
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    if (!name) return { success: false, message: 'Name required' };
    const unitRaw = String(form.get('default_display_unit') ?? 'g');
    await ensureIngredient(platform.env.DB, name, isDisplayUnit(unitRaw) ? unitRaw : 'g');
    return { success: true };
  },
  updateUnit: async ({ request, platform }) => {
    if (!platform?.env?.DB) return { success: false };
    const form = await request.formData();
    const unitRaw = String(form.get('default_display_unit') ?? 'g');
    if (!isDisplayUnit(unitRaw)) return { success: false };
    await updateIngredientDisplayUnit(platform.env.DB, Number(form.get('ingredient_id')), unitRaw);
    return { success: true };
  }
};
