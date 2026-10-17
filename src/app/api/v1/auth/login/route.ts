/**
 * WealthPilot — Sign in. POST /api/v1/auth/login
 *
 * Same response and timing for unknown email vs wrong password; two rate-limit buckets
 * (per IP, per email); server-side Session row; cookie only (no token in the body).
 */

import { z } from 'zod';
import { prisma } from '@/server/db';
import { handle, parseBody, ok, fail, clientIp, startSession } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { audit } from '@/server/audit';
import { comparePassword, burnPasswordCompare, needsRehash, hashPassword } from '@/lib/auth/password';

const LoginBody = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});

const INVALID = 'Invalid email or password.';

export const POST = handle(async (request) => {
  const { email: rawEmail, password } = await parseBody(request, LoginBody);
  const email = rawEmail.toLowerCase();

  await rateLimit('login:ip', [clientIp(request)], 20, 15 * 60);
  await rateLimit('login:email', [email], 10, 60 * 60);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, passwordHash: true } });
  if (!user?.passwordHash) {
    await burnPasswordCompare(password);
    return fail('UNAUTHORIZED', INVALID, 401);
  }

  if (!(await comparePassword(password, user.passwordHash))) {
    await audit(user.id, 'USER_LOGIN_FAILURE', 'wrong password');
    return fail('UNAUTHORIZED', INVALID, 401);
  }

  if (needsRehash(user.passwordHash)) {
    const passwordHash = await hashPassword(password).catch(() => null); // legacy short passwords keep their hash
    if (passwordHash) await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  }

  await audit(user.id, 'USER_LOGIN_SUCCESS', 'session started');
  const response = ok({ user: { id: user.id, name: user.name, email: user.email } });
  response.headers.set('Set-Cookie', await startSession(user.id));
  return response;
});
