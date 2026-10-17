/**
 * WealthPilot — Cryptographic Session Token & Cookie Enclave
 * 
 * Provides stateless, tamper-evident HMAC-SHA256 session tokens with
 * zero external dependencies, compliant with RFC 7519 and OWASP Session Management.
 */

import crypto from 'crypto';

export interface SessionPayload {
  userId: string;
  email: string;
  name?: string;
  preferredCurrency?: string;
  isAiEnabled?: boolean;
  exp: number; // Unix timestamp in seconds
  iat: number; // Issued at
}

const SESSION_COOKIE_NAME = 'wealthpilot_session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.NEON_AUTH_COOKIE_SECRET || 'wealthpilot-audit-standard-secret-key-2026-fintech';

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Creates a signed JWT-compatible session token.
 */
export function createSessionToken(
  user: {
    id: string;
    email: string;
    name?: string | null;
    preferredCurrency?: string;
    isAiEnabled?: boolean;
  },
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name || undefined,
    preferredCurrency: user.preferredCurrency || 'USD',
    isAiEnabled: user.isAiEnabled ?? true,
    iat: now,
    exp: now + maxAgeSeconds,
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${signature}`;
}

/**
 * Verifies and decodes a session token. Returns null if invalid or expired.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSignature) {
    return null; // Tampering detected
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null; // Token expired
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
      cookies[name.trim()] = decodeURIComponent(rest.join('='));
    }
  }
  return cookies;
}

/**
 * Extracts and verifies session payload from an incoming Request.
 */
export function getSessionFromRequest(request: Request): SessionPayload | null {
  // 1. Check Cookie header
  const cookieHeader = request.headers.get('cookie');
  const cookies = parseCookieHeader(cookieHeader);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (cookieToken) {
    const session = verifySessionToken(cookieToken);
    if (session) return session;
  }

  // 2. Fallback to Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();
    const session = verifySessionToken(bearerToken);
    if (session) return session;
  }

  return null;
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
