import { error } from '@sveltejs/kit';

export function normalizeUserId(user: App.Locals['user']): string | null {
  const value = user?.id?.trim().toLowerCase();
  return value ? value : null;
}

export function requireUserId(locals: App.Locals): string {
  const userId = normalizeUserId(locals.user);
  if (!userId) throw error(401, 'Authentication required');
  return userId;
}
