'use client';

import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Flame,
  Zap,
  Trophy,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  BookOpen,
  Award,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Calculator,
  Shield,
  TrendingUp,
  Clock,
  Layers,
  Star,
  Check,
} from 'lucide-react';

interface QuizQuestion {
  id: string;
  question: string;
  scenario?: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

interface LearningModule {
  id: string;
  title: string;
  category: 'Foundations' | 'Debt Strategy' | 'Investing' | 'Budgeting';
  readTime: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  summary: string;
  content: string[];
  keyTakeaways: string[];
  hasCalculator?: 'emergency' | 'rule72';
  quiz: QuizQuestion[];
  xpReward: number;
}

const LEARNING_MODULES: LearningModule[] = [
  {
    id: 'mod_runway',
    title: 'The 6-Month Emergency Runway Architecture',
    category: 'Foundations',
    readTime: '4 min read',
    level: 'Beginner',
    summary: 'How to calculate your true non-negotiable living burn and structure liquid tier-1 reserves that guarantee total psychological peace of mind.',
    content: [
      'An emergency fund is not merely a pool of stagnant cash; it is your psychological insulation against job disruption, medical emergencies, and macroeconomic volatility.',
      'To build an authentic emergency runway, first identify your non-negotiable operational burn: Housing, essential groceries, utilities, and mandatory minimum debt obligations. Exclude dining out, subscriptions, and discretionary retail.',
      'Your Tier-1 reserve should be housed in a High-Yield Savings Account (HYSA) or liquid government-backed deposit that yields interest while remaining accessible within 24 hours without market risk.',
    ],
    keyTakeaways: [
      'Calculate runway using bare-bones survival expenses, not lifestyle expenses.',
      'Maintain 3 to 6 months of expenses in an accessible high-yield liquid account.',
      'Never invest your emergency fund into volatile equity, crypto, or real estate.',
    ],
    hasCalculator: 'emergency',
    xpReward: 100,
    quiz: [
      {
        id: 'q_runway_1',
        question: 'What expenses should be EXCLUDED when calculating your bare-bones emergency runway?',
        scenario: 'You are setting your minimum monthly emergency target to determine how much cash you need in reserves.',
        options: [
          'Rent, mortgage payments, and basic utilities',
          'Discretionary dining, luxury subscriptions, and holiday travel',
          'Minimum loan payments and groceries',
          'Prescription medications and essential insurance',
        ],
        correctAnswerIndex: 1,
        explanation: 'Correct! Emergency runways are designed for survival resilience. Discretionary spending (vacations, fine dining, streaming SaaS) is immediately paused during an emergency.',
      },
      {
        id: 'q_runway_2',
        question: 'Where should your Tier-1 emergency fund be parked for optimal balance of safety and growth?',
        scenario: 'You have accumulated $15,000 / ৳150,000 for your emergency fund and want to preserve capital.',
        options: [
          'In high-volatility speculative crypto tokens',
          'In a High-Yield Savings Account (HYSA) or liquid capital account with near-zero principal risk',
          'In a 5-year illiquid private equity syndicate',
          'Under physical mattress cash subject to high currency inflation loss',
        ],
        correctAnswerIndex: 1,
        explanation: 'Spot on! Tier-1 reserves require capital preservation and instant liquidity. HYSAs safeguard your principal while providing inflation-mitigating yield.',
      },
    ],
  },
  {
    id: 'mod_debt',
    title: 'Debt Avalanche vs. Debt Snowball: The Math of Freedom',
    category: 'Debt Strategy',
    readTime: '5 min read',
    level: 'Intermediate',
    summary: 'Compare the algorithmic interest savings of the Avalanche strategy against the psychological momentum of the Snowball method.',
    content: [
      'Eliminating high-interest liabilities is the highest guaranteed return on investment you will ever make. Paying off a 24% APR credit card is mathematically identical to earning a risk-free 24% after-tax return.',
      'The Debt Avalanche orders debts by highest Annual Percentage Rate (APR) first, regardless of balance. This mathematically minimizes the total interest you surrender to creditors over time.',
      'The Debt Snowball orders debts by smallest balance first. While you pay slightly more in interest, clearing smaller accounts quickly delivers fast psychological dopamine wins that keep you committed.',
    ],
    keyTakeaways: [
      'Debt Avalanche is the mathematically superior method that minimizes total interest.',
      'Debt Snowball is behaviorally superior if you struggle with motivation and need quick wins.',
      'Always pay minimum payments across all active debts to protect your credit ledger score.',
    ],
    xpReward: 120,
    quiz: [
      {
        id: 'q_debt_1',
        question: 'Which debt payoff strategy mathematically minimizes the total interest paid to banks?',
        options: [
          'The Debt Snowball (paying smallest balance first)',
          'The Debt Avalanche (paying highest APR interest rate first)',
          'Paying minimum payments across all cards equally forever',
          'Consolidating into a higher interest payday loan',
        ],
        correctAnswerIndex: 1,
        explanation: 'Exactly right! The Avalanche method directs extra capital toward the highest interest rate first, preventing aggressive compound interest from working against you.',
      },
      {
        id: 'q_debt_2',
        question: 'When should someone intentionally choose the Debt Snowball method over the Avalanche?',
        scenario: 'A borrower has 5 credit cards, feels overwhelmed by multiple bills, and has given up on budgets in the past.',
        options: [
          'When they need quick behavioral momentum and psychological wins to stay committed',
          'When their accountant demands the lowest theoretical interest cost',
          'When interest rates are 0% across all loans',
          'When they want to maximize bank fees',
        ],
        correctAnswerIndex: 0,
        explanation: 'Correct! Personal finance is 80% behavior and 20% math. If seeing 2 debts disappear in 60 days keeps you on track, Snowball is the right psychological tool.',
      },
    ],
  },
  {
    id: 'mod_rule72',
    title: 'The Rule of 72 & Compound Growth Dynamics',
    category: 'Investing',
    readTime: '4 min read',
    level: 'Intermediate',
    summary: 'Master mental math for exponential capital compounding and discover why time in the market consistently beats timing the market.',
    content: [
      'The Rule of 72 is an elegant mental shortcut used by institutional investors: divide the number 72 by your annual expected rate of return to estimate how many years it takes for your investment to double.',
      'For example, at an 8% annual return in a broad-market index fund: 72 / 8 = 9 years to double your initial capital. In 27 years, your portfolio doubles three times (2x -> 4x -> 8x).',
      'The single most powerful variable in compound wealth generation is not picking unicorn stocks; it is starting early and letting uninterrupted compounding do the heavy lifting.',
    ],
    keyTakeaways: [
      'Years to Double = 72 ÷ Annual Return Rate (%).',
      'At 10% expected return, capital doubles every 7.2 years.',
      'Starting 10 years earlier produces exponentially more final wealth than doubling your savings later in life.',
    ],
    hasCalculator: 'rule72',
    xpReward: 110,
    quiz: [
      {
        id: 'q_rule72_1',
        question: 'According to the Rule of 72, at a 9% annual return, how many years does it take for your invested capital to double?',
        options: [
          '12.0 years',
          '8.0 years (72 ÷ 9 = 8)',
          '6.5 years',
          '18.0 years',
        ],
        correctAnswerIndex: 1,
        explanation: 'Perfect! 72 divided by 9 equals 8 years. A $10,000 / ৳100,000 investment becomes $20,000 in 8 years, and $40,000 in 16 years.',
      },
      {
        id: 'q_rule72_2',
        question: 'Why is starting to invest at age 22 vastly more advantageous than starting at age 35?',
        options: [
          'Younger investors get special government interest rates',
          'Exponential compounding has additional doubling cycles that produce the vast majority of total wealth',
          'Stock market returns are only positive for young people',
          'Index funds expire after age 40',
        ],
        correctAnswerIndex: 1,
        explanation: 'Spot on! In exponential curves, the final doubling cycles generate more raw dollars than all earlier decades combined. Time is an investor’s greatest asset.',
      },
    ],
  },
  {
    id: 'mod_budget503020',
    title: 'The 50/30/20 Framework & Cash Flow Velocity',
    category: 'Budgeting',
    readTime: '3 min read',
    level: 'Beginner',
    summary: 'A friction-free cash distribution model that balances present living standards with aggressive forward capital accumulation.',
    content: [
      'The 50/30/20 guideline divides your net take-home income into three clean structural buckets:',
      '1. 50% Needs: Housing, groceries, healthcare, transportation, and minimum debts.',
      '2. 30% Wants: Hobbies, leisure dining, subscriptions, travel, and personal upgrades.',
      '3. 20% Capital Growth: High-yield savings, emergency reserves, index fund investments, and extra debt payments.',
      'In high-inflation environments or during debt payoffs, high performers shift to a 50/20/30 or 60/10/30 aggressive accumulation stance.',
    ],
    keyTakeaways: [
      '50% for Needs, 30% for Wants, 20% for Wealth Creation.',
      'If needs exceed 50%, look for housing and transportation cost reductions first.',
      'Automate your 20% capital growth contribution on payday before spending on wants.',
    ],
    xpReward: 90,
    quiz: [
      {
        id: 'q_bgt_1',
        question: 'In the standard 50/30/20 budget framework, what specifically belongs in the 20% category?',
        options: [
          'Dining at restaurants and weekend events',
          'Emergency savings, retirement investments, and accelerated debt payoff',
          'Apartment rent and electric bills',
          'Car fuel and public transit passes',
        ],
        correctAnswerIndex: 1,
        explanation: 'Correct! The 20% bucket is strictly earmarked for your future self: emergency reserves, investments, and eliminating liabilities.',
      },
      {
        id: 'q_bgt_2',
        question: 'What is the most effective behavioral technique to ensure your 20% savings target is consistently met?',
        options: [
          'Wait until the end of the month and save whatever random pennies are left over',
          'Pay Yourself First: Automate transfers to savings and investments immediately on payday',
          'Spend aggressively on credit cards and hope for an annual bonus',
          'Avoid tracking your accounts to prevent anxiety',
        ],
        correctAnswerIndex: 1,
        explanation: 'Brilliant! "Paying yourself first" removes willpower from the equation. Automating investments on payday ensures wealth accumulates effortlessly.',
      },
    ],
  },
];

const STORAGE_KEY_LEARN_XP = 'wealthpilot_learn_xp_v1';
const STORAGE_KEY_LEARN_STREAK = 'wealthpilot_learn_streak_v1';
const STORAGE_KEY_LEARN_COMPLETED = 'wealthpilot_learn_completed_v1';
const STORAGE_KEY_LEARN_LAST_ACTIVE = 'wealthpilot_learn_last_active_v1';

export function LearnTab() {
  const [xp, setXp] = useState(320);
  const [streak, setStreak] = useState(4);
  const [completedModules, setCompletedModules] = useState<string[]>(['mod_runway']);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedModule, setSelectedModule] = useState<LearningModule>(LEARNING_MODULES[0]);

  // Quiz state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [xpToast, setXpToast] = useState<{ amount: number; message: string } | null>(null);

  // Interactive Calculators state
  const [calcBurn, setCalcBurn] = useState(2500); // for emergency runway calculator
  const [calcApr, setCalcApr] = useState(8); // for rule of 72 calculator

  // Load state from localStorage on client mount
  useEffect(() => {
    try {
      const savedXp = localStorage.getItem(STORAGE_KEY_LEARN_XP);
      const savedStreak = localStorage.getItem(STORAGE_KEY_LEARN_STREAK);
      const savedCompleted = localStorage.getItem(STORAGE_KEY_LEARN_COMPLETED);

      if (savedXp) setXp(parseInt(savedXp, 10));
      if (savedStreak) setStreak(parseInt(savedStreak, 10));
      if (savedCompleted) setCompletedModules(JSON.parse(savedCompleted));
    } catch (e) {
      console.warn('Learn storage fallback', e);
    }
  }, []);

  // Save state
  const addXp = (amount: number, reason: string) => {
    const newXp = xp + amount;
    setXp(newXp);
    setXpToast({ amount, message: reason });
    try {
      localStorage.setItem(STORAGE_KEY_LEARN_XP, newXp.toString());
    } catch {}

    setTimeout(() => {
      setXpToast(null);
    }, 3000);
  };

  const markModuleCompleted = (moduleId: string, xpReward: number) => {
    if (!completedModules.includes(moduleId)) {
      const updated = [...completedModules, moduleId];
      setCompletedModules(updated);
      addXp(xpReward, 'Module Mastered!');
      try {
        localStorage.setItem(STORAGE_KEY_LEARN_COMPLETED, JSON.stringify(updated));
      } catch {}
    }
  };

  // Level computation
  const getLevelInfo = (currentXp: number) => {
    if (currentXp < 200) {
      return { level: 1, title: 'Financial Novice', nextThreshold: 200, prevThreshold: 0 };
    } else if (currentXp < 500) {
      return { level: 2, title: 'Capital Accumulator', nextThreshold: 500, prevThreshold: 200 };
    } else if (currentXp < 1000) {
      return { level: 3, title: 'Ledger Strategist', nextThreshold: 1000, prevThreshold: 500 };
    } else if (currentXp < 2000) {
      return { level: 4, title: 'Wealth Engineer', nextThreshold: 2000, prevThreshold: 1000 };
    } else {
      return { level: 5, title: 'Financial Sovereign', nextThreshold: 5000, prevThreshold: 2000 };
    }
  };

  const levelInfo = getLevelInfo(xp);
  const levelProgress = Math.min(
    100,
    Math.round(
      ((xp - levelInfo.prevThreshold) / (levelInfo.nextThreshold - levelInfo.prevThreshold)) * 100
    )
  );

  // Filter modules
  const filteredModules =
    activeCategory === 'All'
      ? LEARNING_MODULES
      : LEARNING_MODULES.filter((m) => m.category === activeCategory);

  // Handle Quiz interactions
  const activeQuiz = selectedModule.quiz;
  const currentQ = activeQuiz[currentQuestionIndex];

  const handleSelectOption = (idx: number) => {
    if (hasSubmittedAnswer) return;
    setSelectedAnswer(idx);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;
    setHasSubmittedAnswer(true);

    const isCorrect = selectedAnswer === currentQ.correctAnswerIndex;
    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
      addXp(25, 'Correct Answer!');
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex + 1 < activeQuiz.length) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setHasSubmittedAnswer(false);
    } else {
      setQuizFinished(true);
      const isPerfect = quizScore + (selectedAnswer === currentQ.correctAnswerIndex ? 1 : 0) === activeQuiz.length;
      if (isPerfect) {
        addXp(50, 'Perfect Quiz Bonus!');
      }
      markModuleCompleted(selectedModule.id, selectedModule.xpReward);
    }
  };

  const handleResetQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setHasSubmittedAnswer(false);
    setQuizScore(0);
    setQuizFinished(false);
  };

  const handleSwitchModule = (mod: LearningModule) => {
    setSelectedModule(mod);
    handleResetQuiz();
  };

  return (
    <div className="space-y-8 pb-24 max-w-7xl mx-auto">
      {/* XP Toast Notification */}
      {xpToast && (
        <div className="fixed top-24 right-6 z-50 animate-in slide-in-from-top-4 duration-300">
          <div className="bg-[#0F172A] text-white px-4 py-3 rounded-2xl shadow-2xl border border-sky-400/40 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-md">
              +{xpToast.amount}
            </div>
            <div>
              <p className="text-xs font-bold text-white">{xpToast.message}</p>
              <p className="text-[10px] text-sky-300 font-mono">Total: {xp} XP</p>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          GAMIFICATION STATS HEADER BAR: Streak, Total XP, Level Progression
          ========================================================================= */}
      <section className="keel-card p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50 animate-pulse" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Self-Finance Academy • Daily Mastery
              </span>
              <span className="text-[10px] font-mono text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200 font-semibold">
                Interactive Learning & Q&A
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
              Financial Literacy & Wealth IQ
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
              Read curated practical financial guides, answer scenario checks, and earn daily XP & streak rewards.
            </p>
          </div>

          {/* Gamification Pills Strip */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* Daily Streak Flame Widget */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-transparent border border-amber-300/80 flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30">
                <Flame className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl sm:text-2xl font-black text-[#0F172A] font-money">
                    {streak}
                  </span>
                  <span className="text-xs font-extrabold uppercase text-amber-700">Days</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 block">
                  Active Daily Streak
                </span>
              </div>
            </div>

            {/* Total XP Points Widget */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-sky-500/10 via-sky-400/5 to-transparent border border-sky-300/80 flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-500/30">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-xl sm:text-2xl font-black text-[#0F172A] font-money">
                    {xp}
                  </span>
                  <span className="text-xs font-extrabold uppercase text-sky-700">XP</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 block">
                  Accumulated Score
                </span>
              </div>
            </div>

            {/* Level Badge Widget */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-400/5 to-transparent border border-emerald-300/80 flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/30">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Level {levelInfo.level}
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-800 block">
                  {levelInfo.title}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Level Progress Bar & Weekly Day Tickers */}
        <div className="pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 max-w-xl">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
              <span>Next Rank: Level {levelInfo.level + 1}</span>
              <span className="font-mono text-sky-800 font-bold">
                {xp} / {levelInfo.nextThreshold} XP ({levelProgress}%)
              </span>
            </div>
            <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-sky-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
          </div>

          {/* 7-Day Streak Calendar Circles */}
          <div className="flex items-center gap-2 select-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Streak:
            </span>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => {
              const isPastStreak = idx < streak;
              const isToday = idx === streak - 1;
              return (
                <div
                  key={idx}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    isPastStreak
                      ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  } ${isToday ? 'ring-2 ring-amber-400 ring-offset-1 scale-105' : ''}`}
                >
                  {isPastStreak ? <Check className="w-3.5 h-3.5" /> : day}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          MAIN INTERACTIVE LEARNING STAGE:
          Left (Span 4): Module Directory & Category Selector
          Right (Span 8): Active Learning Blog Reader & Interactive Q&A
          ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =======================================================================
            LEFT COLUMN: Module Directory (Span 4)
            ======================================================================= */}
        <div className="lg:col-span-4 space-y-4">
          <div className="keel-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-[#0F172A] tracking-tight">
                Curriculum Modules
              </h2>
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {completedModules.length}/{LEARNING_MODULES.length} Done
              </span>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
              {['All', 'Foundations', 'Debt Strategy', 'Investing', 'Budgeting'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-[#0F172A] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Module Cards List */}
            <div className="space-y-3 pt-2">
              {filteredModules.map((mod) => {
                const isSelected = selectedModule.id === mod.id;
                const isCompleted = completedModules.includes(mod.id);

                return (
                  <div
                    key={mod.id}
                    onClick={() => handleSwitchModule(mod)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-50/90 border-sky-300 shadow-sm'
                        : 'bg-slate-50/70 border-slate-200/70 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-800 bg-white px-2 py-0.5 rounded-md border border-sky-100">
                        {mod.category}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Done</span>
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-mono">
                          +{mod.xpReward} XP
                        </span>
                      </div>
                    </div>

                    <h3 className="text-xs font-extrabold text-[#0F172A] leading-snug">
                      {mod.title}
                    </h3>

                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{mod.readTime}</span>
                      </span>
                      <span>•</span>
                      <span className="text-slate-600 font-semibold">{mod.level}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Motivation Card */}
          <div className="keel-card p-5 bg-gradient-to-br from-sky-500/10 via-white to-emerald-500/5 border border-sky-200/80">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-extrabold text-sky-950 uppercase tracking-wider">
                Streak Multiplier Active
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Complete at least 1 reading module and quiz daily to keep your streak intact and unlock advanced calculators.
            </p>
          </div>
        </div>

        {/* =======================================================================
            RIGHT COLUMN: Interactive Learning Blog & Q&A Quiz Stage (Span 8)
            ======================================================================= */}
        <div className="lg:col-span-8 space-y-6">
          {/* Article & Interactive Lesson Card */}
          <div className="keel-card p-6 sm:p-8 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-sky-700 uppercase tracking-wider bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                  {selectedModule.category}
                </span>
                <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedModule.readTime}</span>
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                  +{selectedModule.xpReward} XP upon completion
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight mt-1">
                {selectedModule.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-medium mt-2 leading-relaxed">
                {selectedModule.summary}
              </p>
            </div>

            {/* Structured Article Paragraphs */}
            <div className="space-y-4 pt-2 border-t border-slate-100 text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
              {selectedModule.content.map((para, i) => (
                <p key={i} className="leading-relaxed">
                  {para}
                </p>
              ))}
            </div>

            {/* Interactive Embedded Widget: Emergency Calculator or Rule of 72 */}
            {selectedModule.hasCalculator === 'emergency' && (
              <div className="p-5 rounded-2xl bg-sky-50/80 border border-sky-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-sky-700" />
                    <span className="text-xs font-extrabold text-sky-950 uppercase tracking-wider">
                      Interactive Runway Sizer
                    </span>
                  </div>
                  <span className="text-xs font-bold font-money text-sky-900 bg-white px-2.5 py-1 rounded-full border border-sky-200">
                    ৳ / $ {calcBurn.toLocaleString()}/mo burn
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Adjust Your Estimated Monthly Core Survival Expenses:
                  </label>
                  <input
                    type="range"
                    min="500"
                    max="10000"
                    step="250"
                    value={calcBurn}
                    onChange={(e) => setCalcBurn(parseInt(e.target.value, 10))}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-white rounded-xl border border-sky-100 text-center">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">
                      3-Month Minimum
                    </span>
                    <span className="text-sm sm:text-base font-extrabold text-slate-900 font-money block mt-0.5">
                      {(calcBurn * 3).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-sky-600 text-white rounded-xl shadow-xs text-center">
                    <span className="text-[10px] text-sky-100 font-bold block uppercase">
                      6-Month Recommended
                    </span>
                    <span className="text-sm sm:text-base font-extrabold font-money block mt-0.5">
                      {(calcBurn * 6).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-sky-100 text-center">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">
                      12-Month Sovereign
                    </span>
                    <span className="text-sm sm:text-base font-extrabold text-slate-900 font-money block mt-0.5">
                      {(calcBurn * 12).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedModule.hasCalculator === 'rule72' && (
              <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                      Rule of 72 Doubling Time Simulator
                    </span>
                  </div>
                  <span className="text-xs font-bold font-money text-amber-900 bg-white px-2.5 py-1 rounded-full border border-amber-200">
                    {calcApr}% Expected Return
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Select Annual Compounding Rate (APR):
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="18"
                    step="1"
                    value={calcApr}
                    onChange={(e) => setCalcApr(parseInt(e.target.value, 10))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                </div>

                <div className="p-4 bg-white rounded-xl border border-amber-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Time for Capital to Double:
                    </span>
                    <span className="text-[11px] text-slate-500">Formula: 72 ÷ {calcApr}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-amber-700 font-money">
                      {(72 / calcApr).toFixed(1)} Years
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Key Takeaways Box */}
            <div className="p-5 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-2.5">
              <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider block">
                Key Principles & Takeaways
              </span>
              <ul className="space-y-1.5 text-xs text-slate-600 font-medium">
                {selectedModule.keyTakeaways.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* =====================================================================
              INTERACTIVE Q&A (QUIZ) & KNOWLEDGE CHECK CARD
              ===================================================================== */}
          <div className="keel-card p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#0F172A]">
                    Interactive Knowledge Check (Q&A)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Answer scenario questions correctly to earn +25 XP per question and level up.
                  </p>
                </div>
              </div>

              {!quizFinished && (
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                  Question {currentQuestionIndex + 1} of {activeQuiz.length}
                </span>
              )}
            </div>

            {/* Active Quiz Question */}
            {!quizFinished ? (
              <div className="space-y-5">
                {/* Scenario & Question Prompt */}
                <div>
                  {currentQ.scenario && (
                    <div className="p-3.5 rounded-xl bg-slate-100/90 text-slate-700 text-xs font-medium mb-3 border border-slate-200/70">
                      <strong>Scenario:</strong> {currentQ.scenario}
                    </div>
                  )}
                  <h4 className="text-sm sm:text-base font-extrabold text-[#0F172A]">
                    {currentQ.question}
                  </h4>
                </div>

                {/* Multiple Choice Options */}
                <div className="space-y-2.5">
                  {currentQ.options.map((opt, idx) => {
                    const isSelected = selectedAnswer === idx;
                    const isCorrectAnswer = idx === currentQ.correctAnswerIndex;

                    let optionStyle =
                      'bg-slate-50/80 border-slate-200/80 hover:bg-white hover:border-slate-300 text-slate-800';

                    if (isSelected && !hasSubmittedAnswer) {
                      optionStyle = 'bg-sky-50 border-sky-400 text-sky-950 ring-2 ring-sky-300';
                    }

                    if (hasSubmittedAnswer) {
                      if (isCorrectAnswer) {
                        optionStyle =
                          'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-2 ring-emerald-300';
                      } else if (isSelected && !isCorrectAnswer) {
                        optionStyle =
                          'bg-rose-50 border-rose-300 text-rose-950 ring-2 ring-rose-200';
                      } else {
                        optionStyle = 'bg-slate-50/40 border-slate-200/40 text-slate-400';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectOption(idx)}
                        disabled={hasSubmittedAnswer}
                        className={`w-full p-4 rounded-2xl border text-left text-xs sm:text-sm font-medium transition-all flex items-center justify-between cursor-pointer ${optionStyle}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-600 flex-shrink-0">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span>{opt}</span>
                        </div>

                        {hasSubmittedAnswer && isCorrectAnswer && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 ml-2" />
                        )}
                        {hasSubmittedAnswer && isSelected && !isCorrectAnswer && (
                          <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation Reveal */}
                {hasSubmittedAnswer && (
                  <div
                    className={`p-4 rounded-2xl border text-xs leading-relaxed animate-in fade-in-50 duration-300 ${
                      selectedAnswer === currentQ.correctAnswerIndex
                        ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50/90 border-rose-200 text-rose-900'
                    }`}
                  >
                    <p className="font-bold mb-1">
                      {selectedAnswer === currentQ.correctAnswerIndex
                        ? '🎉 Correct! (+25 XP)'
                        : '💡 Key Concept to Remember:'}
                    </p>
                    <p>{currentQ.explanation}</p>
                  </div>
                )}

                {/* Submit & Next Question Action Buttons */}
                <div className="pt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    {hasSubmittedAnswer
                      ? 'Review the explanation above, then proceed.'
                      : 'Select an answer to continue.'}
                  </span>

                  {!hasSubmittedAnswer ? (
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={selectedAnswer === null}
                      className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-md ${
                        selectedAnswer !== null
                          ? 'btn-primary-anim bg-sky-600 text-white hover:bg-sky-700'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      Check Answer
                    </button>
                  ) : (
                    <button
                      onClick={handleNextQuestion}
                      className="btn-primary-anim bg-[#0F172A] text-white hover:bg-black px-6 py-2.5 rounded-full text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      <span>
                        {currentQuestionIndex + 1 < activeQuiz.length
                          ? 'Next Question'
                          : 'Complete Module'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Quiz Completion Score Card */
              <div className="p-8 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-white to-sky-500/10 border border-emerald-200 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                  <Trophy className="w-8 h-8" />
                </div>

                <div>
                  <h4 className="text-xl font-extrabold text-[#0F172A]">
                    Module Mastery Complete!
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                    You scored {quizScore} out of {activeQuiz.length} on &quot;{selectedModule.title}&quot;.
                  </p>
                </div>

                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs">
                  <span className="flex items-center gap-1">
                    <Zap className="w-4 h-4 text-emerald-700" />
                    <span>+{selectedModule.xpReward} XP Earned</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Flame className="w-4 h-4 text-amber-600" />
                    <span>Daily Streak Extended!</span>
                  </span>
                </div>

                <div className="pt-4 flex items-center justify-center gap-3">
                  <button
                    onClick={handleResetQuiz}
                    className="btn-glass-anim px-4 py-2 rounded-full text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retake Quiz</span>
                  </button>

                  <button
                    onClick={() => {
                      const nextIdx =
                        (LEARNING_MODULES.findIndex((m) => m.id === selectedModule.id) + 1) %
                        LEARNING_MODULES.length;
                      handleSwitchModule(LEARNING_MODULES[nextIdx]);
                    }}
                    className="btn-primary-anim bg-[#0F172A] text-white px-5 py-2 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <span>Next Module</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
