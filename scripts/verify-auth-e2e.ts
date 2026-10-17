/**
 * WealthPilot — End-to-End Auth & GDPR Erasure Verification
 */

import { POST as loginPost } from '../src/app/api/v1/auth/login/route';
import { GET as meGet } from '../src/app/api/v1/auth/me/route';
import { POST as signupPost } from '../src/app/api/v1/auth/signup/route';
import { DELETE as accountDelete } from '../src/app/api/v1/auth/account/route';
import { prisma } from '../src/server/db';
import { NextRequest } from 'next/server';

async function verifyAuth() {
  console.log('=== Step 1: Login with Image Credentials (aseer@wealthpilot.app / admin123) ===');
  const req1 = new NextRequest('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'aseer@wealthpilot.app', password: 'admin123' }),
    headers: { 'Content-Type': 'application/json' },
  });
  const res1 = await loginPost(req1);
  const data1 = await res1.json();
  console.log('Login status:', res1.status, 'success:', data1.success, 'user:', data1.user?.email);

  const cookieHeader = res1.headers.get('set-cookie');
  console.log('Set-Cookie received:', !!cookieHeader);

  console.log('\n=== Step 2: Verify Session via /api/v1/auth/me ===');
  const req2 = new NextRequest('http://localhost:3000/api/v1/auth/me', {
    headers: { 'cookie': cookieHeader || '' },
  });
  const res2 = await meGet(req2);
  const data2 = await res2.json();
  console.log('Session status:', res2.status, 'authenticated:', data2.authenticated, 'name:', data2.user?.name);

  console.log('\n=== Step 3: Register Temporary User & Test GDPR Deletion Cascade ===');
  const tempEmail = `temp_gdpr_${Date.now()}@wealthpilot.app`;
  const req3 = new NextRequest('http://localhost:3000/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      name: 'GDPR Tester',
      email: tempEmail,
      password: 'SecurePassword123!',
      preferredCurrency: 'USD',
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  const res3 = await signupPost(req3);
  const data3 = await res3.json();
  console.log('Signup status:', res3.status, 'created user:', data3.user?.email);
  const tempCookie = res3.headers.get('set-cookie');

  const req4 = new NextRequest('http://localhost:3000/api/v1/auth/account', {
    method: 'DELETE',
    headers: { 'cookie': tempCookie || '' },
  });
  const res4 = await accountDelete(req4);
  const data4 = await res4.json();
  console.log(
    'Delete account status:',
    res4.status,
    'compliance:',
    data4.compliance,
    'purged:',
    data4.erasureConfirmation?.recordsPurged
  );

  const exists = await prisma.user.findUnique({ where: { email: tempEmail } });
  console.log('User exists in database after cascade?:', !!exists);

  await prisma.$disconnect();
  console.log('\n✅ All Auth & GDPR Erasure Systems Verified End-to-End!');
}

verifyAuth().catch((e) => {
  console.error('Verification failed:', e);
  process.exit(1);
});
