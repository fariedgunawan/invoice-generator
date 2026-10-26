// Types for Invoice Generator

export type ProductType = 'One time' | 'Recurring' | 'DR (Daily)';
export type AmountType = 'Amount' | 'Percentage';
export type BillingFrequency = 'Monthly' | 'Quarterly' | 'Semester' | 'Yearly';

/**
 * Single product item input in the form
 */
export interface Item {
  id: string;
  name: string;
  type: ProductType;
  price: string;
  bt: AmountType; // Basic discount type ('Amount' | 'Percentage')
  bv: string;     // Basic discount value
  qty: string;    // Quantity
  ds: string;     // Date start (DR / Daily)
  de: string;     // Date end (DR / Daily)
  at: AmountType; // Additional discount type ('Amount' | 'Percentage')
  av: string;     // Additional discount value
  so: string;     // Sales Order Expected Grand Total
}

/**
 * Global form state
 */
export interface State {
  start: string;          // Subscription start date (YYYY-MM-DD)
  end: string;            // Subscription end date (YYYY-MM-DD)
  freq: BillingFrequency; // Billing frequency
  cyc: string;            // Billing cycle cutoff day (e.g. '20')
  tx: string;             // Taxes & charges rate (%)
  dx: string;             // Deducted taxes rate (%)
  xn: string;             // Target currency code/name (e.g. 'IDR')
  xr: string;             // Exchange rate multiplier
  items: Item[];          // Product item list
}

/**
 * Parsed date structure
 */
export interface DateObj {
  y: number; // Year (e.g. 2026)
  m: number; // Month (1 - 12)
  d: number; // Day (1 - 31)
}

/**
 * Single invoice billing period (schedule)
 */
export interface InvoicePeriod {
  s: DateObj;    // Period start date
  e: DateObj;    // Period end date
  days: number;  // 30/360 days in this period
  f: number;     // Pro-rata factor (days / 30)
  last: boolean; // Is this the final period?
}

/**
 * Item values allocated to a specific invoice period
 */
export interface CalculatedItemRow {
  pr: number | ''; // Unit price in this period
  dc: number | ''; // Basic discount per unit in this period
  nt: number | ''; // Net price per unit in this period
  tt: number;      // Total after basic discount in this period
  ad: number;      // Additional discount in this period
  gt: number;      // Item grand total in this period (tt - ad)
}

/**
 * Product item enriched with calculated base metrics and period allocations
 */
export interface CalculatedItem {
  id?: string;
  name: string;
  type: ProductType;
  price: number;   // Unit base price
  qty: number;     // Quantity
  bd: number;      // Basic discount amount per unit
  net: number;     // Net price per unit (price - bd)
  dur: number;     // Duration (months for recurring, 1 for one-time, days for DR)
  tt: number;      // Total after basic discount (net * qty * dur)
  ad: number;      // Additional discount amount
  gt: number;      // Item Grand Total (tt - ad)
  pct: number;     // Basic discount percentage ratio
  so: string;      // SO target value
  ds: string;
  de: string;
  used: boolean;
  origIndex: number;
  rows: CalculatedItemRow[];
}

/**
 * Summary of financial figures (Pre-tax, Tax, Deducted Tax, Grand Total)
 */
export interface InvoiceFinancialSummary {
  one: number;             // One-time total
  rec: number;             // Recurring total
  dr: number;              // DR (Daily) total
  pre: number;             // Pre-tax subtotal (one + rec + dr)
  tax: number;             // Taxes & charges
  ded: number;             // Deducted taxes
  grand: number;           // Grand total (pre + tax - ded)
  label?: string;          // e.g. 'INV 1'
  p?: InvoicePeriod;       // Associated period details
  [key: string]: number | string | InvoicePeriod | undefined;
}

/**
 * Complete calculation result returned by calculate()
 */
export interface CalculationResult {
  W: string[];                         // Validation and reconciliation warnings
  dur: number;                         // Total recurring duration in months
  mpi: number;                         // Months per invoice
  per: InvoicePeriod[];                // Invoice schedule periods
  all: CalculatedItem[];               // All product items (with calculation metrics)
  its: CalculatedItem[];               // Active product items (with price specified)
  so: InvoiceFinancialSummary;         // Expected Sales Order totals
  cols: InvoiceFinancialSummary[];     // Generated invoice breakdown columns
}
