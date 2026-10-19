/**
 * WealthPilot — Full data export (GDPR Art. 20). GET /api/v1/user/export → JSON download.
 */

import { NextResponse } from 'next/server';
import { authed } from '@/server/http';
import { rateLimit } from '@/server/rateLimit';
import { exportUserData } from '@/server/repos/user';

export const GET = authed(async (_request, { userId }) => {
  await rateLimit('export', [userId], 5, 3600);
  const data = await exportUserData(userId);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="wealthpilot-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'cache-control': 'no-store',
    },
  });
});
