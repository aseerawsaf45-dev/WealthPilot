/**
 * WealthPilot — HTTP helpers for every /api/v1 route handler.
 *
 * ok()/fail() envelopes, DB-backed session check (revocable), same-origin CSRF check,
 * Zod body parsing, and a wrapper that never leaks exception details to the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { prisma } from './db';
import {
  getSessionFromRequest,
  createSessionToken,
  buildSessionCookieHeader,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth/session';

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'AI_DISABLED'
  | 'AI_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface AuthedSession {
  userId: string;
  sid: string;
}

/** Throw from anywhere inside a handler to return a clean error response. */
export class HttpError extends Error {
  constructor(public code: ErrorCode, message: string, public status: number, public headers?: HeadersInit) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function fail(code: ErrorCode, message: string, status: number, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ success: false, error: { code, message } }, { status, headers });
}

/** Verifies the cookie token AND that its Session row is still live (logout/delete revoke it). */
export async function requireSession(request: Request): Promise<AuthedSession | NextResponse> {
  const payload = getSessionFromRequest(request);
  if (!payload) return fail('UNAUTHORIZED', 'Please sign in.', 401);

  const session = await prisma.session.findFirst({
    where: { id: payload.sid, userId: payload.userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (!session) return fail('UNAUTHORIZED', 'Your session has ended. Please sign in again.', 401);

  return { userId: payload.userId, sid: payload.sid };
}

/** Creates a Session row and returns the Set-Cookie header value for it. */
export async function startSession(userId: string): Promise<string> {
  const session = await prisma.session.create({
    data: { userId, expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000) },
    select: { id: true },
  });
  return buildSessionCookieHeader(createSessionToken({ sid: session.id, userId }));
}

function extraAllowedOrigins(): string[] {
  const origins: string[] = [];
  if (process.env.APP_URL) origins.push(new URL(process.env.APP_URL).origin);
  if (process.env.VERCEL_URL) origins.push(`https://${process.env.VERCEL_URL}`);
  return origins;
}

/**
 * CSRF defence on top of SameSite=Lax: a browser always sends Origin on cross-site
 * POST/PATCH/PUT/DELETE, so a present Origin must match the host the request was sent to
 * (request.url isn't reliable under `next dev` on 127.0.0.1, a LAN IP or an IDE proxy).
 * Requests without Origin (curl, server-to-server) can't carry a victim's cookie, so they pass.
 */
export function assertSameOrigin(request: Request): NextResponse | null {
  const blocked = () => fail('FORBIDDEN', 'Cross-site request blocked.', 403);
  if (request.headers.get('sec-fetch-site') === 'cross-site') return blocked();

  const origin = request.headers.get('origin');
  if (!origin) return null;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return blocked(); // e.g. "null" from sandboxed or redirected contexts
  }
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (originUrl.host === host || extraAllowedOrigins().includes(originUrl.origin)) return null;
  return blocked();
}

/** Parses a JSON body with Zod; throws a 400 HttpError on failure. */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? `${first.path.join('.')}: ` : '';
    throw new HttpError('VALIDATION_ERROR', `${where}${first?.message ?? 'Invalid request.'}`, 400);
  }
  return parsed.data;
}

/** Client IP only where the platform sets a trustworthy header; otherwise one shared bucket. */
export function clientIp(request: Request): string {
  if (!process.env.VERCEL) return 'local';
  return (
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

type Handler<C> = (request: NextRequest, ctx: C) => Promise<Response>;

/** Origin check for mutations + generic 500s (SEC-06). Every route is wrapped in this. */
export function handle<C>(fn: Handler<C>): Handler<C> {
  return async (request, ctx) => {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        const blocked = assertSameOrigin(request);
        if (blocked) return blocked;
      }
      return await fn(request, ctx);
    } catch (error) {
      if (error instanceof HttpError) return fail(error.code, error.message, error.status, error.headers);
      // Log the error type only: messages can carry query values. Full detail in dev.
      const detail = process.env.NODE_ENV === 'development' ? error : (error as { code?: string; name?: string })?.code ?? (error as Error)?.name;
      console.error(`[api] ${request.method} ${new URL(request.url).pathname} failed:`, detail);
      // Prisma timeouts (P2028/P2024/P1001) roll back, so nothing was saved. P1017 = Neon closed an idle
      // connection (scale-to-zero); the next attempt reconnects.
      const code = (error as { code?: string })?.code;
      if (code === 'P2028' || code === 'P2024' || code === 'P1001') {
        return fail('INTERNAL_ERROR', 'The database is slow to respond right now. Nothing was changed; please try again.', 503);
      }
      if (code === 'P1017') {
        return fail('INTERNAL_ERROR', 'The database connection was reset (it was idle). Please try again.', 503);
      }
      return fail('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
    }
  };
}

/** handle() + requireSession(). The handler receives the session; userId never comes from the client. */
export function authed<C = unknown>(fn: (request: NextRequest, session: AuthedSession, ctx: C) => Promise<Response>): Handler<C> {
  return handle<C>(async (request, ctx) => {
    const session = await requireSession(request);
    if (session instanceof Response) return session;
    return fn(request, session, ctx);
  });
}

export type IdContext = { params: Promise<{ id: string }> };

/** Admins are listed in the ADMIN_EMAILS env variable (comma-separated); nothing the client sends can grant it. */
export function isAdminEmail(email: string | null | undefined): boolean {
  const list = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

/** authed() + the session user must be an admin (403 otherwise). */
export function adminOnly<C = unknown>(fn: (request: NextRequest, session: AuthedSession, ctx: C) => Promise<Response>): Handler<C> {
  return authed<C>(async (request, session, ctx) => {
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } });
    if (!isAdminEmail(user?.email)) return fail('FORBIDDEN', 'Admins only.', 403);
    return fn(request, session, ctx);
  });
}
