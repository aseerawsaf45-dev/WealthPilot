'use client';

import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  PieChart,
  Target,
  CalendarDays,
  TrendingDown,
  Upload,
  GraduationCap,
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
  const { preferences, logout, deleteAccount } = useFinance();
  const displayName = preferences?.userName?.trim() || 'User';
  const displayEmail = preferences?.userEmail?.trim() || 'aseer@wealthpilot.app';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Optimized primary navigation items
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'accounts', label: 'Accounts', icon: Wallet },
    { id: 'budgets', label: 'Budgets', icon: PieChart },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'bills', label: 'Bills', icon: CalendarDays },
    { id: 'planning', label: 'Debt Planner', icon: TrendingDown },
    { id: 'learn', label: 'Learn', icon: GraduationCap, badge: 'XP' },
    { id: 'import', label: 'Import', icon: Upload },
  ];

  const handleSelectTab = (id: string) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Optimized Top Header Bar (Sleek 64px / h-16 Glassmorphism Architecture) */}
      <header className="sticky top-0 z-40 w-full glass-nav border-b border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4">
          
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
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-800 font-bold font-mono">
                v1.0
              </span>
            </div>
          </div>

          {/* Center Navigation Pills (Optimized Sleek Segmented Bar for Desktop/Laptop) */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center p-1 rounded-full glass-segmented gap-0.5 overflow-x-auto scrollbar-none"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-200 cursor-pointer flex-shrink-0 whitespace-nowrap btn-anim flex items-center gap-1 ${
                    isActive
                      ? 'bg-[#0F172A] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
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
          </nav>

          {/* Right Action Controls: Quick Record + Settings + Profile + Mobile Toggle */}
          <div className="flex items-center gap-2">
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

            {/* Notification Bell */}
            <button
              className="p-2 rounded-full btn-glass-anim text-slate-600 hover:text-slate-900 shadow-2xs cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>

            {/* Public Landing Page Button */}
            {onOpenLanding && (
              <button
                onClick={onOpenLanding}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 hover:bg-slate-100 text-slate-700 hover:text-black text-xs font-bold transition-all cursor-pointer border border-slate-200/80 shadow-2xs hover:scale-102"
                title="View Public Marketing Landing Page"
              >
                <Globe className="w-3.5 h-3.5 text-sky-600" />
                <span>Landing Page</span>
              </button>
            )}

            {/* User Profile Pill / Dropdown Trigger */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
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
                    <div className="mt-2.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Neon PostgreSQL Enclave</span>
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
                      onClick={async () => {
                        const confirmed = window.confirm(
                          'GDPR Article 17 Erasure:\n\nAre you sure you want to permanently delete your account and eradicate all financial accounts, transactions, and audit trails from Neon PostgreSQL? This cannot be undone.'
                        );
                        if (confirmed) {
                          await deleteAccount();
                          setUserMenuOpen(false);
                          alert('Account and all associated records permanently eradicated under GDPR Article 17.');
                        }
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
                      onClick={() => handleSelectTab(item.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer text-xs font-bold border btn-anim ${
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
              onClick={() => handleSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
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
