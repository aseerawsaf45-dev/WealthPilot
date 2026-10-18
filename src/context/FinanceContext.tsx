'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  FinancialAccount,
  Transaction,
  BudgetCategory,
  SavingsGoal,
  BillSubscription,
  DebtAccount,
  UserPreferences,
  AuditEvent,
  CopilotMessage,
  GoalPlanSnapshot,
} from '../types/finance';
import {
  initialAccounts,
  initialTransactions,
  initialBudgets,
  initialGoals,
  initialBills,
  initialDebts,
  defaultPreferences,
} from '../lib/seedData';
import { autoCategorizeMerchant } from '../services/financeService';
import { api, ApiError } from '../lib/api';

/**
 * Signed in: every action calls /api/v1 and applies the SERVER's response to state.
 * Signed out: seed data in memory only ("Demo data — not saved"); nothing touches the server.
 * Errors from signed-in actions land in `syncError` (rendered as a toast by the page).
 */

type NewTransaction = Omit<Transaction, 'id' | 'userId' | 'postedAt'>;

export interface ImportCommitResult {
  batchId: string;
  inserted: number;
  duplicates: number;
  rejected: number;
}

interface Bootstrap {
  preferences: Partial<UserPreferences>;
  accounts: FinancialAccount[];
  transactions: Transaction[];
  budgets: BudgetCategory[];
  goals: SavingsGoal[];
  bills: BillSubscription[];
  debts: DebtAccount[];
  auditLogs: AuditEvent[];
}

interface FinanceContextType {
  accounts: FinancialAccount[];
  transactions: Transaction[];
  budgets: BudgetCategory[];
  goals: SavingsGoal[];
  bills: BillSubscription[];
  debts: DebtAccount[];
  preferences: UserPreferences;
  auditLogs: AuditEvent[];
  copilotHistory: CopilotMessage[];
  isReady: boolean;
  /** True while a save is in flight (signed in). */
  isSaving: boolean;
  syncError: string | null;
  clearSyncError: () => void;

  // Actions
  addTransaction: (tx: NewTransaction) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addAccount: (acc: Omit<FinancialAccount, 'id' | 'userId' | 'lastSyncedAt'>) => Promise<void>;
  updateAccount: (id: string, updates: Partial<FinancialAccount>) => Promise<boolean>;
  /** Without `cascade`, an account with transactions returns { conflict } instead of deleting. */
  removeAccount: (id: string, cascade?: boolean) => Promise<{ success: boolean; conflict?: string }>;
  addBudget: (bgt: Omit<BudgetCategory, 'id'>) => Promise<void>;
  updateBudget: (id: string, updates: Partial<BudgetCategory>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  addGoal: (goal: Omit<SavingsGoal, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  updateGoal: (id: string, updates: Partial<SavingsGoal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  contributeToGoal: (id: string, amountCents: number) => Promise<boolean>;
  /** Calculates and saves the AI plan on the goal; errors are returned for inline display. */
  planGoal: (id: string, targetDate?: string) => Promise<{ plan?: GoalPlanSnapshot; error?: string }>;
  addBill: (bill: Omit<BillSubscription, 'id' | 'userId'>) => Promise<void>;
  updateBill: (id: string, updates: Partial<BillSubscription>) => Promise<boolean>;
  deleteBill: (id: string) => Promise<void>;
  payBill: (id: string) => Promise<boolean>;
  addDebt: (debt: Omit<DebtAccount, 'id' | 'userId'>) => Promise<void>;
  updateDebt: (id: string, updates: Partial<DebtAccount>) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
  refreshAuditLogs: () => Promise<void>;
  commitImportedTransactions: (newTxs: NewTransaction[]) => Promise<ImportCommitResult | null>;
  rollbackImportBatch: (batchId: string) => Promise<boolean>;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  resetToDemoData: () => void;
  clearAllUserData: (password?: string) => Promise<boolean>;
  addCopilotMessage: (msg: CopilotMessage) => void;
  updateCopilotMessage: (id: string, patch: Partial<CopilotMessage>) => void;
  clearCopilotHistory: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, preferredCurrency?: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (password: string) => Promise<{ success: boolean; message?: string }>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const welcomeMessage: CopilotMessage = {
  id: 'init_welcome',
  sender: 'assistant',
  timestamp: '2026-10-16T00:00:00.000Z',
  content: 'Welcome to WealthPilot. I am your grounded financial copilot. Ask me to summarize spending, examine dining expenses, detect potential duplicate charges, or evaluate debt payoff strategies.',
  evidence: {
    scope: 'Ledger Ready',
    transactionCount: initialTransactions.length,
    dateRange: 'Active Period',
    confidence: 'verified_fact',
  },
};

/** Only these keys of a partial update are sent to PATCH endpoints. */
function pick<T extends object>(obj: Partial<T>, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

const UI_PREF_KEYS = ['theme', 'locale', 'dateFormat', 'reducedMotion', 'isDemoMode', 'learn'] as const;

/** Local copy of the server rule (src/server/repos/planning.ts nextDueAfter) for demo mode only. */
function nextDueLocal(ymd: string, frequency: BillSubscription['frequency']): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + (frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12));
  return d.toISOString().slice(0, 10);
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [accounts, setAccounts] = useState<FinancialAccount[]>(initialAccounts);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [budgets, setBudgets] = useState<BudgetCategory[]>(initialBudgets);
  const [goals, setGoals] = useState<SavingsGoal[]>(initialGoals);
  const [bills, setBills] = useState<BillSubscription[]>(initialBills);
  const [debts, setDebts] = useState<DebtAccount[]>(initialDebts);
  const [preferences, setPreferencesState] = useState<UserPreferences>({ ...defaultPreferences, isAuthenticated: false });
  const [copilotHistory, setCopilotHistory] = useState<CopilotMessage[]>([welcomeMessage]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);

  const isAuthed = preferences.isAuthenticated === true;
  const pendingPrefs = useRef<Record<string, unknown>>({});
  const prefsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyBootstrap = (data: Bootstrap) => {
    setAccounts(data.accounts);
    setTransactions(data.transactions);
    setBudgets(data.budgets);
    setGoals(data.goals);
    setBills(data.bills);
    setDebts(data.debts);
    setAuditLogs(data.auditLogs);
    setPreferencesState({ ...defaultPreferences, ...data.preferences, isAuthenticated: true });
  };

  const loadFromServer = useCallback(async () => {
    applyBootstrap(await api.get<Bootstrap>('/bootstrap'));
  }, []);

  const resetToSeed = () => {
    setAccounts(initialAccounts);
    setTransactions(initialTransactions);
    setBudgets(initialBudgets);
    setGoals(initialGoals);
    setBills(initialBills);
    setDebts(initialDebts);
    setAuditLogs([]);
    setCopilotHistory([welcomeMessage]);
    setPreferencesState({ ...defaultPreferences, isAuthenticated: false });
  };

  // On mount: a valid session cookie loads the user's real data; otherwise stay in demo mode.
  useEffect(() => {
    loadFromServer()
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) setSyncError(e instanceof Error ? e.message : 'Could not load your data.');
      })
      .finally(() => setIsReady(true));
  }, [loadFromServer]);

  // Sync: when the tab becomes visible again, reload from the server so changes made in another
  // tab or device show up. A 401 here means the session ended elsewhere.
  useEffect(() => {
    if (!isAuthed) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      loadFromServer().catch((e) => {
        if (e instanceof ApiError && e.status === 401) resetToSeed();
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isAuthed, loadFromServer]);

  /** Runs a server call; a 401 means the session ended, so drop back to demo mode. */
  const run = async (fn: () => Promise<void>): Promise<boolean> => {
    setPendingCount((n) => n + 1); // drives the navbar "Saving…" indicator
    try {
      await fn();
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) resetToSeed();
      setSyncError(e instanceof Error ? e.message : 'Something went wrong.');
      return false;
    } finally {
      setPendingCount((n) => n - 1);
    }
  };

  const replaceAccount = (acc: FinancialAccount | null) => {
    if (acc) setAccounts((prev) => prev.map((a) => (a.id === acc.id ? acc : a)));
  };

  const addTransaction = async (tx: NewTransaction) => {
    if (!isAuthed) {
      const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const category = tx.category === 'General' || !tx.category
        ? autoCategorizeMerchant(tx.merchant, preferences.autoCategorizationRules)
        : tx.category;
      setTransactions((prev) => [
        { ...tx, id, userId: preferences.userId, postedAt: new Date().toISOString(), category, normalizedMerchant: tx.merchant.trim() },
        ...prev,
      ]);
      setAccounts((prev) => prev.map((acc) => (acc.id === tx.accountId ? { ...acc, balanceCents: acc.balanceCents + tx.amountCents } : acc)));
      return;
    }
    await run(async () => {
      const res = await api.post<{ transaction: Transaction; account: FinancialAccount | null }>('/transactions', {
        accountId: tx.accountId,
        financialDate: tx.financialDate,
        merchant: tx.merchant,
        category: tx.category,
        amountCents: tx.amountCents,
        status: tx.status,
        notes: tx.notes || undefined,
        tags: tx.tags,
        isTransfer: tx.isTransfer,
      });
      setTransactions((prev) => [res.transaction, ...prev]);
      replaceAccount(res.account);
    });
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (!isAuthed) {
      const old = transactions.find((t) => t.id === id);
      if (old) {
        const next = { ...old, ...updates };
        setAccounts((prev) =>
          prev.map((acc) => {
            let balance = acc.balanceCents;
            if (acc.id === old.accountId) balance -= old.amountCents;
            if (acc.id === next.accountId) balance += next.amountCents;
            return balance === acc.balanceCents ? acc : { ...acc, balanceCents: balance };
          })
        );
      }
      setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
      return;
    }
    await run(async () => {
      const body = {
        ...pick(updates, ['accountId', 'financialDate', 'merchant', 'category', 'amountCents', 'status', 'notes', 'tags', 'isTransfer']),
        ...(updates.splits && { splits: updates.splits.map((s) => ({ category: s.category, amountCents: s.amountCents, note: s.note || undefined })) }),
      };
      const res = await api.patch<{ transaction: Transaction; account: FinancialAccount | null; previousAccount: FinancialAccount | null }>(
        `/transactions/${encodeURIComponent(id)}`,
        body
      );
      setTransactions((prev) => prev.map((t) => (t.id === id ? res.transaction : t)));
      replaceAccount(res.account);
      replaceAccount(res.previousAccount); // set when the transaction moved to another account
    });
  };

  const deleteTransaction = async (id: string) => {
    if (!isAuthed) {
      const target = transactions.find((t) => t.id === id);
      if (target) {
        setAccounts((prev) => prev.map((acc) => (acc.id === target.accountId ? { ...acc, balanceCents: acc.balanceCents - target.amountCents } : acc)));
      }
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      return;
    }
    await run(async () => {
      const res = await api.del<{ id: string; account: FinancialAccount | null }>(`/transactions/${encodeURIComponent(id)}`);
      setTransactions((prev) => prev.filter((t) => t.id !== res.id));
      replaceAccount(res.account);
    });
  };

  const addAccount = async (acc: Omit<FinancialAccount, 'id' | 'userId' | 'lastSyncedAt'>) => {
    if (!isAuthed) {
      setAccounts((prev) => [...prev, { ...acc, id: `acc_${Date.now()}`, userId: preferences.userId, lastSyncedAt: new Date().toISOString() }]);
      return;
    }
    await run(async () => {
      const created = await api.post<FinancialAccount>('/accounts', {
        name: acc.name,
        institution: acc.institution,
        type: acc.type,
        currency: acc.currency,
        balanceCents: acc.balanceCents,
        accountNumberMask: acc.accountNumberMask,
        isIncludedInNetWorth: acc.isIncludedInNetWorth,
      });
      setAccounts((prev) => [...prev, created]);
    });
  };

  const addBudget = async (bgt: Omit<BudgetCategory, 'id'>) => {
    if (!isAuthed) {
      setBudgets((prev) => [...prev, { ...bgt, id: `bgt_${Date.now()}` }]);
      return;
    }
    await run(async () => {
      const saved = await api.put<BudgetCategory>('/budgets', {
        category: bgt.category,
        allocatedCents: bgt.allocatedCents,
        rolloverEnabled: bgt.rolloverEnabled,
        alertThresholdPercent: bgt.alertThresholdPercent,
      });
      setBudgets((prev) => (prev.some((b) => b.id === saved.id) ? prev.map((b) => (b.id === saved.id ? saved : b)) : [...prev, saved]));
    });
  };

  const updateBudget = async (id: string, updates: Partial<BudgetCategory>) => {
    if (!isAuthed) {
      setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
      return;
    }
    await run(async () => {
      const saved = await api.patch<BudgetCategory>(`/budgets/${encodeURIComponent(id)}`, pick(updates, ['allocatedCents', 'rolloverEnabled', 'alertThresholdPercent']));
      setBudgets((prev) => prev.map((b) => (b.id === id ? saved : b)));
    });
  };

  const addGoal = async (goal: Omit<SavingsGoal, 'id' | 'userId' | 'createdAt'>) => {
    if (!isAuthed) {
      setGoals((prev) => [...prev, { ...goal, id: `goal_${Date.now()}`, userId: preferences.userId, createdAt: new Date().toISOString() }]);
      return;
    }
    await run(async () => {
      const created = await api.post<SavingsGoal>('/goals', {
        name: goal.name,
        targetCents: goal.targetCents,
        currentCents: goal.currentCents,
        targetDate: goal.targetDate,
        category: goal.category,
        priority: goal.priority,
        isPaused: goal.isPaused,
      });
      setGoals((prev) => [...prev, created]);
    });
  };

  const updateGoal = async (id: string, updates: Partial<SavingsGoal>) => {
    if (!isAuthed) {
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
      return;
    }
    await run(async () => {
      const saved = await api.patch<SavingsGoal>(
        `/goals/${encodeURIComponent(id)}`,
        pick(updates, ['name', 'targetCents', 'currentCents', 'targetDate', 'category', 'priority', 'isPaused'])
      );
      setGoals((prev) => prev.map((g) => (g.id === id ? saved : g)));
    });
  };

  const addBill = async (bill: Omit<BillSubscription, 'id' | 'userId'>) => {
    if (!isAuthed) {
      setBills((prev) => [...prev, { ...bill, id: `bill_${Date.now()}`, userId: preferences.userId }]);
      return;
    }
    await run(async () => {
      const created = await api.post<BillSubscription>('/bills', {
        name: bill.name,
        amountCents: bill.amountCents,
        frequency: bill.frequency,
        nextDueDate: bill.nextDueDate,
        category: bill.category,
        accountId: bill.accountId || undefined,
        isAutoPay: bill.isAutoPay,
        status: bill.status === 'paused' ? 'paused' : 'active',
      });
      setBills((prev) => [...prev, created]);
    });
  };

  const addDebt = async (debt: Omit<DebtAccount, 'id' | 'userId'>) => {
    if (!isAuthed) {
      setDebts((prev) => [...prev, { ...debt, id: `debt_${Date.now()}`, userId: preferences.userId }]);
      return;
    }
    await run(async () => {
      const created = await api.post<DebtAccount>('/debts', debt);
      setDebts((prev) => [...prev, created]);
    });
  };

  const updateDebt = async (id: string, updates: Partial<DebtAccount>) => {
    if (!isAuthed) {
      setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
      return;
    }
    await run(async () => {
      const saved = await api.patch<DebtAccount>(
        `/debts/${encodeURIComponent(id)}`,
        pick(updates, ['name', 'balanceCents', 'aprPercent', 'minimumPaymentCents', 'dueDateDay', 'category'])
      );
      setDebts((prev) => prev.map((d) => (d.id === id ? saved : d)));
    });
  };

  const updateAccount = async (id: string, updates: Partial<FinancialAccount>): Promise<boolean> => {
    if (!isAuthed) {
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
      return true;
    }
    return run(async () => {
      const saved = await api.patch<FinancialAccount>(
        `/accounts/${encodeURIComponent(id)}`,
        pick(updates, ['name', 'institution', 'type', 'accountNumberMask', 'isIncludedInNetWorth', 'balanceCents'])
      );
      replaceAccount(saved);
    });
  };

  const removeAccount = async (id: string, cascade = false): Promise<{ success: boolean; conflict?: string }> => {
    const dropLocally = () => {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      setTransactions((prev) => prev.filter((t) => t.accountId !== id));
      setBills((prev) => prev.map((b) => (b.accountId === id ? { ...b, accountId: '' } : b)));
    };
    if (!isAuthed) {
      dropLocally();
      return { success: true };
    }
    try {
      await api.del(`/accounts/${encodeURIComponent(id)}${cascade ? '?cascade=true' : ''}`);
      dropLocally();
      return { success: true };
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return { success: false, conflict: e.message };
      if (e instanceof ApiError && e.status === 401) resetToSeed();
      setSyncError(e instanceof Error ? e.message : 'Could not delete the account.');
      return { success: false };
    }
  };

  const deleteBudget = async (id: string) => {
    if (isAuthed && !(await run(async () => void (await api.del(`/budgets/${encodeURIComponent(id)}`))))) return;
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  };

  const deleteGoal = async (id: string) => {
    if (isAuthed && !(await run(async () => void (await api.del(`/goals/${encodeURIComponent(id)}`))))) return;
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const planGoal = async (id: string, targetDate?: string): Promise<{ plan?: GoalPlanSnapshot; error?: string }> => {
    if (!isAuthed) return { error: 'Sign in to get a plan based on your real income and spending.' };
    setPendingCount((n) => n + 1);
    try {
      const res = await api.post<{ plan: GoalPlanSnapshot; goal: SavingsGoal }>(`/goals/${encodeURIComponent(id)}/plan`, targetDate ? { targetDate } : {});
      setGoals((prev) => prev.map((g) => (g.id === id ? res.goal : g)));
      return { plan: res.plan };
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) resetToSeed();
      return { error: e instanceof Error ? e.message : 'Could not build a plan right now.' };
    } finally {
      setPendingCount((n) => n - 1);
    }
  };

  const contributeToGoal = async (id: string, amountCents: number): Promise<boolean> => {
    if (!isAuthed) {
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, currentCents: Math.max(0, g.currentCents + amountCents) } : g)));
      return true;
    }
    return run(async () => {
      const saved = await api.post<SavingsGoal>(`/goals/${encodeURIComponent(id)}/contributions`, { amountCents });
      setGoals((prev) => prev.map((g) => (g.id === id ? saved : g)));
    });
  };

  const updateBill = async (id: string, updates: Partial<BillSubscription>): Promise<boolean> => {
    if (!isAuthed) {
      setBills((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
      return true;
    }
    return run(async () => {
      const body: Record<string, unknown> = pick(updates, ['name', 'amountCents', 'frequency', 'nextDueDate', 'category', 'accountId', 'isAutoPay']);
      if (updates.status) body.status = updates.status === 'paused' ? 'paused' : 'active';
      const saved = await api.patch<BillSubscription>(`/bills/${encodeURIComponent(id)}`, body);
      setBills((prev) => prev.map((b) => (b.id === id ? saved : b)));
    });
  };

  const deleteBill = async (id: string) => {
    if (isAuthed && !(await run(async () => void (await api.del(`/bills/${encodeURIComponent(id)}`))))) return;
    setBills((prev) => prev.filter((b) => b.id !== id));
  };

  /** Marks the current due date paid: records the expense (if the bill has an account) and moves to the next due date. */
  const payBill = async (id: string): Promise<boolean> => {
    const bill = bills.find((b) => b.id === id);
    if (!bill) return false;
    if (!isAuthed) {
      setBills((prev) => prev.map((b) => (b.id === id ? { ...b, nextDueDate: nextDueLocal(b.nextDueDate, b.frequency), status: 'active' } : b)));
      return true;
    }
    return run(async () => {
      const res = await api.post<{ bill: BillSubscription; transaction: Transaction | null; accountId: string | null }>(
        `/bills/${encodeURIComponent(id)}/pay`,
        { dueDate: bill.nextDueDate }
      );
      setBills((prev) => prev.map((b) => (b.id === id ? res.bill : b)));
      if (res.transaction) {
        setTransactions((prev) => [res.transaction!, ...prev]);
        // The expense changed that account's derived balance; refresh just the accounts.
        setAccounts(await api.get<FinancialAccount[]>('/accounts'));
      }
    });
  };

  const deleteDebt = async (id: string) => {
    if (isAuthed && !(await run(async () => void (await api.del(`/debts/${encodeURIComponent(id)}`))))) return;
    setDebts((prev) => prev.filter((d) => d.id !== id));
  };

  const refreshAuditLogs = async () => {
    if (!isAuthed) return;
    await run(async () => setAuditLogs(await api.get<AuditEvent[]>('/audit?limit=30')));
  };

  const commitImportedTransactions = async (newTxs: NewTransaction[]): Promise<ImportCommitResult | null> => {
    if (!newTxs.length) return null;
    if (!isAuthed) {
      const batchId = `tx_import_${Date.now()}`;
      const prepared: Transaction[] = newTxs.map((t, idx) => ({
        ...t,
        id: `${batchId}_${idx}`,
        userId: preferences.userId,
        postedAt: new Date().toISOString(),
        normalizedMerchant: t.merchant.trim(),
      }));
      setTransactions((prev) => [...prepared, ...prev]);
      return { batchId, inserted: prepared.length, duplicates: 0, rejected: 0 };
    }
    let result: ImportCommitResult | null = null;
    await run(async () => {
      const res = await api.post<{
        batchId: string;
        inserted: number;
        duplicates: number;
        rejected: { index: number; message: string }[];
        transactions: Transaction[];
        account: FinancialAccount | null;
      }>('/transactions/import', {
        accountId: newTxs[0].accountId,
        rows: newTxs.map((t) => ({
          financialDate: t.financialDate,
          merchant: t.merchant,
          amountCents: t.amountCents,
          category: t.category,
          notes: t.notes || undefined,
        })),
      });
      setTransactions((prev) => [...res.transactions, ...prev]);
      replaceAccount(res.account);
      result = { batchId: res.batchId, inserted: res.inserted, duplicates: res.duplicates, rejected: res.rejected.length };
    });
    return result;
  };

  const rollbackImportBatch = async (batchId: string): Promise<boolean> => {
    if (!isAuthed) {
      setTransactions((prev) => prev.filter((t) => !t.id.startsWith(batchId)));
      return true;
    }
    return run(async () => {
      const res = await api.post<{ voidedIds: string[]; accounts: FinancialAccount[] }>(`/transactions/import/${encodeURIComponent(batchId)}/rollback`);
      const voided = new Set(res.voidedIds);
      setTransactions((prev) => prev.filter((t) => !voided.has(t.id)));
      setAccounts(res.accounts);
    });
  };

  const flushPreferences = () => {
    const body = pendingPrefs.current;
    pendingPrefs.current = {};
    if (Object.keys(body).length) void run(async () => void (await api.patch('/user/preferences', body)));
  };

  const setPreferences = (prefs: Partial<UserPreferences>) => {
    setPreferencesState((prev) => ({ ...prev, ...prefs }));
    if (!isAuthed) return;

    // AI is opt-in and has its own consent endpoint (never part of the preferences PATCH).
    if (prefs.isAiEnabled !== undefined) {
      void (async () => {
        const ok = await run(async () => {
          if (!prefs.isAiEnabled) {
            await api.del('/user/ai-consent');
            return;
          }
          // The server checks the saved region before allowing Gemini, so save pending changes first.
          if (prefsTimer.current) clearTimeout(prefsTimer.current);
          const pending = pendingPrefs.current;
          pendingPrefs.current = {};
          if (Object.keys(pending).length) await api.patch('/user/preferences', pending);
          await api.post('/user/ai-consent', { providers: prefs.aiProviders?.length ? prefs.aiProviders : ['groq'] });
        });
        if (!ok && prefs.isAiEnabled) setPreferencesState((prev) => ({ ...prev, isAiEnabled: false, aiProviders: [] }));
      })();
    }

    const p = pendingPrefs.current;
    if (prefs.userName !== undefined && prefs.userName.trim()) p.name = prefs.userName.trim();
    if (prefs.baseCurrency !== undefined) p.preferredCurrency = prefs.baseCurrency;
    if (prefs.timezone !== undefined) p.timezone = prefs.timezone;
    if (prefs.region !== undefined) p.region = prefs.region;
    if (prefs.autoCategorizationRules !== undefined) {
      p.categorizationRules = prefs.autoCategorizationRules.map((r) => ({ keyword: r.keyword, category: r.category }));
    }
    const ui = pick(prefs, [...UI_PREF_KEYS]);
    if (Object.keys(ui).length) p.uiPrefs = { ...(p.uiPrefs as object), ...ui };

    // Debounced so typing a name doesn't send one request per keystroke.
    if (prefsTimer.current) clearTimeout(prefsTimer.current);
    prefsTimer.current = setTimeout(flushPreferences, 600);
  };

  const resetToDemoData = () => {
    if (isAuthed) {
      setSyncError('Demo reset is only available when signed out.');
      return;
    }
    resetToSeed();
  };

  const clearAllUserData = async (password?: string): Promise<boolean> => {
    if (!isAuthed) {
      setAccounts([]);
      setTransactions([]);
      setBudgets([]);
      setGoals([]);
      setBills([]);
      setDebts([]);
      return true;
    }
    let cleared = false;
    await run(async () => {
      await api.del('/user/data', { password: password ?? '' });
      await loadFromServer();
      cleared = true;
    });
    return cleared;
  };

  const addCopilotMessage = (msg: CopilotMessage) => {
    setCopilotHistory((prev) => [...prev, msg]);
  };

  const updateCopilotMessage = (id: string, patch: Partial<CopilotMessage>) => {
    setCopilotHistory((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const clearCopilotHistory = () => {
    setCopilotHistory([]);
  };

  // login/signup throw ApiError so the auth modal can show the message.
  const login = async (email: string, password: string) => {
    await api.post('/auth/login', { email, password });
    await loadFromServer();
  };

  const signup = async (name: string, email: string, password: string, preferredCurrency = 'USD') => {
    await api.post('/auth/signup', { name, email, password, preferredCurrency });
    await loadFromServer();
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => null); // the cookie is cleared server-side; local state resets regardless
    resetToSeed();
  };

  const deleteAccount = async (password: string): Promise<{ success: boolean; message?: string }> => {
    if (!isAuthed) return { success: false, message: 'Sign in to delete your account.' };
    try {
      const res = await api.del<{ message: string }>('/auth/account', { password });
      resetToSeed();
      return { success: true, message: res.message };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : 'Account deletion failed.' };
    }
  };

  return (
    <FinanceContext.Provider
      value={{
        accounts,
        transactions,
        budgets,
        goals,
        bills,
        debts,
        preferences,
        auditLogs,
        copilotHistory,
        isReady,
        isSaving: pendingCount > 0,
        syncError,
        clearSyncError: () => setSyncError(null),
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addAccount,
        updateAccount,
        removeAccount,
        addBudget,
        updateBudget,
        deleteBudget,
        addGoal,
        updateGoal,
        deleteGoal,
        contributeToGoal,
        planGoal,
        addBill,
        updateBill,
        deleteBill,
        payBill,
        addDebt,
        updateDebt,
        deleteDebt,
        refreshAuditLogs,
        commitImportedTransactions,
        rollbackImportBatch,
        setPreferences,
        resetToDemoData,
        clearAllUserData,
        addCopilotMessage,
        updateCopilotMessage,
        clearCopilotHistory,
        login,
        signup,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within a FinanceProvider');
  return ctx;
}
