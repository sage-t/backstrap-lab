import type { LayoutServerLoad } from './$types';
import { getUserMeasurementSettings, listRecipes } from '$lib/server/db';
import { normalizeUserId } from '$lib/server/auth';
import { DEFAULT_MEASUREMENT_PREFERENCES } from '$lib/measurement';

export const load: LayoutServerLoad = async ({ platform, url, locals }) => {
  const q = (url.searchParams.get('q') ?? '').trim();
  const recipes = platform?.env?.DB ? await listRecipes(platform.env.DB, q) : [];
  const actorUserId = normalizeUserId(locals.user);
  const measurementPrefs =
    platform?.env?.DB && actorUserId
      ? await getUserMeasurementSettings(platform.env.DB, actorUserId)
      : DEFAULT_MEASUREMENT_PREFERENCES;
  return { recipes, q, user: locals.user, measurementPrefs };
};
