import type {
  State,
  Item,
  DateObj,
  InvoicePeriod,
  CalculatedItem,
  InvoiceFinancialSummary,
  CalculationResult,
  ProductType
} from '../types';
import {
  parseDate,
  dateToSerial,
  serialToDate,
  addMonths,
  makeNormalizedDate,
  calculateDays360
} from './dateUtils';
import { keepPrecision9 } from './formatters';

// Map frekuensi billing ke jumlah bulan per invoice
const MONTHS_PER_INVOICE: Record<string, number> = {
  Monthly: 1,
  Quarterly: 3,
  Semester: 6,
  Yearly: 12
};

// ============================================================================
// LANGKAH 1: Validasi Tanggal & Kalkulasi Durasi Kontrak
// ============================================================================
export interface DurationValidationResult {
  startDate: DateObj;
  endDate: DateObj;
  monthsPerInvoice: number;
  cycleDay: number;
  isInvalidDateRange: boolean;
  recurringDuration: number;
  warnings: string[];
}

export function validateAndGetDuration(state: State): DurationValidationResult {
  const warnings: string[] = [];
  const startDate = parseDate(state.start || '2000-01-01');
  const endDate = parseDate(state.end || '2000-01-01');
  const monthsPerInvoice = MONTHS_PER_INVOICE[state.freq] || 1;
  const cycleDay = +state.cyc || 0;

  const isInvalidDateRange = dateToSerial(startDate) > dateToSerial(endDate);

  if (isInvalidDateRange) {
    warnings.push('Start is after end');
  }

  if (!cycleDay && startDate.d > 28) {
    warnings.push('Start on the 29th-31st without a cycle day: enter a cycle day 1-28');
  }

  // Durasi kontrak berlangganan dalam satuan bulan menggunakan metode 30/360
  const recurringDuration = isInvalidDateRange
    ? 0
    : keepPrecision9(calculateDays360(startDate, endDate) / 30);

  return {
    startDate,
    endDate,
    monthsPerInvoice,
    cycleDay,
    isInvalidDateRange,
    recurringDuration,
    warnings
  };
}

// ============================================================================
// LANGKAH 2: Pembuatan Jadwal Periode Invoice (Billing Periods)
// ============================================================================
export function generateBillingPeriods(
  startDate: DateObj,
  endDate: DateObj,
  monthsPerInvoice: number,
  cycleDay: number,
  isInvalidDateRange: boolean
): { periods: InvoicePeriod[]; periodWarning?: string } {
  const periods: InvoicePeriod[] = [];
  const maxInvoices = 25;

  for (let k = 1; k <= maxInvoices && !isInvalidDateRange; k++) {
    let periodStart = startDate;

    if (k > 1) {
      const prevEndSerial = dateToSerial(periods[k - 2].e);
      if (prevEndSerial >= dateToSerial(endDate)) break;
      periodStart = serialToDate(prevEndSerial + 1);
    }

    // Tentukan batas cutoff berikutnya (berdasarkan cycle day atau penambahan bulan)
    const nextCutoff = !cycleDay
      ? addMonths(startDate, monthsPerInvoice * k)
      : periodStart.d === cycleDay
      ? addMonths(periodStart, monthsPerInvoice)
      : periodStart.d < cycleDay
      ? makeNormalizedDate(periodStart.y, periodStart.m, cycleDay)
      : makeNormalizedDate(periodStart.y, periodStart.m + 1, cycleDay);

    const periodEnd = serialToDate(Math.min(dateToSerial(endDate), dateToSerial(nextCutoff) - 1));
    const periodDays = calculateDays360(periodStart, periodEnd);
    const proRataFactor = keepPrecision9(periodDays / 30);
    const isLastPeriod = dateToSerial(periodEnd) === dateToSerial(endDate);

    periods.push({
      s: periodStart,
      e: periodEnd,
      days: periodDays,
      f: proRataFactor,
      last: isLastPeriod
    });
  }

  let periodWarning: string | undefined;
  if (periods.length && dateToSerial(periods[periods.length - 1].e) < dateToSerial(endDate)) {
    periodWarning = 'More than 25 invoices needed (max 25)';
  }

  return { periods, periodWarning };
}

// ============================================================================
// LANGKAH 3: Kalkulasi Nilai Dasar Produk (Price, Discounts, Grand Total)
// ============================================================================
export function calculateItemBaseMetrics(
  rawItem: Item,
  index: number,
  recurringDuration: number
): CalculatedItem {
  const isUsed = rawItem.price !== '';
  const baseItem: CalculatedItem = {
    id: rawItem.id,
    name: rawItem.name,
    type: rawItem.type,
    price: 0,
    qty: 0,
    bd: 0,
    net: 0,
    dur: 0,
    tt: 0,
    ad: 0,
    gt: 0,
    pct: 0,
    so: rawItem.so,
    ds: rawItem.ds,
    de: rawItem.de,
    used: isUsed,
    origIndex: index,
    rows: []
  };

  if (!isUsed) return baseItem;

  const price = keepPrecision9(+rawItem.price || 0);
  const qty = +rawItem.qty || 0;
  const basicDiscVal = +rawItem.bv || 0;
  const addlDiscVal = +rawItem.av || 0;
  const isBasicPercentage = rawItem.bt === 'Percentage';

  // Durasi harian untuk tipe Daily Rate (DR)
  let drDays = 0;
  if (rawItem.type === 'DR (Daily)' && rawItem.ds && rawItem.de) {
    const d1 = parseDate(rawItem.ds);
    const d2 = parseDate(rawItem.de);
    drDays = Math.max(0, calculateDays360(d1, d2));
  }

  // 1. Basic Discount per unit
  const basicDiscount = isBasicPercentage
    ? keepPrecision9((price * basicDiscVal) / 100)
    : keepPrecision9(basicDiscVal);

  // 2. Net Price per unit
  const netPrice = keepPrecision9(price - basicDiscount);

  // 3. Durasi pengali (bulan untuk recurring, 1 untuk one-time, hari untuk DR)
  const duration = rawItem.type === 'Recurring'
    ? recurringDuration
    : rawItem.type === 'One time'
    ? 1
    : drDays;

  // 4. Total setelah basic discount (Net × Qty × Durasi)
  const totalAfterBasic = keepPrecision9(netPrice * qty * duration);

  // 5. Additional Discount
  const additionalDiscount = rawItem.at === 'Percentage'
    ? keepPrecision9((totalAfterBasic * addlDiscVal) / 100)
    : keepPrecision9(addlDiscVal);

  // 6. Grand Total item
  const grandTotal = keepPrecision9(totalAfterBasic - additionalDiscount);

  // 7. Rasio diskon dasar (untuk merekonstruksi harga unit pada periode prorata)
  const discountRatio = isBasicPercentage
    ? basicDiscVal / 100
    : price
    ? basicDiscVal / price
    : 0;

  return {
    ...baseItem,
    price,
    qty,
    bd: basicDiscount,
    net: netPrice,
    dur: duration,
    tt: totalAfterBasic,
    ad: additionalDiscount,
    gt: grandTotal,
    pct: discountRatio
  };
}

// ============================================================================
// LANGKAH 4: Alokasi Nilai Produk ke Setiap Periode Invoice
// ============================================================================
export function allocateItemToPeriods(
  item: CalculatedItem,
  periods: InvoicePeriod[]
): void {
  item.rows = [];
  let cumulativeTotalAfterBasic = 0;
  let cumulativeAdditionalDiscount = 0;
  let drTargetInvoiceIndex = 0;

  // Untuk DR: cari invoice yang mencakup tanggal mulai DR
  if (item.type === 'DR (Daily)' && item.ds) {
    const drStartSerial = dateToSerial(parseDate(item.ds));
    drTargetInvoiceIndex = periods.findIndex(
      p => dateToSerial(p.s) <= drStartSerial && drStartSerial <= dateToSerial(p.e)
    );
    if (drTargetInvoiceIndex === -1) {
      drTargetInvoiceIndex = drStartSerial < dateToSerial(periods[0].s) ? 0 : periods.length - 1;
    }
  }

  periods.forEach((period, k) => {
    let periodTotalAfterBasic = 0;
    let periodAdditionalDiscount = 0;
    let periodUnitPrice: number | '' = '';
    let periodBasicDiscount: number | '' = '';
    let periodNetPrice: number | '' = '';

    if (item.type === 'Recurring') {
      if (item.dur) {
        if (period.last) {
          // Periode terakhir menyerap sisa agar total invoice sama persis dengan total kontrak
          periodTotalAfterBasic = keepPrecision9(item.tt - cumulativeTotalAfterBasic);
          periodAdditionalDiscount = keepPrecision9(item.ad - cumulativeAdditionalDiscount);
        } else {
          // Prorata berdasarkan rasio bulan periode terhadap total durasi
          periodTotalAfterBasic = keepPrecision9((item.tt * period.f) / item.dur);
          periodAdditionalDiscount = keepPrecision9((item.ad * period.f) / item.dur);
        }

        periodNetPrice = keepPrecision9(item.qty ? periodTotalAfterBasic / item.qty : 0);
        periodUnitPrice = item.pct >= 1 ? 0 : keepPrecision9(periodNetPrice / (1 - item.pct));
        periodBasicDiscount = keepPrecision9(periodUnitPrice - periodNetPrice);
      }
      cumulativeTotalAfterBasic = keepPrecision9(cumulativeTotalAfterBasic + periodTotalAfterBasic);
      cumulativeAdditionalDiscount = keepPrecision9(cumulativeAdditionalDiscount + periodAdditionalDiscount);
    } else if (
      (item.type === 'One time' && k === 0) ||
      (item.type === 'DR (Daily)' && k === drTargetInvoiceIndex)
    ) {
      // One-time ditagihkan penuh di INV 1; DR ditagihkan penuh di invoice periode mulainya
      periodTotalAfterBasic = item.tt;
      periodAdditionalDiscount = item.ad;
      periodUnitPrice = item.price;
      periodBasicDiscount = item.bd;
      periodNetPrice = item.net;
    }

    const periodGrandTotal = keepPrecision9(periodTotalAfterBasic - periodAdditionalDiscount);

    item.rows.push({
      pr: periodUnitPrice,
      dc: periodBasicDiscount,
      nt: periodNetPrice,
      tt: periodTotalAfterBasic,
      ad: periodAdditionalDiscount,
      gt: periodGrandTotal
    });
  });
}

// ============================================================================
// LANGKAH 5: Agregasi Subtotal, Pajak, dan Grand Total Invoice
// ============================================================================
export function calculateInvoiceSummaries(
  activeItems: CalculatedItem[],
  periods: InvoicePeriod[],
  taxPercent: string,
  deductedTaxPercent: string
): { soSummary: InvoiceFinancialSummary; invoiceColumns: InvoiceFinancialSummary[] } {
  const sumByType = (type: ProductType, selector: (it: CalculatedItem) => number): number => {
    return keepPrecision9(
      activeItems.filter(i => i.type === type).reduce((acc, i) => acc + selector(i), 0)
    );
  };

  const taxRate = (+taxPercent || 0) / 100;
  const deductedTaxRate = (+deductedTaxPercent || 0) / 100;

  // Fungsi helper untuk menghitung Pre-tax, Pajak, Potongan Pajak, dan Grand Total
  const buildFinancialSummary = (subtotals: {
    one: number;
    rec: number;
    dr: number;
  }): InvoiceFinancialSummary => {
    const preTax = keepPrecision9(subtotals.one + subtotals.rec + subtotals.dr);
    const tax = keepPrecision9(preTax * taxRate);
    const deductedTax = keepPrecision9(preTax * deductedTaxRate);
    const grandTotal = keepPrecision9(preTax + tax - deductedTax);

    return {
      one: subtotals.one,
      rec: subtotals.rec,
      dr: subtotals.dr,
      pre: preTax,
      tax,
      ded: deductedTax,
      grand: grandTotal
    };
  };

  // Ringkasan Finansial Sales Order Keseluruhan
  const soSummary = buildFinancialSummary({
    one: sumByType('One time', i => i.gt),
    rec: sumByType('Recurring', i => i.gt),
    dr: sumByType('DR (Daily)', i => i.gt)
  });

  // Ringkasan Finansial untuk Masing-Masing Kolom Invoice
  const invoiceColumns = periods.map((period, k) => ({
    ...buildFinancialSummary({
      one: sumByType('One time', i => i.rows[k].gt),
      rec: sumByType('Recurring', i => i.rows[k].gt),
      dr: sumByType('DR (Daily)', i => i.rows[k].gt)
    }),
    label: `INV ${k + 1}`,
    p: period
  }));

  return { soSummary, invoiceColumns };
}

// ============================================================================
// FUNGSI UTAMA: calculate()
// ============================================================================
/**
 * Alur Perhitungan Keseluruhan:
 * 1. Validasi tanggal dan hitung durasi bulan kontrak (30/360)
 * 2. Generate jadwal periode invoice berdasarkan cycle day dan frekuensi
 * 3. Hitung nilai dasar setiap item (harga, diskon dasar, net, diskon tambahan, grand total)
 * 4. Alokasikan nilai setiap item ke dalam masing-masing periode invoice
 * 5. Agregasikan ringkasan finansial (Pre-tax, Pajak, Grand Total) untuk SO dan tiap invoice
 */
export function calculate(state: State): CalculationResult {
  // 1. Validasi tanggal & durasi
  const {
    startDate,
    endDate,
    monthsPerInvoice,
    cycleDay,
    isInvalidDateRange,
    recurringDuration,
    warnings
  } = validateAndGetDuration(state);

  // 2. Buat jadwal invoice
  const { periods, periodWarning } = generateBillingPeriods(
    startDate,
    endDate,
    monthsPerInvoice,
    cycleDay,
    isInvalidDateRange
  );
  if (periodWarning) {
    warnings.push(periodWarning);
  }

  // 3. Hitung metrik dasar semua item
  const allItems: CalculatedItem[] = state.items.map((rawItem, idx) =>
    calculateItemBaseMetrics(rawItem, idx, recurringDuration)
  );
  const activeItems = allItems.filter(item => item.used);

  // 4. Alokasikan item aktif ke setiap periode invoice
  activeItems.forEach(item => {
    allocateItemToPeriods(item, periods);
  });

  // 5. Agregasikan subtotal finansial
  const { soSummary, invoiceColumns } = calculateInvoiceSummaries(
    activeItems,
    periods,
    state.tx,
    state.dx
  );

  return {
    W: warnings,
    dur: recurringDuration,
    mpi: monthsPerInvoice,
    per: periods,
    all: allItems,
    its: activeItems,
    so: soSummary,
    cols: invoiceColumns
  };
}
