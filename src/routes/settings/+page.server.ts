import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getUserMeasurementSettings, upsertUserMeasurementSettings } from '$lib/server/db';
import { normalizeUserId, requireUserId } from '$lib/server/auth';
import { DEFAULT_MEASUREMENT_PREFERENCES, isVolumePreference, isWeightPreference } from '$lib/measurement';

export const load: PageServerLoad = async ({ platform, locals }) => {
  if (!platform?.env?.DB) throw error(500, 'DB binding missing');
  const actorUserId = normalizeUserId(locals.user);
  return {
    settings: actorUserId
      ? await getUserMeasurementSettings(platform.env.DB, actorUserId)
      : DEFAULT_MEASUREMENT_PREFERENCES
  };
};

export const actions: Actions = {
  save: async ({ request, platform, locals }) => {
    if (!platform?.env?.DB) return { success: false, message: 'DB binding missing' };
    const actorUserId = requireUserId(locals);
    const form = await request.formData();
    const weightPreference = String(form.get('weight_preference') ?? '').trim();
    const volumePreference = String(form.get('volume_preference') ?? '').trim();
    if (!isWeightPreference(weightPreference) || !isVolumePreference(volumePreference)) {
      return { success: false, message: 'Invalid measurement preference selected' };
    }
    try {
      await upsertUserMeasurementSettings(
        platform.env.DB,
        { weightPreference, volumePreference },
        actorUserId
      );
    } catch {
      return {
        success: false,
        message: 'Could not save settings. Run latest D1 migrations and retry.'
      };
    }
    return { success: true, message: 'Measurement preferences saved' };
  }
};
