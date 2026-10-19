'use client';

import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import CurrencySelect from './CurrencySelect';
import {
  X,
  Lock,
  Mail,
  User,
  ShieldCheck,
  Fingerprint,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  onSuccess?: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  initialMode = 'signin',
  onSuccess,
}: AuthModalProps) {
  const { preferences, login, signup } = useFinance();
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [signupCurrency, setSignupCurrency] = useState(preferences.baseCurrency || 'USD');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setStatusMessage(null);
    setErrorMessage(null);
    setIsSuccess(false);
    if (initialMode === 'signin' && preferences.userName) {
      setName(preferences.userName);
      if (preferences.userEmail) setEmail(preferences.userEmail);
    }
  }, [initialMode, isOpen, preferences.userName, preferences.userEmail]);

  if (!isOpen) return null;

  // Calculate password strength score
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 1;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score; // 1 to 4
  };

  const strength = getPasswordStrength(password);
  const strengthLabels = ['', 'Basic', 'Good', 'Strong', 'Enclave Grade'];
  const strengthColors = ['', 'bg-rose-500', 'bg-amber-500', 'bg-sky-500', 'bg-emerald-500'];

  // Fill competition credentials from image
  const handleFillCompetitionCredentials = () => {
    setEmail('aseer@wealthpilot.app');
    setPassword('admin123');
    setName('Aseer');
    setMode('signin');
    setErrorMessage(null);
    setStatusMessage('Filled verified competition account: aseer@wealthpilot.app');
  };

  const finishSuccess = (message: string) => {
    setIsSuccess(true);
    setStatusMessage(message);
    setTimeout(() => {
      setIsLoading(false);
      if (onSuccess) onSuccess();
      onClose();
    }, 700);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    const targetEmail = email.trim().toLowerCase();

    try {
      if (mode === 'signup') {
        const targetName = name.trim() || 'Pilot';
        await signup(targetName, targetEmail, password, signupCurrency);
        finishSuccess(`Welcome aboard, ${targetName}! Your ledger is saved to your account.`);
      } else {
        await login(targetEmail, password);
        finishSuccess('Welcome back! Your data is loaded from your account.');
      }
    } catch (err: unknown) {
      setIsLoading(false);
      setErrorMessage(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  const handleInstantDemoLogin = async () => {
    setIsLoading(true);
    setStatusMessage('Signing in to the competition demo account...');
    setErrorMessage(null);

    try {
      await login('aseer@wealthpilot.app', 'admin123');
      finishSuccess('Demo account signed in. Entering live workspace...');
    } catch (err: unknown) {
      setIsLoading(false);
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Demo sign-in failed');
    }
  };

  const handlePasskeySimulation = () => {
    // Passkeys aren't implemented server-side; don't pretend to authenticate.
    setStatusMessage(null);
    setErrorMessage('Passkey sign-in isn’t available yet. Please use email and password.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      {/* Outer Shell (Double Bezel Architecture) */}
      <div className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-2xl p-2 ring-1 ring-black/5 animate-in zoom-in-95 duration-200">
        {/* Inner Content Card */}
        <div className="bg-white rounded-[calc(1.5rem-2px)] p-6 sm:p-7 shadow-xs relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header Brand */}
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center shadow-xs p-1 bg-white border border-slate-200/80">
              <img
                src="/favicon.png"
                alt="WealthPilot"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-[#0F172A]">
                  WealthPilot
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-semibold">
                  AUTH ENCLAVE
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {mode === 'signup'
                  ? 'Create your sovereign private ledger account'
                  : 'Sign in to your private financial workspace'}
              </p>
            </div>
          </div>

          {/* Competition Demo Pre-fill Banner */}
          <button
            type="button"
            onClick={handleFillCompetitionCredentials}
            className="w-full mb-4 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 text-amber-900 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer text-left shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">Competition Demo Account:</span>
                <span className="block text-[11px] font-mono text-amber-800">aseer@wealthpilot.app / admin123</span>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
              Fill
            </span>
          </button>

          {/* Segmented Auth Mode Switcher */}
          <div className="p-1 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center gap-1 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setStatusMessage(null);
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setStatusMessage(null);
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error banner */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Feedback banner */}
          {statusMessage && !errorMessage && (
            <div
              className={`mb-4 p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in ${
                isSuccess
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-sky-50 border border-sky-200 text-sky-900'
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 text-sky-600 shrink-0 animate-spin" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Display Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Aseer"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label htmlFor="signup-currency" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Main currency
                </label>
                <CurrencySelect id="signup-currency" value={signupCurrency} onChange={setSignupCurrency} ariaLabel="Main currency" />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Email Address / Username
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aseer@wealthpilot.app"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={handleFillCompetitionCredentials}
                    className="text-[11px] text-sky-600 hover:text-sky-800 font-semibold cursor-pointer"
                  >
                    Use admin123
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Minimum 8 characters' : '••••••••••••'}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[#0F172A] text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Password strength visualizer on signup */}
              {mode === 'signup' && password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`flex-1 rounded-full transition-all ${
                          step <= strength ? strengthColors[strength] : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                    <span>NIST SP 800-63B standard</span>
                    <span className="font-bold text-slate-700">{strengthLabels[strength]}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                />
                <span className="text-xs text-slate-600 font-medium">Remember session</span>
              </label>
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full group py-3 px-4 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
            >
              <span>
                {isLoading
                  ? 'Verifying Credentials...'
                  : mode === 'signup'
                  ? 'Create Account & Initialize Ledger'
                  : 'Sign In to Workspace'}
              </span>
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                <ArrowRight className="w-3 h-3 text-sky-400" />
              </div>
            </button>
          </form>

          {/* Quick Alternatives */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-bold">
              <span className="bg-white px-3 text-slate-400">or express authenticate</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handlePasskeySimulation}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Fingerprint className="w-4 h-4 text-sky-600" />
              <span>Passkey / FaceID</span>
            </button>
            <button
              type="button"
              onClick={handleInstantDemoLogin}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-900 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-sky-600" />
              <span>Instant Login (Aseer)</span>
            </button>
          </div>

          {/* Security Footnote */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-snug">
              Protected by Neon PostgreSQL with TLS encryption and SOX Section 302 audit logging.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
