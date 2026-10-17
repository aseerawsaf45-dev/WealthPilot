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
  baseCurrency: string; // USD, EUR, GBP, CAD
  locale: string;
  timezone: string;
  theme: 'dark' | 'light' | 'system';
  isAiEnabled: boolean;
  isDemoMode: boolean;
  dateFormat: string;
  reducedMotion: boolean;
  /** Learn tab progress; saved to the account (uiPrefs) when signed in. */
  learn?: { xp: number; streak: number; completed: string[] };
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
}

export interface CopilotFact {
  id: string;
  label: string;
  value: number | string;
  unit: 'cents' | 'pct' | 'count' | 'days' | 'months' | 'date' | 'text';
  currency?: string;
  kind: 'recorded' | 'estimate';
}
