/**
 * WealthPilot — AI privacy gateway (plan §7.2).
 *
 * canUseLlm() is the ONE gate for every outbound model call (deny by default).
 * redactForLlm() runs on every string that leaves the server.
 */

import { scanAndRedactNpi } from '@/lib/compliance/glbaCompliance';
import { scanAndEnforcePciDssScope } from '@/lib/compliance/pciDssCompliance';

export const CURRENT_AI_NOTICE = 'ai-notice-v1';
export type Provider = 'groq' | 'gemini';

export interface AiConsentState {
  isAiEnabled: boolean;
  aiConsentAt: Date | null;
  aiConsentVersion: string | null;
  aiProviders: string[];
  region: string | null;
}

// Google's free (Unpaid Services) tier may not be used for EEA/UK/CH users; CN: unreachable + PIPL transfer rules.
const GEMINI_BLOCKED_REGIONS = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH', 'CN',
]);

/** Gemini only with a declared region outside the blocked list (region = null → denied). */
export function allowGemini(user: Pick<AiConsentState, 'region'>): boolean {
  return !!user.region && !GEMINI_BLOCKED_REGIONS.has(user.region);
}

/** Read the user from the DB (not the session token) before calling this. */
export function canUseLlm(user: AiConsentState, provider: Provider): boolean {
  const consented =
    user.isAiEnabled &&
    !!user.aiConsentAt &&
    user.aiConsentVersion === CURRENT_AI_NOTICE &&
    user.aiProviders.includes(provider);
  return consented && (provider !== 'gemini' || allowGemini(user));
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;

/** Strips NPI (SSN, secrets, account numbers), card numbers, emails and phone numbers. */
export function redactForLlm(text: string): string {
  const npi = scanAndRedactNpi(text).sanitizedText;
  const pci = scanAndEnforcePciDssScope(npi).sanitizedText;
  return pci.replace(EMAIL, '[REDACTED_EMAIL]').replace(PHONE, '[REDACTED_PHONE]');
}
