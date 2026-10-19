/**
 * Loan types explained in plain words. General guidance only: no rates are claimed for a type or a
 * bank (the country's World Bank average lending rate is shown next to this as the benchmark).
 */

import type { LoanOffer } from '@/types/finance';

export type LoanPurpose = LoanOffer['purpose'];

export interface LoanType {
  purpose: LoanPurpose;
  label: string;
  summary: string;
  secured: string;
  termMonths: { min: number; typical: number; max: number };
  lowersRate: string[];
  documents: string[];
  ask: string[];
}

export const LOAN_TYPES: LoanType[] = [
  {
    purpose: 'personal',
    label: 'Personal loan',
    summary: 'Cash for any purpose, repaid in fixed monthly payments. Usually the most expensive common loan because nothing backs it.',
    secured: 'Usually unsecured',
    termMonths: { min: 6, typical: 36, max: 84 },
    lowersRate: ['A steady salary paid into the same bank', 'Low existing debt payments (under 36% of income)', 'A good repayment history'],
    documents: ['ID', 'Proof of income (salary slips or bank statements)', 'Proof of address'],
    ask: ['What is the APR including all fees?', 'Is there a fee for paying early?', 'Is the rate fixed for the whole term?'],
  },
  {
    purpose: 'car',
    label: 'Car loan',
    summary: 'Pays for a vehicle; the car is the security, so rates are usually lower than a personal loan.',
    secured: 'Secured by the car',
    termMonths: { min: 12, typical: 60, max: 84 },
    lowersRate: ['A bigger down payment', 'A newer car', 'A shorter term'],
    documents: ['ID', 'Proof of income', 'Car quotation or invoice', 'Insurance details'],
    ask: ['How much down payment do you need?', 'Is insurance required through the bank?', 'What happens if I sell the car early?'],
  },
  {
    purpose: 'home',
    label: 'Home loan (mortgage)',
    summary: 'Buys or builds a home, repaid over many years; the property is the security. Small rate differences add up to large sums.',
    secured: 'Secured by the property',
    termMonths: { min: 60, typical: 240, max: 360 },
    lowersRate: ['A bigger down payment (lower loan-to-value)', 'Stable long-term income', 'Choosing fixed vs variable rate to suit you'],
    documents: ['ID', 'Proof of income (often 1–2 years)', 'Property papers and valuation', 'Tax returns'],
    ask: ['Is the rate fixed or variable, and for how long?', 'What are the processing, valuation and legal fees?', 'Can I pay extra without a penalty?'],
  },
  {
    purpose: 'education',
    label: 'Education loan',
    summary: 'Pays tuition and study costs; repayment often starts after the course ends.',
    secured: 'Often unsecured for smaller amounts; a guarantor may be needed',
    termMonths: { min: 12, typical: 84, max: 180 },
    lowersRate: ['Admission to a recognised institution', 'A co-applicant or guarantor with steady income', 'Government or institution schemes where available'],
    documents: ['Admission letter', 'Fee schedule', 'ID of student and co-applicant', 'Co-applicant income proof'],
    ask: ['Is there a grace period before repayment starts?', 'Does interest build up during the course?', 'Are there subsidised schemes I qualify for?'],
  },
  {
    purpose: 'business',
    label: 'Business loan',
    summary: 'Funds equipment, stock or working capital. Lenders look at the business’s cash flow as much as your income.',
    secured: 'Secured or unsecured, depending on size',
    termMonths: { min: 6, typical: 48, max: 120 },
    lowersRate: ['Several years of trading history', 'Clear accounts and cash flow', 'Collateral or a guarantee'],
    documents: ['Business registration', 'Bank statements (6–12 months)', 'Financial statements or tax returns', 'A short business plan'],
    ask: ['Is the rate fixed or tied to a benchmark?', 'Are there monthly account or service fees?', 'Can repayments be seasonal?'],
  },
];

export const loanType = (purpose: LoanPurpose) => LOAN_TYPES.find((t) => t.purpose === purpose) ?? LOAN_TYPES[0];
