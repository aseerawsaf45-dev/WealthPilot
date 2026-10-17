/**
 * WealthPilot — Zod input schemas for /api/v1 (trust boundary).
 * Money is always an integer number of minor units. Patch schemas have no defaults,
 * so an omitted field is never overwritten.
 */

import { z } from 'zod';
import { scanAndEnforcePciDssScope } from '@/lib/compliance/pciDssCompliance';

export const money = z.number().int().safe();
const nonNegMoney = money.nonnegative();

export const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), 'Invalid date');

export const monthYear = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');

const text = (max: number) => z.string().trim().min(1).max(max);

/** Free text that must never contain a card number (PCI scope stays at zero). */
const noPan = (max: number) =>
  z.string().trim().max(max).refine((s) => scanAndEnforcePciDssScope(s).isCompliant, 'Remove card numbers from this field');

export const Currency = z.enum(['USD', 'BDT', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY']);
const id = z.string().min(1).max(40);

// ---- Accounts ---------------------------------------------------------------
export const AccountInput = z.object({
  name: text(80),
  institution: text(80),
  type: z.enum(['checking', 'savings', 'credit', 'investment', 'cash', 'loan']),
  currency: Currency.default('USD'),
  balanceCents: money, // becomes openingBalanceCents; the live balance is derived
  accountNumberMask: z.string().trim().regex(/^[•*]{0,4}\s?\d{4}$/, 'Enter only the last 4 digits (e.g. •••• 1234)'),
  isIncludedInNetWorth: z.boolean().default(true),
});

/** balanceCents here is the desired CURRENT balance; the server derives the opening balance from it. */
export const AccountPatch = z
  .object({
    name: text(80),
    institution: text(80),
    type: z.enum(['checking', 'savings', 'credit', 'investment', 'cash', 'loan']),
    accountNumberMask: z.string().trim().regex(/^[•*]{0,4}\s?\d{4}$/, 'Enter only the last 4 digits (e.g. •••• 1234)'),
    isIncludedInNetWorth: z.boolean(),
    balanceCents: money,
  })
  .partial();

// ---- Transactions -----------------------------------------------------------
const txStatus = z.enum(['cleared', 'pending', 'reconciled']);
const tags = z.array(z.string().trim().max(30)).max(10);

export const TransactionInput = z.object({
  accountId: id,
  financialDate: ymd,
  merchant: noPan(120).pipe(z.string().min(1)),
  category: z.string().trim().max(60).default('General'),
  amountCents: money,
  status: txStatus.default('cleared'),
  notes: noPan(500).optional(),
  tags: tags.default([]),
  isTransfer: z.boolean().default(false),
});

export const SplitInput = z.object({
  category: text(60),
  amountCents: money,
  note: noPan(200).optional(),
});

export const TransactionPatch = z
  .object({
    accountId: id,
    financialDate: ymd,
    merchant: noPan(120).pipe(z.string().min(1)),
    category: text(60),
    amountCents: money,
    status: txStatus,
    notes: noPan(500),
    tags,
    isTransfer: z.boolean(),
    splits: z.array(SplitInput).max(20),
  })
  .partial();

export const ImportRow = z.object({
  financialDate: ymd,
  merchant: noPan(120).pipe(z.string().min(1)),
  amountCents: money,
  category: z.string().trim().max(60).default('General'),
  notes: noPan(500).optional(),
});

export const ImportInput = z.object({
  accountId: id,
  rows: z.array(z.unknown()).min(1).max(2000), // each row is validated on its own so bad rows are reported, not dropped
});

// ---- Planning ---------------------------------------------------------------
export const BudgetInput = z.object({
  category: text(60),
  allocatedCents: nonNegMoney,
  rolloverEnabled: z.boolean().default(false),
  alertThresholdPercent: z.number().int().min(1).max(100).default(85),
});

export const BudgetPatch = z
  .object({ allocatedCents: nonNegMoney, rolloverEnabled: z.boolean(), alertThresholdPercent: z.number().int().min(1).max(100) })
  .partial();

const priority = z.enum(['low', 'medium', 'high']);
export const GoalInput = z.object({
  name: text(80),
  targetCents: nonNegMoney,
  currentCents: nonNegMoney.default(0),
  targetDate: ymd.optional(),
  category: text(60),
  priority: priority.default('medium'),
  isPaused: z.boolean().default(false),
});

export const GoalPatch = z
  .object({
    name: text(80),
    targetCents: nonNegMoney,
    currentCents: nonNegMoney,
    targetDate: ymd.nullable(),
    category: text(60),
    priority,
    isPaused: z.boolean(),
  })
  .partial();

export const BillInput = z.object({
  name: text(80),
  amountCents: nonNegMoney,
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annual']),
  nextDueDate: ymd,
  category: text(60),
  accountId: z.string().max(40).optional(), // '' = no account
  isAutoPay: z.boolean().default(false),
  status: z.enum(['active', 'paused']).default('active'),
});

export const BillPatch = z
  .object({
    name: text(80),
    amountCents: nonNegMoney,
    frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annual']),
    nextDueDate: ymd,
    category: text(60),
    accountId: z.string().max(40), // '' = no account
    isAutoPay: z.boolean(),
    status: z.enum(['active', 'paused']),
  })
  .partial();

/** dueDate must equal the bill's current nextDueDate: makes "mark paid" idempotent (a second click is a 409). */
export const BillPayInput = z.object({ dueDate: ymd, recordTransaction: z.boolean().default(true) });

/** Positive adds money to a goal, negative withdraws. */
export const GoalContributionInput = z.object({ amountCents: money.refine((v) => v !== 0, 'Enter an amount') });

const debtCategory =z.enum(['credit_card', 'student_loan', 'car_loan', 'mortgage', 'personal_loan']);
export const DebtInput = z.object({
  name: text(80),
  balanceCents: nonNegMoney,
  aprPercent: z.number().min(0).max(100), // a rate, never summed
  minimumPaymentCents: nonNegMoney,
  dueDateDay: z.number().int().min(1).max(31),
  category: debtCategory,
});
export const DebtPatch = DebtInput.partial();

// ---- User -------------------------------------------------------------------
export const PreferencesPatch = z
  .object({
    name: text(100),
    preferredCurrency: Currency,
    timezone: z
      .string()
      .max(64)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, 'Unknown timezone'),
    region: z.string().regex(/^[A-Z]{2}$/, 'Use a 2-letter country code').nullable(),
    uiPrefs: z
      .object({
        theme: z.enum(['dark', 'light', 'system']),
        locale: z.string().max(20),
        dateFormat: z.string().max(20),
        reducedMotion: z.boolean(),
        isDemoMode: z.boolean(),
        learn: z.object({
          xp: z.number().int().min(0).max(1_000_000),
          streak: z.number().int().min(0).max(10_000),
          completed: z.array(z.string().max(60)).max(200),
        }),
      })
      .partial()
      .strict(),
    categorizationRules: z.array(z.object({ keyword: text(60), category: text(60) })).max(100),
  })
  .partial();

export const AiConsentInput = z.object({
  providers: z.array(z.enum(['groq', 'gemini'])).min(1).max(2).default(['groq']),
});

export const PasswordConfirm = z.object({ password: z.string().min(1).max(128) });
