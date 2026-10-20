// WealthPilot Types — Integer minor-units (cents) for exact arithmetic without binary floating-point errors

export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'cash' | 'loan';

export interface FinancialAccount {
  id: string;
  userId: string;
  name: string;
  institution: string;
  type: AccountType;
  currency: string;
  balanceCents: number; // Integer minor-units (e.g. 10000 = $100.00)
  accountNumberMask: string; // e.g. "•••• 4821"
  isManual: boolean;
  lastSyncedAt: string;
  isIncludedInNetWorth: boolean;
}

export interface TransactionSplit {
  id: string;
  category: string;
  amountCents: number;
  note?: string;
}

export type TransactionStatus = 'cleared' | 'pending' | 'reconciled';

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  financialDate: string; // YYYY-MM-DD
  postedAt: string; // ISO 8601
  merchant: string;
  normalizedMerchant: string;
  category: string;
  amountCents: number; // Negative for expense, positive for income/refund
  currency: string;
  status: TransactionStatus;
  notes?: string;
  tags: string[];
  isTransfer: boolean;
  transferPairId?: string;
  splits?: TransactionSplit[];
  source: 'manual' | 'csv_import' | 'provider_sync' | 'demo';
  importFingerprint?: string;
}

export interface BudgetCategory {
  id: string;
  category: string;
  allocatedCents: number;
  spentCents: number;
  period: 'monthly' | 'custom';
  rolloverEnabled: boolean;
  rolloverCents: number;
  alertThresholdPercent: number; // e.g. 80
}

export interface SavingsGoal {
  id: string;
  userId: string;
  name: string;
  targetCents: number;
  currentCents: number;
  targetDate?: string; // YYYY-MM-DD or undefined for flexible
  priority: 'low' | 'medium' | 'high';
  category: string;
  isPaused: boolean;
  createdAt: string;
  /** Latest saved AI plan (signed in only). */
  plan?: GoalPlanSnapshot;
  planUpdatedAt?: string;
}

export interface BillSubscription {
  id: string;
  userId: string;
  name: string;
  amountCents: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  nextDueDate: string; // YYYY-MM-DD
  category: string;
  accountId: string;
  isAutoPay: boolean;
  status: 'active' | 'paused' | 'overdue' | 'due_soon';
  confidence: 'confirmed' | 'detected';
}

export interface DebtAccount {
  id: string;
  userId: string;
  name: string;
  balanceCents: number;
  aprPercent: number; // e.g. 19.99
  minimumPaymentCents: number;
  dueDateDay: number; // Day of month 1-31
  category: 'credit_card' | 'student_loan' | 'car_loan' | 'mortgage' | 'personal_loan';
}

export interface DebtPayoffComparison {
  strategy: 'snowball' | 'avalanche';
  totalMonths: number;
  totalInterestPaidCents: number;
  /** Total remaining balance at the start of each month (index 0 = today), ending at 0. */
  balanceByMonth?: number[];
  /** True when the 30-year simulation ends with debt left (payments don't cover the interest). */
  neverPaysOff?: boolean;
  monthlyExtraPaymentCents: number;
  debtOrder: Array<{
    id: string;
    name: string;
    payoffMonth: number;
    interestPaidCents: number;
  }>;
}

export interface AuditEvent {
  id: string;
  userId: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string; // Redacted of secrets
  ipAddressMask: string;
}

export interface UserPreferences {
  userId: string;
  userName?: string;
  userEmail?: string;
  isAuthenticated?: boolean;
  baseCurrency: string; // any ISO 4217 code; goals, budgets, bills and debts are in this currency
  locale: string;
  timezone: string;
  theme: 'dark' | 'light' | 'system';
  isAiEnabled: boolean;
  /** Providers the user consented to (signed in); Gemini needs an allowed region. */
  aiProviders?: string[];
  /** Signed in: save assistant chats to the history sidebar across devices (off by default). */
  chatHistoryEnabled?: boolean;
  /** ISO-3166 alpha-2 country, user-declared; null = most restrictive AI rules. */
  region?: string | null;
  isDemoMode: boolean;
  dateFormat: string;
  reducedMotion: boolean;
  /** Learn tab progress; saved to the account (uiPrefs) when signed in. */
  learn?: { xp: number; streak: number; completed: string[]; lastActive?: string };
  autoCategorizationRules: Array<{
    id: string;
    keyword: string;
    category: string;
  }>;
}

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  content: string;
  intent?: string;
  evidence?: {
    scope: string;
    transactionCount: number;
    dateRange: string;
    reconciledTotalCents?: number;
    confidence: 'verified_fact' | 'calculated_estimate' | 'actionable_suggestion';
  };
  clarificationNeeded?: boolean;
  // Server copilot answers (signed in): numbers come only from `facts`.
  facts?: CopilotFact[];
  limitations?: string[];
  source?: 'rules' | 'llm:groq';
  insights?: { title: string; description: string }[];
  suggestedActions?: { label: string; action: string }[];
  /** Changes the assistant prepared; each runs only when the user presses Confirm. */
  proposals?: ActionProposal[];
  /** One-tap answers when the assistant asked a question. */
  quickReplies?: string[];
  /** The command the assistant's question is about; sent back with the user's reply. */
  pending?: { name: string; args: Record<string, unknown>; field: string };
}

/** FinanceContext methods the assistant may call (plus two UI ops). The client checks this list again. */
export const ASSISTANT_OPS = [
  'navigate', 'openQuickAdd',
  'addTransaction', 'updateTransaction', 'deleteTransaction',
  'addGoal', 'updateGoal', 'deleteGoal', 'contributeToGoal', 'planGoal',
  'addBudget', 'deleteBudget',
  'addBill', 'updateBill', 'payBill', 'deleteBill',
  'addDebt', 'updateDebt', 'deleteDebt',
  'addAccount', 'updateAccount', 'removeAccount',
  'setPreferences',
  'saveInvestmentPlan', 'deleteInvestmentPlan', 'saveLoanOffer', 'deleteLoanOffer', 'takeLoan',
] as const;
export type AssistantOp = (typeof ASSISTANT_OPS)[number];

/** A change prepared by the server copilot: `args` are ready for the FinanceContext method `op`. */
export interface ActionProposal {
  summary: string;
  destructive: boolean;
  op: AssistantOp;
  args: unknown[];
  status?: 'done' | 'cancelled' | 'failed';
  error?: string;
}

/** What "Apply" does for a contingency option (all through existing actions). */
export type ContingencyAction =
  | { kind: 'set_deadline'; date: string }
  | { kind: 'set_target'; cents: number }
  | { kind: 'budget_cuts'; cuts: { category: string; allocatedCents: number }[] }
  | { kind: 'deadline_and_cuts'; date: string; cuts: { category: string; allocatedCents: number }[] }
  | { kind: 'pause_goals'; goalIds: string[]; names: string[] }
  | { kind: 'none' };

/** One way to make an unreachable / stretch goal comfortably reachable. `feasible` = would work with current numbers. */
export interface Contingency {
  id: 'record_income' | 'extend' | 'cut' | 'balanced' | 'pause_others' | 'lower_target' | 'income';
  title: string;
  summary: string;
  feasible: boolean;
  action: ContingencyAction;
}

/** Latest AI goal plan, saved on the goal (POST /goals/:id/plan). Numbers live only in `facts` and server text. */
export interface GoalPlanSnapshot {
  verdict: 'reached' | 'on_track' | 'stretch' | 'not_reachable' | 'no_data';
  answer: string;
  insights: { title: string; description: string }[];
  facts: CopilotFact[];
  steps: string[];
  milestones: { label: string; date: string }[];
  /** Options that would make the goal reachable (stretch / not reachable only; absent on older saved plans). */
  contingencies?: Contingency[];
  limitations: string[];
  source: 'rules' | 'llm:groq' | 'llm:gemini';
  /** Deadline the plan was calculated for (null = no deadline; a date was suggested). */
  targetDate: string | null;
  /** Goal values at calculation time, to tell when the plan is out of date. */
  basis: { targetCents: number; currentCents: number; targetDate: string | null; avgIncomeCents?: number; avgSpendingCents?: number };
}

export interface CopilotFact {
  id: string;
  label: string;
  value: number | string;
  unit: 'cents' | 'pct' | 'count' | 'days' | 'months' | 'date' | 'text';
  currency?: string;
  kind: 'recorded' | 'estimate';
}

export interface InvestmentPlan {
  id: string;
  name: string;
  country: string; // ISO-2
  currency: string;
  initialCents: number;
  monthlyCents: number;
  horizonMonths: number;
  riskProfile: 'conservative' | 'balanced' | 'growth';
  expectedReturnBps: number | null;
  taxBps: number;
  scenarios: string[];
  /** Chosen fund mix (weights add up to 100), or null. */
  allocation: Array<{ symbol: string; label: string; weightPct: number }> | null;
  mixName: string | null;
  updatedAt: string;
}

export interface LoanOffer {
  id: string;
  name: string;
  lender: string;
  principalCents: number;
  aprBps: number;
  termMonths: number;
  feeCents: number;
  purpose: 'personal' | 'car' | 'home' | 'education' | 'business';
  country: string | null;
  status: 'considering' | 'taken';
  debtId: string | null;
  updatedAt: string;
}

/** A partner's discount or investment opportunity (from organisations with a partnership, sponsorship or ad deal). */
export interface PartnerOffer {
  id: string;
  kind: 'discount' | 'investment';
  title: string;
  description: string;
  discountBps: number | null;
  country: string;
  termsUrl: string;
  actionUrl: string | null;
  validFrom: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD
  lastVerifiedAt: string;
  isSample: boolean;
  status: 'draft' | 'live' | 'paused';
  partnerId: string;
  partner: { name: string; website: string | null; relationship: 'partner' | 'sponsor' | 'advertiser' };
  locations: Array<{ label: string; lat: number; lng: number }>;
}
