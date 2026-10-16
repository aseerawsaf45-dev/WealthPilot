// Realistic Initial Seed Data (Clearly Labeled Demo Store)
import { FinancialAccount, Transaction, BudgetCategory, SavingsGoal, BillSubscription, DebtAccount, UserPreferences } from '../types/finance';

export const initialAccounts: FinancialAccount[] = [
  {
    id: 'acc_chase_chk',
    userId: 'user_pilot',
    name: 'Premier Checking',
    institution: 'Chase Bank',
    type: 'checking',
    currency: 'USD',
    balanceCents: 642050, // $6,420.50
    accountNumberMask: '•••• 4821',
    isManual: false,
    lastSyncedAt: '2026-10-15T20:30:00Z',
    isIncludedInNetWorth: true,
  },
  {
    id: 'acc_marcus_hysa',
    userId: 'user_pilot',
    name: 'High-Yield Savings (4.75%)',
    institution: 'Marcus by Goldman Sachs',
    type: 'savings',
    currency: 'USD',
    balanceCents: 4815000, // $48,150.00
    accountNumberMask: '•••• 9102',
    isManual: false,
    lastSyncedAt: '2026-10-15T21:00:00Z',
    isIncludedInNetWorth: true,
  },
  {
    id: 'acc_vanguard_idx',
    userId: 'user_pilot',
    name: 'Total Market Index VTSAX',
    institution: 'Vanguard Group',
    type: 'investment',
    currency: 'USD',
    balanceCents: 7000950, // $70,009.50
    accountNumberMask: '•••• 3301',
    isManual: false,
    lastSyncedAt: '2026-10-15T16:00:00Z',
    isIncludedInNetWorth: true,
  },
  {
    id: 'acc_amex_gold',
    userId: 'user_pilot',
    name: 'Gold Rewards Card',
    institution: 'American Express',
    type: 'credit',
    currency: 'USD',
    balanceCents: -184520, // -$1,845.20
    accountNumberMask: '•••• 1009',
    isManual: false,
    lastSyncedAt: '2026-10-15T22:00:00Z',
    isIncludedInNetWorth: true,
  },
];

export const initialTransactions: Transaction[] = [
  {
    id: 'tx_salary_1',
    userId: 'user_pilot',
    accountId: 'acc_chase_chk',
    financialDate: '2026-10-01',
    postedAt: '2026-10-01T12:00:00Z',
    merchant: 'Acme Software Inc',
    normalizedMerchant: 'Acme Software',
    category: 'Income',
    amountCents: 485000, // +$4,850.00
    currency: 'USD',
    status: 'cleared',
    notes: 'Bi-weekly Direct Deposit Payroll',
    tags: ['salary', 'income'],
    isTransfer: false,
    source: 'demo',
  },
  {
    id: 'tx_wf_groceries',
    userId: 'user_pilot',
    accountId: 'acc_amex_gold',
    financialDate: '2026-10-12',
    postedAt: '2026-10-12T19:42:00Z',
    merchant: 'Whole Foods Market',
    normalizedMerchant: 'Whole Foods',
    category: 'Groceries',
    amountCents: -13420, // -$134.20
    currency: 'USD',
    status: 'cleared',
    notes: 'Weekly pantry restocking + kitchen supplies',
    tags: ['organic', 'food'],
    isTransfer: false,
    splits: [
      { id: 'sp_1', category: 'Groceries', amountCents: -9420, note: 'Food items' },
      { id: 'sp_2', category: 'Household', amountCents: -4000, note: 'Parchment paper & cleaners' },
    ],
    source: 'demo',
  },
  {
    id: 'tx_coffee_1',
    userId: 'user_pilot',
    accountId: 'acc_amex_gold',
    financialDate: '2026-10-14',
    postedAt: '2026-10-14T09:15:00Z',
    merchant: 'Blue Bottle Coffee',
    normalizedMerchant: 'Blue Bottle',
    category: 'Dining',
    amountCents: -650, // -$6.50
    currency: 'USD',
    status: 'cleared',
    tags: ['coffee'],
    isTransfer: false,
    source: 'demo',
  },
  {
    id: 'tx_gym',
    userId: 'user_pilot',
    accountId: 'acc_chase_chk',
    financialDate: '2026-10-05',
    postedAt: '2026-10-05T06:00:00Z',
    merchant: 'Equinox Fitness Club',
    normalizedMerchant: 'Equinox',
    category: 'Wellness & Health',
    amountCents: -28000, // -$280.00
    currency: 'USD',
    status: 'cleared',
    tags: ['fitness', 'recurring'],
    isTransfer: false,
    source: 'demo',
  },
  {
    id: 'tx_lunch',
    userId: 'user_pilot',
    accountId: 'acc_amex_gold',
    financialDate: '2026-10-15',
    postedAt: '2026-10-15T13:20:00Z',
    merchant: 'Sweetgreen Salad',
    normalizedMerchant: 'Sweetgreen',
    category: 'Dining',
    amountCents: -1845, // -$18.45
    currency: 'USD',
    status: 'cleared',
    tags: ['lunch'],
    isTransfer: false,
    source: 'demo',
  },
  {
    id: 'tx_aws',
    userId: 'user_pilot',
    accountId: 'acc_amex_gold',
    financialDate: '2026-10-03',
    postedAt: '2026-10-03T03:00:00Z',
    merchant: 'Amazon Web Services',
    normalizedMerchant: 'AWS',
    category: 'Business & Cloud',
    amountCents: -4510, // -$45.10
    currency: 'USD',
    status: 'cleared',
    tags: ['infra'],
    isTransfer: false,
    source: 'demo',
  },
  {
    id: 'tx_transfer_out',
    userId: 'user_pilot',
    accountId: 'acc_chase_chk',
    financialDate: '2026-10-08',
    postedAt: '2026-10-08T10:00:00Z',
    merchant: 'Transfer to Marcus Savings',
    normalizedMerchant: 'Internal Transfer',
    category: 'Transfer',
    amountCents: -100000, // -$1,000.00
    currency: 'USD',
    status: 'cleared',
    notes: 'Monthly emergency fund contribution',
    tags: ['savings'],
    isTransfer: true,
    transferPairId: 'tx_transfer_in',
    source: 'demo',
  },
  {
    id: 'tx_transfer_in',
    userId: 'user_pilot',
    accountId: 'acc_marcus_hysa',
    financialDate: '2026-10-08',
    postedAt: '2026-10-08T10:00:00Z',
    merchant: 'Transfer from Chase Checking',
    normalizedMerchant: 'Internal Transfer',
    category: 'Transfer',
    amountCents: 100000, // +$1,000.00
    currency: 'USD',
    status: 'cleared',
    tags: ['savings'],
    isTransfer: true,
    transferPairId: 'tx_transfer_out',
    source: 'demo',
  },
  {
    id: 'tx_spotify',
    userId: 'user_pilot',
    accountId: 'acc_amex_gold',
    financialDate: '2026-10-10',
    postedAt: '2026-10-10T02:00:00Z',
    merchant: 'Spotify Premium Family',
    normalizedMerchant: 'Spotify',
    category: 'Entertainment',
    amountCents: -1699, // -$16.99
    currency: 'USD',
    status: 'cleared',
    tags: ['subscription'],
    isTransfer: false,
    source: 'demo',
  },
  {
    id: 'tx_icloud',
    userId: 'user_pilot',
    accountId: 'acc_amex_gold',
    financialDate: '2026-10-11',
    postedAt: '2026-10-11T04:00:00Z',
    merchant: 'Apple iCloud+ 2TB',
    normalizedMerchant: 'Apple',
    category: 'Subscriptions',
    amountCents: -999, // -$9.99
    currency: 'USD',
    status: 'cleared',
    tags: ['subscription', 'cloud'],
    isTransfer: false,
    source: 'demo',
  },
  {
    id: 'tx_transit_uber',
    userId: 'user_pilot',
    accountId: 'acc_amex_gold',
    financialDate: '2026-10-13',
    postedAt: '2026-10-13T18:40:00Z',
    merchant: 'Uber Technologies / Ride Commute',
    normalizedMerchant: 'Uber',
    category: 'Transport',
    amountCents: -2450, // -$24.50
    currency: 'USD',
    status: 'cleared',
    tags: ['transport', 'commute'],
    isTransfer: false,
    source: 'demo',
  },
];

export const initialBudgets: BudgetCategory[] = [
  {
    id: 'bgt_groceries',
    category: 'Groceries',
    allocatedCents: 60000, // $600.00
    spentCents: 48000, // $480.00
    period: 'monthly',
    rolloverEnabled: true,
    rolloverCents: 4500,
    alertThresholdPercent: 85,
  },
  {
    id: 'bgt_dining',
    category: 'Dining',
    allocatedCents: 45000, // $450.00
    spentCents: 39000, // $390.00
    period: 'monthly',
    rolloverEnabled: false,
    rolloverCents: 0,
    alertThresholdPercent: 80,
  },
  {
    id: 'bgt_wellness',
    category: 'Wellness & Health',
    allocatedCents: 35000, // $350.00
    spentCents: 28000, // $280.00
    period: 'monthly',
    rolloverEnabled: false,
    rolloverCents: 0,
    alertThresholdPercent: 90,
  },
  {
    id: 'bgt_entertainment',
    category: 'Entertainment',
    allocatedCents: 20000, // $200.00
    spentCents: 11000, // $110.00
    period: 'monthly',
    rolloverEnabled: true,
    rolloverCents: 2000,
    alertThresholdPercent: 80,
  },
];

export const initialGoals: SavingsGoal[] = [
  {
    id: 'goal_emergency',
    userId: 'user_pilot',
    name: 'Liquid Emergency Reserve (6 Mo)',
    targetCents: 5000000, // $50,000.00
    currentCents: 4815000, // $48,150.00 (96.3%)
    targetDate: '2026-12-31',
    priority: 'high',
    category: 'Safety Net',
    isPaused: false,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'goal_house',
    userId: 'user_pilot',
    name: 'Home Purchase Down Payment',
    targetCents: 8000000, // $80,000.00
    currentCents: 2200000, // $22,000.00 (27.5%)
    targetDate: '2028-06-30',
    priority: 'medium',
    category: 'Real Estate',
    isPaused: false,
    createdAt: '2026-03-15T00:00:00Z',
  },
  {
    id: 'goal_vacation',
    userId: 'user_pilot',
    name: 'Swiss Alps Hiking Expedition',
    targetCents: 450000, // $4,500.00
    currentCents: 320000, // $3,200.00 (71.1%)
    targetDate: '2026-11-20',
    priority: 'low',
    category: 'Travel',
    isPaused: false,
    createdAt: '2026-05-01T00:00:00Z',
  },
];

export const initialBills: BillSubscription[] = [
  {
    id: 'bill_fiber',
    userId: 'user_pilot',
    name: 'Gigabit Fiber Internet',
    amountCents: 8000, // $80.00
    frequency: 'monthly',
    nextDueDate: '2026-10-24',
    category: 'Utilities',
    accountId: 'acc_chase_chk',
    isAutoPay: true,
    status: 'due_soon',
    confidence: 'confirmed',
  },
  {
    id: 'bill_electric',
    userId: 'user_pilot',
    name: 'ConEdison Electric & Gas',
    amountCents: 12500, // $125.00
    frequency: 'monthly',
    nextDueDate: '2026-10-28',
    category: 'Utilities',
    accountId: 'acc_chase_chk',
    isAutoPay: false,
    status: 'due_soon',
    confidence: 'confirmed',
  },
  {
    id: 'bill_spotify',
    userId: 'user_pilot',
    name: 'Spotify Premium Family',
    amountCents: 1699, // $16.99
    frequency: 'monthly',
    nextDueDate: '2026-11-10',
    category: 'Entertainment',
    accountId: 'acc_amex_gold',
    isAutoPay: true,
    status: 'active',
    confidence: 'confirmed',
  },
  {
    id: 'bill_car_ins',
    userId: 'user_pilot',
    name: 'Geico Auto Insurance',
    amountCents: 14250, // $142.50
    frequency: 'monthly',
    nextDueDate: '2026-11-15',
    category: 'Insurance',
    accountId: 'acc_chase_chk',
    isAutoPay: true,
    status: 'active',
    confidence: 'confirmed',
  },
];

export const initialDebts: DebtAccount[] = [
  {
    id: 'debt_chase',
    userId: 'user_pilot',
    name: 'Chase Freedom Card',
    balanceCents: 245000, // $2,450.00
    aprPercent: 22.4, // High APR
    minimumPaymentCents: 7500, // $75.00
    dueDateDay: 18,
    category: 'credit_card',
  },
  {
    id: 'debt_auto',
    userId: 'user_pilot',
    name: 'Honda Financial Auto Loan',
    balanceCents: 1420000, // $14,200.00
    aprPercent: 5.9,
    minimumPaymentCents: 34000, // $340.00
    dueDateDay: 12,
    category: 'car_loan',
  },
  {
    id: 'debt_student',
    userId: 'user_pilot',
    name: 'Federal Direct Student Loan',
    balanceCents: 890000, // $8,900.00
    aprPercent: 4.8,
    minimumPaymentCents: 16500, // $165.00
    dueDateDay: 25,
    category: 'student_loan',
  },
];

export const defaultPreferences: UserPreferences = {
  userId: 'user_pilot',
  userName: 'Aseer',
  userEmail: 'aseer@wealthpilot.app',
  isAuthenticated: true,
  baseCurrency: 'USD',
  locale: 'en-US',
  timezone: 'America/New_York',
  theme: 'dark',
  isAiEnabled: true,
  isDemoMode: true,
  dateFormat: 'YYYY-MM-DD',
  reducedMotion: false,
  autoCategorizationRules: [
    { id: 'rule_1', keyword: 'Whole Foods', category: 'Groceries' },
    { id: 'rule_2', keyword: 'Sweetgreen', category: 'Dining' },
    { id: 'rule_3', keyword: 'Blue Bottle', category: 'Dining' },
    { id: 'rule_4', keyword: 'Equinox', category: 'Wellness & Health' },
    { id: 'rule_5', keyword: 'Spotify', category: 'Entertainment' },
    { id: 'rule_6', keyword: 'AWS', category: 'Business & Cloud' },
  ],
};
