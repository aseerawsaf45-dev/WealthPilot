/**
 * WealthPilot — Cryptographic Session Token & Cookie Enclave
 *
 * HMAC-SHA256 signed tokens (JWT-shaped). The token only identifies a server-side
 * `Session` row (sid) and its user; everything else (privacy flags, profile) is read
 * from the database on each request so revocation and AI kill switches apply at once.
 * Cookie-only: tokens are never returned in JSON bodies or accepted as Bearer headers.
 */

import crypto from 'crypto';

export interface SessionPayload {
  sid: string;
  userId: string;
  exp: number; // Unix timestamp in seconds
  iat: number; // Issued at
}

const SESSION_COOKIE_NAME = 'wealthpilot_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Read lazily so importing this module (tests, build) doesn't need the secret; any sign/verify does.
function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('SESSION_SECRET must be set to at least 32 bytes (see BACKEND_AND_AI_PLAN.md M3).');
  }
  return secret;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString('base64url');
}

function sign(data: string): string {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

/**
 * Creates a signed session token for an existing `Session` row.
 */
export function createSessionToken(
  session: { sid: string; userId: string },
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sid: session.sid, userId: session.userId, iat: now, exp: now + maxAgeSeconds };
  const data = `${base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64UrlEncode(JSON.stringify(payload))}`;
  return `${data}.${sign(data)}`;
}

/**
 * Verifies signature (constant-time) and expiry. Returns null if invalid or expired.
 * Does NOT check revocation; `requireSession` in src/server/http.ts does that against the DB.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expected = Buffer.from(sign(`${encodedHeader}.${encodedPayload}`));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return null; // Tampering detected
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.sid || !payload.userId || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Parses cookies from standard Cookie header string.
 */
export function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(';')) {
    const [name, ...rest] = pair.trim().split('=');
    if (name && rest.length > 0) {
      try {
        cookies[name.trim()] = decodeURIComponent(rest.join('='));
      } catch {
        // malformed cookie value; ignore it
      }
    }
  }
  return cookies;
}

/**
 * Extracts and verifies the session token from the request's cookie (cookie only).
 */
export function getSessionFromRequest(request: Request): SessionPayload | null {
  const token = parseCookieHeader(request.headers.get('cookie'))[SESSION_COOKIE_NAME];
  return token ? verifySessionToken(token) : null;
}

/**
 * Builds Set-Cookie header string for an active session.
 */
export function buildSessionCookieHeader(token: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
    ...(isProd ? ['Secure'] : []),
  ].join('; ');
}

/**
 * Builds Set-Cookie header string to clear/expire session cookie.
 */
export function buildClearSessionCookieHeader(): string {
  const isProd = process.env.NODE_ENV === 'production';
  return [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
    ...(isProd ? ['Secure'] : []),
  ].join('; ');
}

export { SESSION_COOKIE_NAME };
