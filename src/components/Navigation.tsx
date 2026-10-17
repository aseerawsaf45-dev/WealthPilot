'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatMoney } from '../lib/money';
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  PieChart,
  Target,
  CalendarDays,
  TrendingDown,
  Upload,
  ChevronDown,
  GraduationCap,
  Sparkles,
  Settings,
  Menu,
  X,
  Bell,
  Plus,
  Globe,
  ArrowRight,
  LogIn,
  LogOut,
  Trash2,
  Shield,
  CheckCircle,
  Cloud,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openAddTxModal?: () => void;
  onOpenLanding?: () => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
}

export function Navigation({
  activeTab,
  setActiveTab,
  openAddTxModal,
  onOpenLanding,
  onOpenAuth,
}: NavigationProps) {
  const { preferences, logout, bills, budgets, isSaving } = useFinance();
  const displayName = preferences?.userName?.trim() || 'User';
  const displayEmail = preferences?.userEmail?.trim() || 'aseer@wealthpilot.app';
  const isSignedIn = preferences.isAuthenticated === true;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const menusRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false });
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Alerts for the bell: overdue / due-soon bills and budgets over (or near) their limit.
  const alerts = [
    ...bills
      .filter((b) => b.status === 'overdue' || b.status === 'due_soon')
      .map((b) => ({
        id: `bill-${b.id}`,
        tab: 'bills',
        urgent: b.status === 'overdue',
        title: b.status === 'overdue' ? `${b.name} is overdue` : `${b.name} is due soon`,
        detail: `${formatMoney(b.amountCents)} · due ${b.nextDueDate}`,
      })),
    ...budgets
      .filter((b) => b.allocatedCents > 0 && (b.spentCents * 100) / b.allocatedCents >= b.alertThresholdPercent)
      .map((b) => ({
        id: `budget-${b.id}`,
        tab: 'budgets',
        urgent: b.spentCents > b.allocatedCents,
        title: b.spentCents > b.allocatedCents ? `${b.category} is over budget` : `${b.category} is close to its limit`,
        detail: `${formatMoney(b.spentCents)} of ${formatMoney(b.allocatedCents)}`,
      })),
  ];
  const urgentCount = alerts.filter((a) => a.urgent).length;

  // Compact, stronger header once the page scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Sliding active-tab indicator: measure the active button (re-measure on resize).
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const btn = nav.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`);
      // Viewport rects, not offsetLeft: the More button sits inside a wrapper, so offsetLeft would be wrapper-relative.
      const navLeft = nav.getBoundingClientRect().left;
      const r = btn?.getBoundingClientRect();
      setIndicator(r ? { left: r.left - navLeft, width: r.width, visible: true } : (prev) => ({ ...prev, visible: false }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [activeTab]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [moreOpen]);

  // Menus close on Escape and on clicks outside them.
  useEffect(() => {
    if (!userMenuOpen && !bellOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
        setBellOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!menusRef.current?.contains(e.target as Node)) {
        setUserMenuOpen(false);
        setBellOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [userMenuOpen, bellOpen]);

  // Optimized primary navigation items
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'accounts', label: 'Accounts', icon: Wallet },
    { id: 'budgets', label: 'Budgets', icon: PieChart },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'bills', label: 'Bills', icon: CalendarDays },
    { id: 'planning', label: 'Debt Planner', icon: TrendingDown },
    { id: 'copilot', label: 'Copilot', icon: Sparkles },
    { id: 'learn', label: 'Learn', icon: GraduationCap, badge: 'XP' },
    { id: 'import', label: 'Import', icon: Upload },
  ];

  const MORE_IDS = ['planning', 'learn', 'import'];
  const inlineItems = navItems.filter((i) => !MORE_IDS.includes(i.id));
  const moreItems = navItems.filter((i) => MORE_IDS.includes(i.id));
  const activeMore = moreItems.find((i) => i.id === activeTab);

  const handleSelectTab = (id: string) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
    setMoreOpen(false);
  };

  return (
    <>
      {/* Optimized Top Header Bar (Sleek 64px / h-16 Glassmorphism Architecture) */}
      <header
        className={`sticky top-0 z-40 w-full glass-nav border-b border-slate-200/70 transition-shadow duration-300 ${
          scrolled ? 'shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)]' : ''
        }`}
      >
        <div
          className={`max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 flex items-center justify-between gap-3 lg:gap-4 xl:gap-6 transition-[height] duration-300 ${
            scrolled ? 'h-16' : 'h-[76px]'
          }`}
        >
          
          {/* Left Brand Identity: Compact Geometric Logo + Title */}
          <div
            onClick={() => handleSelectTab('overview')}
            className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0 select-none"
          >
            <div className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform duration-200 bg-white p-0.5 border border-slate-200/80">
              <img
                src="/favicon.png"
                alt="WealthPilot"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-[#0F172A]">
                WealthPilot
              </span>
              <span className="hidden xl:inline text-[10px] px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-800 font-bold font-mono">
                v1.0
              </span>
            </div>
          </div>

          {/* Center Navigation Pills (Optimized Sleek Segmented Bar for Desktop/Laptop) */}
          <nav
            ref={navRef}
            aria-label="Primary navigation"
            className="relative hidden md:flex items-center p-1.5 rounded-full glass-segmented gap-1"
          >
            {/* One pill that slides to the active tab */}
            <span
              aria-hidden="true"
              className="absolute top-1.5 bottom-1.5 left-0 rounded-full bg-[#0F172A] shadow-[0_4px_14px_-4px_rgba(15,23,42,0.45)] transition-[transform,width,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width, opacity: indicator.visible ? 1 : 0 }}
            />
            {inlineItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  data-tab={item.id}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => handleSelectTab(item.id)}
                  className={`relative z-10 px-3 xl:px-4 py-2 text-[13px] font-bold rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                    isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        isActive ? 'bg-sky-500 text-white' : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* More: Debt Planner, Learn, Import. Shows the active tab's name when one of them is open. */}
            <div ref={moreRef} className="relative">
              <button
                data-tab={activeMore ? activeMore.id : '__more'}
                onClick={() => setMoreOpen(!moreOpen)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-current={activeMore ? 'page' : undefined}
                className={`relative z-10 px-3 xl:px-4 py-2 text-[13px] font-bold rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                  activeMore ? 'text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                <span>{activeMore ? activeMore.label : 'More'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`} />
              </button>

              {moreOpen && (
                <div
                  role="menu"
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-56 bg-white/95 backdrop-blur-2xl rounded-2xl border border-slate-200/90 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                  {moreItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        role="menuitem"
                        onClick={() => handleSelectTab(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-left transition-colors cursor-pointer ${
                          isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50 hover:text-black'
                        }`}
                      >
                        <Icon className="w-4 h-4 text-sky-600" />
                        <span>{item.label}</span>
                        {item.badge && <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-mono font-bold">{item.badge}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Right Action Controls: Quick Record + Settings + Profile + Mobile Toggle */}
          <div ref={menusRef} className="flex items-center gap-2 xl:gap-2.5 flex-shrink-0">
            {/* Save status: where the data lives and whether a save is in flight */}
            <span
              role="status"
              aria-live="polite"
              className={`hidden xl:inline-flex whitespace-nowrap items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold transition-colors duration-300 ${
                !isSignedIn
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : isSaving
                    ? 'bg-sky-50 border-sky-200 text-sky-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              {!isSignedIn ? (
                <>Demo · not saved</>
              ) : isSaving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3" />
                  Saved
                </>
              )}
            </span>

            {/* Quick Record Button */}
            {openAddTxModal && (
              <button
                onClick={openAddTxModal}
                className="hidden sm:inline-flex btn-primary-anim btn-shimmer items-center gap-1.5 px-3.5 py-1.5 rounded-full text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-sky-400" />
                <span>Record</span>
              </button>
            )}

            {/* Settings Tab Button */}
            <button
              onClick={() => handleSelectTab('settings')}
              className={`p-2 rounded-full transition-all cursor-pointer shadow-2xs ${
                activeTab === 'settings'
                  ? 'bg-[#0F172A] text-white'
                  : 'btn-glass-anim text-slate-600 hover:text-slate-900'
              }`}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Notification Bell: real alerts from bills and budgets */}
            <div className="relative">
              <button
                onClick={() => {
                  setBellOpen(!bellOpen);
                  setUserMenuOpen(false);
                }}
                aria-label={`Notifications${alerts.length ? ` (${alerts.length})` : ''}`}
                aria-expanded={bellOpen}
                aria-haspopup="true"
                className="relative p-2 rounded-full btn-glass-anim text-slate-600 hover:text-slate-900 shadow-2xs cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {alerts.length > 0 && (
                  <span
                    className={`wp-ping absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center ${
                      urgentCount ? 'bg-rose-500' : 'bg-amber-500'
                    }`}
                  >
                    {alerts.length}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-2xl rounded-2xl border border-slate-200/90 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <p className="px-3 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Alerts</p>
                  {alerts.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-4 text-xs font-semibold text-emerald-700">
                      <CheckCircle className="w-4 h-4" />
                      All clear: no bills due soon and every budget is on track.
                    </div>
                  ) : (
                    <ul className="wp-stagger max-h-80 overflow-y-auto">
                      {alerts.map((a) => (
                        <li key={a.id}>
                          <button
                            onClick={() => {
                              handleSelectTab(a.tab);
                              setBellOpen(false);
                            }}
                            className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${a.urgent ? 'text-rose-600' : 'text-amber-600'}`} />
                            <span className="min-w-0">
                              <span className="block text-xs font-bold text-slate-900 truncate">{a.title}</span>
                              <span className="block text-[11px] text-slate-500 font-medium">{a.detail}</span>
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 mt-0.5 ml-auto flex-shrink-0 text-slate-400" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Public Landing Page Button */}
            {onOpenLanding && (
              <button
                onClick={onOpenLanding}
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/90 hover:bg-slate-100 text-slate-700 hover:text-black text-xs font-bold transition-all cursor-pointer border border-slate-200/80 shadow-2xs hover:scale-102 whitespace-nowrap"
                title="View Public Marketing Landing Page"
                aria-label="Landing page"
              >
                <Globe className="w-3.5 h-3.5 text-sky-600" />
                <span className="hidden 2xl:inline">Landing Page</span>
              </button>
            )}

            {/* User Profile Pill / Dropdown Trigger */}
            <div className="relative">
              <button
                onClick={() => {
                  setUserMenuOpen(!userMenuOpen);
                  setBellOpen(false);
                }}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-slate-100/90 hover:bg-slate-200/90 border border-slate-200/80 cursor-pointer transition-all hover:scale-[1.02]"
                title={`Account: ${displayName} (${displayEmail})`}
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-slate-700 hidden sm:inline-block max-w-[80px] truncate">
                  {displayName}
                </span>
              </button>

              {/* Profile Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white/95 backdrop-blur-2xl rounded-2xl border border-slate-200/90 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
                        <p className="text-[11px] font-mono text-slate-500 truncate">{displayEmail}</p>
                      </div>
                    </div>
                    <div
                      className={`mt-2.5 flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-semibold ${
                        isSignedIn ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isSignedIn ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <span>{isSignedIn ? 'Saved to your account (Neon Postgres)' : 'Demo mode: nothing is saved'}</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        handleSelectTab('settings');
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-black hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-slate-500" />
                      <span>Security & Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        if (onOpenAuth) onOpenAuth('signin');
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-black hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <LogIn className="w-4 h-4 text-sky-600" />
                      <span>Switch / Sign In</span>
                    </button>

                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-amber-600" />
                      <span>Sign Out</span>
                    </button>

                    <div className="border-t border-slate-100 my-1" />

                    <button
                      onClick={() => {
                        // Deletion needs password re-entry; the confirm dialog lives in Settings → Danger Zone.
                        handleSelectTab('settings');
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Delete Account (GDPR)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              className="md:hidden p-2 rounded-xl btn-glass-anim text-slate-700 hover:text-black cursor-pointer shadow-2xs"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-sky-600" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden px-4 pt-3 pb-6 bg-white/95 backdrop-blur-2xl border-b border-slate-200/80 shadow-xl animate-in slide-in-from-top-2 duration-200">
            <div className="max-w-md mx-auto space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-2 font-bold">
                Navigation
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[...navItems, { id: 'settings', label: 'Settings', icon: Settings }].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => handleSelectTab(item.id)}
                      className={`min-h-11 flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer text-xs font-bold border btn-anim ${
                        isActive
                          ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200/70 hover:bg-slate-50 hover:text-black'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                            isActive ? 'bg-sky-500/30 text-sky-200' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {openAddTxModal && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openAddTxModal();
                  }}
                  className="w-full py-2.5 rounded-xl btn-primary-anim btn-shimmer font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md mt-2 text-white"
                >
                  <Plus className="w-4 h-4 text-sky-400" />
                  <span>Record Transaction</span>
                </button>
              )}

              {/* Mobile Landing Page & Auth Actions */}
              <div className="pt-2 border-t border-slate-200/80 grid grid-cols-2 gap-2">
                {onOpenLanding && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenLanding();
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5 text-sky-600" />
                    <span>Landing Page</span>
                  </button>
                )}
                {onOpenAuth && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAuth('signin');
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold border border-sky-200 transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5 text-sky-600" />
                    <span>Switch User</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Mobile Floating Bottom Bar for Ergonomic 1-Thumb Reach (Frosted Glass Island) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="sm:hidden fixed bottom-3 left-3 right-3 z-40 bg-white/90 backdrop-blur-2xl border border-slate-200/80 rounded-2xl p-1.5 shadow-lg flex items-center justify-around"
      >
        {[
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'transactions', label: 'Ledger', icon: Receipt },
          { id: 'budgets', label: 'Budgets', icon: PieChart },
          { id: 'goals', label: 'Goals', icon: Target },
          { id: 'learn', label: 'Learn', icon: GraduationCap },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => handleSelectTab(item.id)}
              className={`min-h-11 min-w-11 flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'text-sky-600 bg-sky-50 font-bold'
                  : 'text-slate-600 hover:text-black font-semibold'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
