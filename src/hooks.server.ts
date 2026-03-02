import { dev } from '$app/environment';
import type { Handle } from '@sveltejs/kit';

const readHeader = (headers: Headers, name: string): string => headers.get(name)?.trim() ?? '';

export const handle: Handle = async ({ event, resolve }) => {
  const email =
    readHeader(event.request.headers, 'cf-access-authenticated-user-email') ||
    readHeader(event.request.headers, 'Cf-Access-Authenticated-User-Email') ||
    readHeader(event.request.headers, 'x-auth-request-email');

  const userId =
    email ||
    readHeader(event.request.headers, 'cf-access-authenticated-user-id') ||
    readHeader(event.request.headers, 'Cf-Access-Authenticated-User-Id');

  if (userId) {
    event.locals.user = {
      id: userId.toLowerCase(),
      email: email || undefined,
      source: 'access'
    };
  } else if (dev) {
    event.locals.user = {
      id: 'local-dev',
      email: 'local-dev',
      source: 'dev'
    };
  } else {
    event.locals.user = null;
  }

  return resolve(event);
};
