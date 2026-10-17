/**
 * WealthPilot — Delete all financial data, keep the login. DELETE /api/v1/user/data  { password }
 */

import { authed, parseBody, ok } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { PasswordConfirm } from '@/server/schemas';
import { assertPassword, clearFinancialData } from '@/server/repos/user';

export const DELETE = authed(async (request, { userId }) => {
  const { password } = await parseBody(request, PasswordConfirm);
  await rateLimit('data:delete', [userId], 3, 60 * 60);
  await assertPassword(userId, password);
  await clearFinancialData(userId);
  return ok({ cleared: true });
});
