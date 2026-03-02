import type { Actions, PageServerLoad } from './$types';
import { seedDemoData } from '$lib/server/db';

export const load: PageServerLoad = async ({ url }) => {
  return { isLocalHost: ['localhost', '127.0.0.1'].includes(url.hostname) };
};

export const actions: Actions = {
  run: async ({ platform, url }) => {
    if (!platform?.env?.DB) return { success: false, message: 'DB not configured' };
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      return { success: false, message: 'Seed action is local-only' };
    }
    await seedDemoData(platform.env.DB);
    return { success: true, message: 'Seed data inserted (idempotent).' };
  }
};
