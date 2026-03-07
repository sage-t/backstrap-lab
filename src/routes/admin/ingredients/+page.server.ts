import type { Actions, PageServerLoad } from './$types';
import { ensureIngredient, listIngredients, updateIngredientDisplayUnit } from '$lib/server/db';
import type { DisplayUnit } from '$lib/scaling';
import { requireUserId } from '$lib/server/auth';

const isDisplayUnit = (value: string): value is DisplayUnit => ['g', 'ml', 'tsp', 'tbsp', 'unit'].includes(value);
type DisplayUnitInput = DisplayUnit | 'lb' | 'oz';

function parseDisplayUnitInput(value: string): DisplayUnit {
  const unit = value.trim().toLowerCase() as DisplayUnitInput;
  if (unit === 'lb' || unit === 'oz' || unit === 'unit') return 'g';
  return isDisplayUnit(unit) ? unit : 'g';
}

export const load: PageServerLoad = async ({ platform }) => {
  return {
    ingredients: platform?.env?.DB ? await listIngredients(platform.env.DB) : []
  };
};

export const actions: Actions = {
  create: async ({ request, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    if (!name) return { success: false, message: 'Name required' };
    const unitRaw = String(form.get('default_display_unit') ?? 'g');
    await ensureIngredient(platform.env.DB, name, parseDisplayUnitInput(unitRaw), actorUserId);
    return { success: true };
  },
  updateUnit: async ({ request, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false };
    requireUserId(locals);
    const form = await request.formData();
    const unitRaw = String(form.get('default_display_unit') ?? 'g');
    await updateIngredientDisplayUnit(
      platform.env.DB,
      Number(form.get('ingredient_id')),
      parseDisplayUnitInput(unitRaw)
    );
    return { success: true };
  }
};
