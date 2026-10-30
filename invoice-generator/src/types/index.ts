export type ProductType = 'One time' | 'Recurring' | 'DR (Daily)';
export type DiscountType = 'Amount' | 'Percentage';
export type BillingFrequency = 'Monthly' | 'Quarterly' | 'Semester' | 'Yearly';
export type UnitType = 'Unit' | 'GB';
export type ThemeMode = 'light' | 'dark';

export interface ProductItem {
  id: string;
  name: string;
  type: ProductType;
  unit: UnitType;
  price: string;
  basicDiscountType: DiscountType;
  basicDiscountValue: string;
  quantity: string;
  dailyRateStartDate: string;
  dailyRateEndDate: string;
  additionalDiscountType: DiscountType;
  additionalDiscountValue: string;
  salesOrderExpectedTotal: string;
}

export interface InvoiceCalculatorState {
  startDate: string;
  endDate: string;
  billingFrequency: BillingFrequency;
  cycleDay: string;
  taxRatePercent: string;
  deductedTaxRatePercent: string;
  targetCurrency: string;
  exchangeRate: string;
  items: ProductItem[];
}

export interface DateObject {
  year: number;
  month: number;
  day: number;
}

export interface InvoicePeriod {
  startDate: DateObject;
  endDate: DateObject;
  days: number;
  proRataFactor: number;
  isLastPeriod: boolean;
}

export interface CalculatedProductPeriodRow {
  unitPrice: number | '';
  basicDiscountPerUnit: number | '';
  netPricePerUnit: number | '';
  totalBasicDiscount: number;
  totalAfterBasicDiscount: number;
  additionalDiscountAmount: number;
  grandTotal: number;
}

export interface CalculatedProductItem {
  id?: string;
  name: string;
  type: ProductType;
  unit: UnitType;
  price: number;
  quantity: number;
  basicDiscountType: DiscountType;
  basicDiscountValue: number;
  basicDiscountPerUnit: number;
  totalBasicDiscount: number;
  netPricePerUnit: number;
  duration: number;
  totalAfterBasicDiscount: number;
  additionalDiscountType: DiscountType;
  additionalDiscountValue: number;
  additionalDiscountAmount: number;
  grandTotal: number;
  basicDiscountRatio: number;
  salesOrderExpectedTotal: string;
  dailyRateStartDate: string;
  dailyRateEndDate: string;
  isUsed: boolean;
  originalIndex: number;
  periodRows: CalculatedProductPeriodRow[];
}

export interface InvoiceFinancialSummary {
  oneTimeTotal: number;
  recurringTotal: number;
  dailyRateTotal: number;
  totalBasicDiscount: number;
  totalAdditionalDiscount: number;
  preTaxTotal: number;
  taxAmount: number;
  deductedTaxAmount: number;
  grandTotal: number;
  preTaxRaw: number;
  taxRaw: number;
  deductedTaxRaw: number;
  grandTotalRaw: number;
  label?: string;
  period?: InvoicePeriod;
  [key: string]: number | string | InvoicePeriod | undefined;
}

export interface CalculationResult {
  warnings: string[];
  recurringDurationMonths: number;
  monthsPerInvoice: number;
  billingPeriods: InvoicePeriod[];
  allCalculatedItems: CalculatedProductItem[];
  activeCalculatedItems: CalculatedProductItem[];
  salesOrderSummary: InvoiceFinancialSummary;
  invoiceColumns: InvoiceFinancialSummary[];
  totalBasicDiscount: number;
}

export interface TableDisplayRow {
  id?: string;
  customClass?: string;
  isCurrency?: boolean;
  values: (string | number)[];
  rawValues?: (string | number)[];
}
