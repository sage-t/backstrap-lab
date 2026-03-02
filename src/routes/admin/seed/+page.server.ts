import type { Actions, PageServerLoad } from './$types';
import { seedDemoData } from '$lib/server/db';
import { requireUserId } from '$lib/server/auth';

export const load: PageServerLoad = async ({ url }) => {
  return { isLocalHost: ['localhost', '127.0.0.1'].includes(url.hostname) };
};

export const actions: Actions = {
  run: async ({ platform, url, locals }) => {
    if (!platform?.env?.DB) return { success: false, message: 'DB not configured' };
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      return { success: false, message: 'Seed action is local-only' };
    }
    await seedDemoData(platform.env.DB, requireUserId(locals));
    return { success: true, message: 'Seed data inserted (idempotent).' };
  }
};
