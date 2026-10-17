/**
 * WealthPilot — User repository: profile, preferences, AI consent, data erasure, audit view.
 */

import type { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { writeAudit, pepperHash } from '../audit';
import { HttpError } from '../http';
import { toClientAudit, todayIn } from '../mappers';
import { PreferencesPatch } from '../schemas';
import { comparePassword } from '@/lib/auth/password';
import type { UserPreferences } from '@/types/finance';

export const CURRENT_AI_NOTICE = 'ai-notice-v1';
// Gemini free tier may not be used for these regions (Google Unpaid Services terms; CN: unreachable + PIPL).
const GEMINI_BLOCKED_REGIONS = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH', 'CN']);

const profileSelect = {
  id: true,
  name: true,
  email: true,
  preferredCurrency: true,
  timezone: true,
  region: true,
  isAiEnabled: true,
  uiPrefs: true,
  merchantRules: { select: { normalizedMerchant: true, category: true }, orderBy: { updatedAt: 'asc' } },
} satisfies Prisma.UserSelect;

type ProfileRow = Prisma.UserGetPayload<{ select: typeof profileSelect }>;

/** Server-known preference fields; the client merges them over its UI defaults. */
function toClientPreferences(user: ProfileRow): Partial<UserPreferences> & { region: string | null } {
  const ui = (user.uiPrefs ?? {}) as Partial<UserPreferences>;
  return {
    ...ui,
    userId: user.id,
    userName: user.name ?? '',
    userEmail: user.email,
    isAuthenticated: true,
    baseCurrency: user.preferredCurrency,
    timezone: user.timezone,
    region: user.region,
    isAiEnabled: user.isAiEnabled,
    autoCategorizationRules: user.merchantRules.map((r) => ({ id: r.normalizedMerchant, keyword: r.normalizedMerchant, category: r.category })),
  };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!user) throw new HttpError('UNAUTHORIZED', 'Please sign in.', 401);
  return { timezone: user.timezone, preferences: toClientPreferences(user) };
}

export async function updatePreferences(userId: string, patch: z.infer<typeof PreferencesPatch>) {
  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { uiPrefs: true } });
    await tx.user.update({
      where: { id: userId },
      data: {
        name: patch.name,
        preferredCurrency: patch.preferredCurrency,
        timezone: patch.timezone,
        region: patch.region,
        uiPrefs: patch.uiPrefs ? { ...(current.uiPrefs as object), ...patch.uiPrefs } : undefined,
      },
    });
    if (patch.categorizationRules) {
      await tx.merchantRule.deleteMany({ where: { userId } });
      await tx.merchantRule.createMany({
        data: patch.categorizationRules.map((r) => ({ userId, normalizedMerchant: r.keyword.toLowerCase(), category: r.category })),
        skipDuplicates: true,
      });
    }
    await writeAudit(tx, userId, 'PREFERENCES_UPDATED', `fields=${Object.keys(patch).join(',')}`);
  });
  return getProfile(userId);
}

/** The ONLY write path for isAiEnabled (SEC-11). */
export async function grantAiConsent(userId: string, providers: string[]) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { region: true } });
  if (providers.includes('gemini') && (!user.region || GEMINI_BLOCKED_REGIONS.has(user.region))) {
    throw new HttpError('VALIDATION_ERROR', 'Gemini is not available for your region. Set your region or use Groq only.', 400);
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { isAiEnabled: true, aiConsentAt: new Date(), aiConsentVersion: CURRENT_AI_NOTICE, aiProviders: providers },
    });
    await writeAudit(tx, userId, 'AI_CONSENT_GRANTED', `version=${CURRENT_AI_NOTICE} providers=${providers.join(',')}`);
  });
  return getProfile(userId);
}

export async function revokeAiConsent(userId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isAiEnabled: false, aiConsentAt: null, aiProviders: [] } });
    await writeAudit(tx, userId, 'AI_CONSENT_REVOKED', 'ai=off');
  });
  return getProfile(userId);
}

/** Password re-entry for destructive actions. 403 (not 401) so the client doesn't treat it as a logout. */
export async function assertPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user?.passwordHash || !(await comparePassword(password, user.passwordHash))) {
    throw new HttpError('FORBIDDEN', 'Password is incorrect.', 403);
  }
}

/** Deletes financial rows, keeps the login, preferences and audit trail. */
export async function clearFinancialData(userId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.billSubscription.deleteMany({ where: { userId } });
    await tx.financialAccount.deleteMany({ where: { userId } }); // cascades transactions + splits
    await tx.budgetCategory.deleteMany({ where: { userId } });
    await tx.savingsGoal.deleteMany({ where: { userId } });
    await tx.debtAccount.deleteMany({ where: { userId } });
    await tx.copilotMessage.deleteMany({ where: { userId } });
    await writeAudit(tx, userId, 'USER_DATA_CLEARED', 'financial data deleted by user');
  });
}

/** GDPR Art. 17: cascade delete + one pseudonymous receipt that proves the erasure happened. */
export async function eraseUser(userId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.user.delete({ where: { id: userId } }); // cascades every relation incl. sessions
    await tx.auditEvent.create({
      data: { userId: null, eventType: 'ACCOUNT_ERASED', actor: 'SYSTEM', details: pepperHash(userId), checksumAfter: pepperHash(`erased|${userId}`) },
    });
  });
}

export async function listAudit(userId: string, limit = 30) {
  const rows = await prisma.auditEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit });
  return rows.map(toClientAudit);
}

/** "Today" (YYYY-MM-DD) in the user's own timezone, never server UTC. */
export async function userToday(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return todayIn(user?.timezone ?? 'UTC');
}
