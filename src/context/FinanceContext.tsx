'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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
import { logAuditEvent } from '../services/auditService';
import { autoCategorizeMerchant } from '../services/financeService';
import { generateTransactionFingerprint } from '../services/importService';

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
  
  // Actions
  addTransaction: (tx: Omit<Transaction, 'id' | 'userId' | 'postedAt'>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addAccount: (acc: Omit<FinancialAccount, 'id' | 'userId' | 'lastSyncedAt'>) => void;
  addBudget: (bgt: Omit<BudgetCategory, 'id'>) => void;
  updateBudget: (id: string, updates: Partial<BudgetCategory>) => void;
  addGoal: (goal: Omit<SavingsGoal, 'id' | 'userId' | 'createdAt'>) => void;
  updateGoal: (id: string, updates: Partial<SavingsGoal>) => void;
  addBill: (bill: Omit<BillSubscription, 'id' | 'userId'>) => void;
  addDebt: (debt: Omit<DebtAccount, 'id' | 'userId'>) => void;
  updateDebt: (id: string, updates: Partial<DebtAccount>) => void;
  commitImportedTransactions: (newTxs: Omit<Transaction, 'id' | 'userId' | 'postedAt'>[]) => void;
  rollbackImportBatch: (importTimestampPrefix: string) => void;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  resetToDemoData: () => void;
  clearAllUserData: () => void;
  addCopilotMessage: (msg: CopilotMessage) => void;
  clearCopilotHistory: () => void;
  login: (name: string, email: string) => void;
  signup: (name: string, email: string) => void;
  logout: () => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'wealthpilot_v1_';

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [accounts, setAccounts] = useState<FinancialAccount[]>(initialAccounts);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [budgets, setBudgets] = useState<BudgetCategory[]>(initialBudgets);
  const [goals, setGoals] = useState<SavingsGoal[]>(initialGoals);
  const [bills, setBills] = useState<BillSubscription[]>(initialBills);
  const [debts, setDebts] = useState<DebtAccount[]>(initialDebts);
  const [preferences, setPreferencesState] = useState<UserPreferences>(defaultPreferences);
  const [copilotHistory, setCopilotHistory] = useState<CopilotMessage[]>([
    {
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
    },
  ]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);

  // Load from local storage on client mount
  useEffect(() => {
    try {
      const savedAccounts = localStorage.getItem(`${STORAGE_KEY_PREFIX}accounts`);
      const savedTxs = localStorage.getItem(`${STORAGE_KEY_PREFIX}transactions`);
      const savedBudgets = localStorage.getItem(`${STORAGE_KEY_PREFIX}budgets`);
      const savedGoals = localStorage.getItem(`${STORAGE_KEY_PREFIX}goals`);
      const savedBills = localStorage.getItem(`${STORAGE_KEY_PREFIX}bills`);
      const savedDebts = localStorage.getItem(`${STORAGE_KEY_PREFIX}debts`);
      const savedPrefs = localStorage.getItem(`${STORAGE_KEY_PREFIX}prefs`);

      if (savedAccounts) setAccounts(JSON.parse(savedAccounts));
      if (savedTxs) setTransactions(JSON.parse(savedTxs));
      if (savedBudgets) setBudgets(JSON.parse(savedBudgets));
      if (savedGoals) setGoals(JSON.parse(savedGoals));
      if (savedBills) setBills(JSON.parse(savedBills));
      if (savedDebts) setDebts(JSON.parse(savedDebts));
      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs);
        setPreferencesState({
          ...defaultPreferences,
          ...parsed,
          userName: parsed.userName ?? defaultPreferences.userName,
        });
      }
    } catch (e) {
      console.warn('Using initial seed data', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save changes to local storage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}accounts`, JSON.stringify(accounts));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}transactions`, JSON.stringify(transactions));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}budgets`, JSON.stringify(budgets));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}goals`, JSON.stringify(goals));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}bills`, JSON.stringify(bills));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}debts`, JSON.stringify(debts));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}prefs`, JSON.stringify(preferences));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }, [accounts, transactions, budgets, goals, bills, debts, preferences, isLoaded]);

  const addTransaction = (tx: Omit<Transaction, 'id' | 'userId' | 'postedAt'>) => {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const category = tx.category === 'General' || !tx.category
      ? autoCategorizeMerchant(tx.merchant, preferences.autoCategorizationRules)
      : tx.category;

    const newTx: Transaction = {
      ...tx,
      id,
      userId: preferences.userId,
      postedAt: new Date().toISOString(),
      category,
      normalizedMerchant: tx.merchant.trim(),
      importFingerprint: generateTransactionFingerprint(tx.financialDate, tx.merchant, tx.amountCents),
    };

    setTransactions((prev) => [newTx, ...prev]);

    // Update account balance
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === tx.accountId
          ? { ...acc, balanceCents: acc.balanceCents + tx.amountCents }
          : acc
      )
    );

    logAuditEvent('TRANSACTION_CREATED', 'transaction', id, `Added transaction: ${tx.merchant} (${tx.amountCents / 100})`);
  };

  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
    logAuditEvent('TRANSACTION_UPDATED', 'transaction', id, `Updated transaction attributes`);
  };

  const deleteTransaction = (id: string) => {
    const target = transactions.find((t) => t.id === id);
    if (target) {
      // Revert account balance
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === target.accountId
            ? { ...acc, balanceCents: acc.balanceCents - target.amountCents }
            : acc
        )
      );
    }
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    logAuditEvent('TRANSACTION_DELETED', 'transaction', id, `Deleted transaction`);
  };

  const addAccount = (acc: Omit<FinancialAccount, 'id' | 'userId' | 'lastSyncedAt'>) => {
    const id = `acc_${Date.now()}`;
    const newAcc: FinancialAccount = {
      ...acc,
      id,
      userId: preferences.userId,
      lastSyncedAt: new Date().toISOString(),
    };
    setAccounts((prev) => [...prev, newAcc]);
    logAuditEvent('ACCOUNT_CREATED', 'financial_account', id, `Added ${acc.name} (${acc.type})`);
  };

  const addBudget = (bgt: Omit<BudgetCategory, 'id'>) => {
    const id = `bgt_${Date.now()}`;
    setBudgets((prev) => [...prev, { ...bgt, id }]);
    logAuditEvent('BUDGET_CREATED', 'budget', id, `Created budget for ${bgt.category}`);
  };

  const updateBudget = (id: string, updates: Partial<BudgetCategory>) => {
    setBudgets((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  const addGoal = (goal: Omit<SavingsGoal, 'id' | 'userId' | 'createdAt'>) => {
    const id = `goal_${Date.now()}`;
    setGoals((prev) => [
      ...prev,
      {
        ...goal,
        id,
        userId: preferences.userId,
        createdAt: new Date().toISOString(),
      },
    ]);
    logAuditEvent('GOAL_CREATED', 'savings_goal', id, `Created goal: ${goal.name}`);
  };

  const updateGoal = (id: string, updates: Partial<SavingsGoal>) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...updates } : g))
    );
  };

  const addBill = (bill: Omit<BillSubscription, 'id' | 'userId'>) => {
    const id = `bill_${Date.now()}`;
    setBills((prev) => [
      ...prev,
      {
        ...bill,
        id,
        userId: preferences.userId,
      },
    ]);
    logAuditEvent('BILL_CREATED', 'bill', id, `Created recurring bill: ${bill.name}`);
  };

  const addDebt = (debt: Omit<DebtAccount, 'id' | 'userId'>) => {
    const id = `debt_${Date.now()}`;
    setDebts((prev) => [
      ...prev,
      {
        ...debt,
        id,
        userId: preferences.userId,
      },
    ]);
    logAuditEvent('DEBT_CREATED', 'debt_account', id, `Created debt: ${debt.name}`);
  };

  const updateDebt = (id: string, updates: Partial<DebtAccount>) => {
    setDebts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  };

  const commitImportedTransactions = (newTxs: Omit<Transaction, 'id' | 'userId' | 'postedAt'>[]) => {
    const timestamp = Date.now();
    const prepared: Transaction[] = newTxs.map((t, idx) => ({
      ...t,
      id: `tx_import_${timestamp}_${idx}`,
      userId: preferences.userId,
      postedAt: new Date().toISOString(),
      normalizedMerchant: t.merchant.trim(),
      importFingerprint: generateTransactionFingerprint(t.financialDate, t.merchant, t.amountCents),
    }));

    setTransactions((prev) => [...prepared, ...prev]);
    logAuditEvent('CSV_IMPORTED', 'import_batch', `batch_${timestamp}`, `Imported ${prepared.length} transactions`);
  };

  const rollbackImportBatch = (importTimestampPrefix: string) => {
    setTransactions((prev) => prev.filter((t) => !t.id.startsWith(importTimestampPrefix)));
    logAuditEvent('IMPORT_ROLLBACK', 'import_batch', importTimestampPrefix, `Rolled back import batch`);
  };

  const setPreferences = (prefs: Partial<UserPreferences>) => {
    setPreferencesState((prev) => ({ ...prev, ...prefs }));
    logAuditEvent('PREFERENCES_UPDATED', 'user_preference', preferences.userId, `Updated preferences`);
  };

  const resetToDemoData = () => {
    setAccounts(initialAccounts);
    setTransactions(initialTransactions);
    setBudgets(initialBudgets);
    setGoals(initialGoals);
    setBills(initialBills);
    setDebts(initialDebts);
    setPreferencesState(defaultPreferences);
    logAuditEvent('DEMO_RESET', 'system', 'system', 'Reset workspace to initial demo state');
  };

  const clearAllUserData = () => {
    setAccounts([]);
    setTransactions([]);
    setBudgets([]);
    setGoals([]);
    setBills([]);
    setDebts([]);
    logAuditEvent('USER_DATA_PURGED', 'system', 'system', 'Purged all local user data and ledgers');
  };

  const addCopilotMessage = (msg: CopilotMessage) => {
    setCopilotHistory((prev) => [...prev, msg]);
  };

  const clearCopilotHistory = () => {
    setCopilotHistory([]);
    logAuditEvent('COPILOT_HISTORY_CLEARED', 'ai_copilot', 'history', 'Cleared copilot chat history');
  };

  const login = (name: string, email: string) => {
    const finalName = name.trim() || preferences.userName || 'Aseer';
    const finalEmail = email.trim() || preferences.userEmail || 'pilot@wealthpilot.app';
    setPreferencesState((prev) => ({
      ...prev,
      userName: finalName,
      userEmail: finalEmail,
      isAuthenticated: true,
    }));
    logAuditEvent('USER_LOGIN', 'auth', preferences.userId, `User ${finalName} logged in`);
  };

  const signup = (name: string, email: string) => {
    const finalName = name.trim() || 'Pilot';
    const finalEmail = email.trim() || 'pilot@wealthpilot.app';
    setPreferencesState((prev) => ({
      ...prev,
      userName: finalName,
      userEmail: finalEmail,
      isAuthenticated: true,
    }));
    logAuditEvent('USER_SIGNUP', 'auth', preferences.userId, `New account initialized for ${finalName}`);
  };

  const logout = () => {
    setPreferencesState((prev) => ({
      ...prev,
      isAuthenticated: false,
    }));
    logAuditEvent('USER_LOGOUT', 'auth', preferences.userId, 'User session logged out');
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
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addAccount,
        addBudget,
        updateBudget,
        addGoal,
        updateGoal,
        addBill,
        addDebt,
        updateDebt,
        commitImportedTransactions,
        rollbackImportBatch,
        setPreferences,
        resetToDemoData,
        clearAllUserData,
        addCopilotMessage,
        clearCopilotHistory,
        login,
        signup,
        logout,
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
