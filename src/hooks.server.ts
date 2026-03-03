import { dev } from '$app/environment';
import type { Handle } from '@sveltejs/kit';

const readHeader = (headers: Headers, name: string): string => headers.get(name)?.trim() ?? '';

function decodeBase64Url(value: string): string | null {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const base64 = normalized + pad;
  try {
    return atob(base64);
  } catch {
    return null;
  }
}

function readAccessJwtClaims(headers: Headers): Record<string, unknown> | null {
  const token =
    readHeader(headers, 'cf-access-jwt-assertion') || readHeader(headers, 'Cf-Access-Jwt-Assertion');
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = decodeBase64Url(parts[1]);
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  const jwtClaims = readAccessJwtClaims(event.request.headers);
  const jwtEmail = String(jwtClaims?.email ?? '').trim();
  const jwtSub = String(jwtClaims?.sub ?? '').trim();

  const email =
    readHeader(event.request.headers, 'cf-access-authenticated-user-email') ||
    readHeader(event.request.headers, 'Cf-Access-Authenticated-User-Email') ||
    readHeader(event.request.headers, 'x-auth-request-email') ||
    jwtEmail;

  const userId =
    email ||
    readHeader(event.request.headers, 'cf-access-authenticated-user-id') ||
    readHeader(event.request.headers, 'Cf-Access-Authenticated-User-Id') ||
    jwtSub;

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
