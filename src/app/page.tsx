'use client';

import React, { useState, useEffect } from 'react';
import { FinanceProvider, useFinance } from '../context/FinanceContext';
import { Navigation } from '../components/Navigation';
import { OverviewTab } from '../components/OverviewTab';
import { TransactionsTab } from '../components/TransactionsTab';
import { AccountsTab } from '../components/AccountsTab';
import { BudgetsTab } from '../components/BudgetsTab';
import { GoalsTab } from '../components/GoalsTab';
import { BillsTab } from '../components/BillsTab';
import { PlanningTab } from '../components/PlanningTab';
import { LearnTab } from '../components/LearnTab';
import { ImportTab } from '../components/ImportTab';
import { CopilotTab } from '../components/CopilotTab';
import { AssistantPanel } from '../components/AssistantPanel';
import { SettingsTab } from '../components/SettingsTab';
import { LandingPage } from '../components/LandingPage';
import { AuthModal } from '../components/AuthModal';
import { dollarsToCents } from '../lib/money';
import {
  Compass,
  ShieldCheck,
  Cpu,
  Sparkles,
  Plus,
  X,
  Globe,
} from 'lucide-react';

const TABS = ['overview', 'transactions', 'accounts', 'budgets', 'goals', 'bills', 'planning', 'learn', 'copilot', 'import', 'settings'];

function WealthPilotApp() {
  const [viewMode, setViewMode] = useState<'landing' | 'app'>('landing');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  const { accounts, addTransaction, preferences, isReady, syncError, clearSyncError } = useFinance();

  // The app's own "Reduced motion" setting: globals.css disables animation under this attribute.
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(!!preferences.reducedMotion);
  }, [preferences.reducedMotion]);

  // Error toasts dismiss themselves after 6 s (still dismissible by hand).
  useEffect(() => {
    if (!syncError) return;
    const t = setTimeout(clearSyncError, 6000);
    return () => clearTimeout(t);
  }, [syncError, clearSyncError]);

  // Card spotlight: one delegated listener sets --mx/--my on the hovered card (see .keel-card).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const card = (e.target as Element | null)?.closest?.('.keel-card') as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => document.removeEventListener('pointermove', onMove);
  }, []);

  // Sync hash on mount and hash changes
  useEffect(() => {
    const syncFromHash = () => {
      if (typeof window !== 'undefined') {
        const [view, tab] = window.location.hash.slice(1).split('/');
        if (view === 'app') {
          setViewMode('app');
          if (tab && TABS.includes(tab)) setActiveTab(tab);
        } else if (window.location.hash === '#landing') {
          setViewMode('landing');
        }
      }
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  // The open tab lives in the URL (#app/goals), so Reload and Back return to it instead of Overview.
  useEffect(() => {
    if (viewMode !== 'app') return;
    const target = `#app/${activeTab}`;
    if (window.location.hash === target) return;
    if (window.location.hash.startsWith('#app/')) window.history.pushState(null, '', target);
    else window.history.replaceState(null, '', target);
    window.scrollTo({ top: 0 });
  }, [activeTab, viewMode]);

  const handleSetViewMode = (mode: 'landing' | 'app') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      window.location.hash = mode === 'landing' ? '#landing' : '#app';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Quick Add Form
  const [qDate, setQDate] = useState('2026-10-16');
  const [qMerchant, setQMerchant] = useState('');
  const [qAmount, setQAmount] = useState('');
  const [qType, setQType] = useState<'expense' | 'income'>('expense');
  const [qCategory, setQCategory] = useState('General');
  const [qAccount, setQAccount] = useState(accounts[0]?.id || '');
  const [qNotes, setQNotes] = useState('');

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qMerchant.trim() || !qAmount.trim()) return;

    const baseCents = dollarsToCents(qAmount);
    const amountCents = qType === 'expense' ? -Math.abs(baseCents) : Math.abs(baseCents);

    addTransaction({
      accountId: qAccount || accounts[0]?.id || 'acc_checking',
      financialDate: qDate,
      merchant: qMerchant.trim(),
      normalizedMerchant: qMerchant.trim(),
      category: qCategory.trim() || 'General',
      amountCents,
      currency: 'USD',
      status: 'cleared',
      notes: qNotes.trim() || undefined,
      tags: [],
      isTransfer: false,
      source: 'manual',
    });

    setIsQuickAddOpen(false);
    setQMerchant('');
    setQAmount('');
    setQNotes('');
  };

  // Keyboard shortcut support: quick navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === '1') setActiveTab('overview');
      else if (e.key === '2') setActiveTab('transactions');
      else if (e.key === '3') setActiveTab('accounts');
      else if (e.key === '4') setActiveTab('budgets');
      else if (e.key === '5') setActiveTab('goals');
      else if (e.key === '6') setActiveTab('bills');
      else if (e.key === '7') setActiveTab('planning');
      else if (e.key === '8') setActiveTab('learn');
      else if (e.key === '9') setActiveTab('import');
      else if (e.key === '0') setActiveTab('settings');
      else if (e.key === 'n' || e.key === 'N') setIsQuickAddOpen(true);
      else if (e.key === '/') {
        e.preventDefault();
        setIsAssistantOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (viewMode === 'landing') {
    return (
      <>
        <LandingPage
          onOpenAuth={(mode) => {
            setAuthModalMode(mode || 'signin');
            setAuthModalOpen(true);
          }}
          onLaunchApp={() => handleSetViewMode('app')}
        />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialMode={authModalMode}
          onSuccess={() => handleSetViewMode('app')}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F9] text-[#0F172A] selection:bg-sky-500/20 selection:text-sky-900 relative overflow-x-hidden font-sans">
      {/* Subtle Top Ambient Horizon */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1400px] h-[340px] bg-gradient-to-b from-sky-400/[0.07] via-sky-300/[0.02] to-transparent blur-[120px] pointer-events-none -z-10" />

      {/* Dynamic Navigation Header */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openAddTxModal={() => setIsQuickAddOpen(true)}
        onOpenLanding={() => handleSetViewMode('landing')}
        onOpenAuth={(mode) => {
          setAuthModalMode(mode || 'signin');
          setAuthModalOpen(true);
        }}
      />

      {/* Main Workspace Stage with Generous Spacing and Breathing Room */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-32 sm:pb-24">
        {isReady && !preferences.isAuthenticated && (
          <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
            <span>Demo data — not saved. Changes disappear when you reload.</span>
            <button
              onClick={() => {
                setAuthModalMode('signin');
                setAuthModalOpen(true);
              }}
              className="rounded-full bg-amber-900 px-3 py-1.5 text-white hover:bg-amber-800 cursor-pointer"
            >
              Sign in to save your data
            </button>
          </div>
        )}
        {syncError && (
          <div role="alert" className="wp-pop fixed bottom-24 sm:bottom-6 left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-rose-300 bg-white px-4 py-3 text-xs font-semibold text-rose-800 shadow-lg">
            <span>{syncError}</span>
            <button onClick={clearSyncError} aria-label="Dismiss error" className="rounded-full p-1 text-rose-600 hover:bg-rose-50 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {!isReady ? (
          // Skeleton while the first load runs, instead of flashing demo numbers for signed-in users.
          <div aria-busy="true" aria-label="Loading your workspace" className="space-y-6">
            <div className="wp-skeleton h-10 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="wp-skeleton h-36" />
              <div className="wp-skeleton h-36" />
              <div className="wp-skeleton h-36" />
            </div>
            <div className="wp-skeleton h-72" />
          </div>
        ) : (
          // Keyed by tab so each tab switch replays the entrance animation.
          <div key={activeTab} className="wp-enter">
            {activeTab === 'overview' && (
              <OverviewTab
                setActiveTab={setActiveTab}
                openAddTxModal={() => setIsQuickAddOpen(true)}
              />
            )}
            {activeTab === 'transactions' && <TransactionsTab />}
            {activeTab === 'accounts' && <AccountsTab />}
            {activeTab === 'budgets' && <BudgetsTab />}
            {activeTab === 'goals' && <GoalsTab />}
            {activeTab === 'bills' && <BillsTab />}
            {activeTab === 'planning' && <PlanningTab />}
            {activeTab === 'learn' && <LearnTab />}
            {activeTab === 'copilot' && <CopilotTab onNavigate={setActiveTab} onOpenQuickAdd={() => setIsQuickAddOpen(true)} />}
            {activeTab === 'import' && <ImportTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        )}
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-slate-200/60 py-6 px-4 text-center text-xs text-slate-400 mt-auto">
        © 2026 WealthPilot
      </footer>

      {/* Fast Record Transaction Modal (Frosted Specular Glass Card) */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg keel-card bg-white/95 backdrop-blur-2xl p-7 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-white">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center shadow-xs">
                  <Plus className="w-4.5 h-4.5 text-sky-600" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-[#0F172A]">Record Transaction</h2>
                  <p className="text-xs text-slate-500 font-medium">Manual ledger entry with instant integer reconciliation</p>
                </div>
              </div>
              <button
                onClick={() => setIsQuickAddOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-black hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={qDate}
                    onChange={(e) => setQDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Type</label>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setQType('expense')}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer btn-anim ${
                        qType === 'expense'
                          ? 'bg-rose-50 text-rose-800 border border-rose-300 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Expense (Loss)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQType('income')}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer btn-anim ${
                        qType === 'income'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Income (Profit)
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Merchant / Payee</label>
                  <input
                    type="text"
                    value={qMerchant}
                    onChange={(e) => setQMerchant(e.target.value)}
                    placeholder="e.g. Acme Corp / Apple"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Amount ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={qAmount}
                    onChange={(e) => setQAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-bold text-xs font-money focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Category</label>
                  <input
                    type="text"
                    value={qCategory}
                    onChange={(e) => setQCategory(e.target.value)}
                    placeholder="e.g. Operations, Payroll"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Target Account</label>
                  <select
                    value={qAccount}
                    onChange={(e) => setQAccount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.accountNumberMask})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Notes (Optional)</label>
                <input
                  type="text"
                  value={qNotes}
                  onChange={(e) => setQNotes(e.target.value)}
                  placeholder="Reference memo or voucher ID"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] font-medium text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="flex-1 py-3 rounded-xl btn-glass-anim text-xs text-slate-700 font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl btn-primary-anim btn-shimmer text-xs text-white font-bold transition-all cursor-pointer shadow-md"
                >
                  Commit Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating assistant on every tab (the Copilot tab already shows the same chat) */}
      {isReady && activeTab !== 'copilot' && (
        <AssistantPanel
          open={isAssistantOpen}
          onOpenChange={setIsAssistantOpen}
          onNavigate={(tab) => {
            setActiveTab(tab);
            setIsAssistantOpen(false);
          }}
          onOpenQuickAdd={() => {
            setIsAssistantOpen(false);
            setIsQuickAddOpen(true);
          }}
        />
      )}

      {/* Auth Modal for Sign In / Sign Up */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onSuccess={() => setViewMode('app')}
      />
    </div>
  );
}

export default function Home() {
  return (
    <FinanceProvider>
      <WealthPilotApp />
    </FinanceProvider>
  );
}
