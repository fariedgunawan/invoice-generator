import type {
  State,
  Item,
  DateObj,
  InvoicePeriod,
  CalculatedItem,
  InvoiceFinancialSummary,
  CalculationResult,
  ProductType,
  UnitType
} from '../types';
import {
  parseDate,
  dateToSerial,
  serialToDate,
  addMonths,
  makeNormalizedDate,
  calculateDays360
} from './dateUtils';
import { keepPrecision, keepPrecision9 } from './formatters';

// Map frekuensi billing ke jumlah bulan per invoice
const MONTHS_PER_INVOICE: Record<string, number> = {
  Monthly: 1,
  Quarterly: 3,
  Semester: 6,
  Yearly: 12
};

// Penyebut prorata (hari). Harga recurring dianggap per BULAN untuk semua frekuensi, sehingga
// durasi kontrak (bulan) = hari 30/360 / 30 dan faktor invoice = hari / 30
// (Quarterly penuh = 3 bulan, Semester = 6, Yearly = 12). Total kontrak = harga x durasi bulan.
export const PRORATA_BASIS: Record<string, number> = {
  Monthly: 30,
  Quarterly: 30,
  Semester: 30,
  Yearly: 30
};

// ============================================================================
// LANGKAH 1: Validasi Tanggal & Kalkulasi Durasi Kontrak
// ============================================================================
export interface DurationValidationResult {
  startDate: DateObj;
  endDate: DateObj;
  monthsPerInvoice: number;
  prorataBasis: number;
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
  const prorataBasis = PRORATA_BASIS[state.freq] || 30;
  // Cycle day hanya berlaku untuk Monthly; frekuensi lain memakai penambahan bulan dari start date
  const cycleDay = state.freq === 'Monthly' ? +state.cyc || 0 : 0;

  const isInvalidDateRange = dateToSerial(startDate) > dateToSerial(endDate);

  if (isInvalidDateRange) {
    warnings.push('Start is after end');
  }

  if (state.freq === 'Monthly' && !cycleDay && startDate.d > 28) {
    warnings.push('Start on the 29th-31st without a cycle day: enter a cycle day 1-28');
  }

  // Durasi kontrak berlangganan dalam satuan bulan menggunakan metode 30/360
  const recurringDuration = isInvalidDateRange
    ? 0
    : keepPrecision(calculateDays360(startDate, endDate) / prorataBasis);

  return {
    startDate,
    endDate,
    monthsPerInvoice,
    prorataBasis,
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
  isInvalidDateRange: boolean,
  prorataBasis: number = 30
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
    const proRataFactor = keepPrecision9(periodDays / prorataBasis);
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
  const itemUnit: UnitType = rawItem.unit || 'Unit';
  const isGb = (itemUnit || '').trim().toLowerCase() === 'gb';
  // Jika GB maka tidak di-rounding (presisi 2 angka di belakang koma), selain GB di-rounding bulat (Math.round)
  const roundItem = (val: number): number => (isGb ? keepPrecision(val) : Math.round(val));

  const baseItem: CalculatedItem = {
    id: rawItem.id,
    name: rawItem.name,
    type: rawItem.type,
    unit: itemUnit,
    price: 0,
    qty: 0,
    bt: rawItem.bt || 'Percentage',
    bv: +rawItem.bv || 0,
    bd: 0,
    totalBasicDiscount: 0,
    net: 0,
    dur: 0,
    tt: 0,
    at: rawItem.at || 'Amount',
    av: +rawItem.av || 0,
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

  const price = roundItem(+rawItem.price || 0);
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
    ? roundItem((price * basicDiscVal) / 100)
    : roundItem(basicDiscVal);

  // 2. Net Price per unit
  const netPrice = roundItem(price - basicDiscount);

  // 3. Durasi pengali (bulan untuk recurring, 1 untuk one-time, hari untuk DR)
  const duration = rawItem.type === 'Recurring'
    ? recurringDuration
    : rawItem.type === 'One time'
      ? 1
      : drDays;

  // Total Basic Discount untuk seluruh durasi kontrak
  const totalBasicDiscount = roundItem(basicDiscount * qty * duration);

  // 4. Total setelah basic discount ((Price per unit - Basic Discount) * Qty * Durasi, selalu di-rounding bulat)
  const totalAfterBasic = Math.round((price - basicDiscount) * qty * duration);
  

  // 5. Additional Discount (selalu di-rounding bulat)
  const additionalDiscount = Math.round(
    rawItem.at === 'Percentage'
      ? (totalAfterBasic * addlDiscVal) / 100
      : addlDiscVal
  );

  // 6. Grand Total item (selalu di-rounding bulat)
  const grandTotal = Math.round(totalAfterBasic - additionalDiscount);

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
    bt: rawItem.bt || 'Percentage',
    bv: basicDiscVal,
    bd: basicDiscount,
    totalBasicDiscount,
    net: netPrice,
    dur: duration,
    tt: totalAfterBasic,
    at: rawItem.at || 'Amount',
    av: addlDiscVal,
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
  let cumulativeBasicDiscount = 0;
  let cumulativeGrandTotal = 0;
  let drTargetInvoiceIndex = 0;

  const isGb = (item.unit || '').trim().toLowerCase() === 'gb';
  // Jika GB maka tidak di-rounding (presisi 2 angka di belakang koma), selain GB di-rounding bulat (Math.round)
  const roundItem = (val: number): number => (isGb ? keepPrecision(val) : Math.round(val));

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
    let periodTotalBasicDiscount = 0;
    let periodUnitPrice: number | '' = '';
    let periodBasicDiscount: number | '' = '';
    let periodNetPrice: number | '' = '';
    let periodGrandTotal = 0;

    if (item.type === 'Recurring') {
      if (item.dur) {
        // Price per unit di invoice (prorata terhadap faktor hari period.f)
        periodUnitPrice = roundItem(item.price * period.f);
        // Basic discount per unit di invoice
        periodBasicDiscount = item.bt === 'Percentage'
          ? roundItem((periodUnitPrice * item.bv) / 100)
          : roundItem(item.bd * period.f);
        // Net price per unit di invoice
        periodNetPrice = roundItem(periodUnitPrice - periodBasicDiscount);

        if (period.last) {
          // Periode terakhir menyerap sisa agar total invoice sama persis dengan total kontrak
          periodTotalBasicDiscount = roundItem(item.totalBasicDiscount - cumulativeBasicDiscount);
          // Total after basic di invoice menyerap sisa rounding agar total tepat sama dengan kontrak
          periodTotalAfterBasic = item.tt - cumulativeTotalAfterBasic;
          periodAdditionalDiscount = item.ad - cumulativeAdditionalDiscount;
          periodGrandTotal = item.gt - cumulativeGrandTotal;
        } else {
          // Total basic discount di invoice: Basic discount / unit * Qty
          periodTotalBasicDiscount = roundItem(periodBasicDiscount * item.qty);
          // Rumus: (Price per unit - Basic discount per unit) * qty = Net price per unit * qty (di-rounding bulat)
          periodTotalAfterBasic = Math.round(periodNetPrice * item.qty);
          periodAdditionalDiscount = Math.round((item.ad * period.f) / item.dur);
          periodGrandTotal = Math.round(periodTotalAfterBasic - periodAdditionalDiscount);
        }
      }
      cumulativeTotalAfterBasic += periodTotalAfterBasic;
      cumulativeAdditionalDiscount += periodAdditionalDiscount;
      cumulativeBasicDiscount = roundItem(cumulativeBasicDiscount + periodTotalBasicDiscount);
      cumulativeGrandTotal += periodGrandTotal;
    } else if (
      (item.type === 'One time' && k === 0) ||
      (item.type === 'DR (Daily)' && k === drTargetInvoiceIndex)
    ) {
      // One-time ditagihkan penuh di INV 1; DR ditagihkan penuh di invoice periode mulainya
      periodTotalAfterBasic = item.tt;
      periodAdditionalDiscount = item.ad;
      periodTotalBasicDiscount = item.totalBasicDiscount;
      periodUnitPrice = item.price;
      periodBasicDiscount = item.bd;
      periodNetPrice = item.net;
      periodGrandTotal = item.gt;
    }

    item.rows.push({
      pr: periodUnitPrice,
      dc: periodBasicDiscount,
      nt: periodNetPrice,
      tbd: periodTotalBasicDiscount,
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
    return keepPrecision(
      activeItems.filter(i => i.type === type).reduce((acc, i) => acc + selector(i), 0)
    );
  };

  const taxRate = (+taxPercent || 0) / 100;
  const deductedTaxRate = (+deductedTaxPercent || 0) / 100;

  // Jika terdapat item bertipe GB, summary mempertahankan presisi 2 desimal. Jika semua non-GB, dibulatkan integer.
  const hasAnyGb = activeItems.some(item => (item.unit || '').trim().toLowerCase() === 'gb');
  const roundSummary = (val: number): number => (hasAnyGb ? keepPrecision(val) : Math.round(val));

  const sumAll = (selector: (it: CalculatedItem) => number): number => {
    return roundSummary(
      activeItems.reduce((acc, i) => acc + selector(i), 0)
    );
  };

  // Ringkasan Finansial Sales Order Keseluruhan
  const soOne = sumByType('One time', i => i.gt);
  const soRec = sumByType('Recurring', i => i.gt);
  const soDr = sumByType('DR (Daily)', i => i.gt);
  const soPreTax = roundSummary(soOne + soRec + soDr);
  // Pajak & potongan pajak selalu dibulatkan bulat (integer rounding)
  const soTax = Math.round(soPreTax * taxRate);
  const soDeductedTax = Math.round(soPreTax * deductedTaxRate);
  const soGrandTotal = Math.round(soPreTax + soTax - soDeductedTax);

  // Nilai sebelum pembulatan (untuk ditampilkan 2 desimal pada tabel breakdown)
  const soPreRaw = soOne + soRec + soDr;
  const soTaxRaw = soPreTax * taxRate;
  const soDedRaw = soPreTax * deductedTaxRate;
  const soGrandRaw = soPreRaw + soTaxRaw - soDedRaw;

  const soSummary: InvoiceFinancialSummary = {
    one: soOne,
    rec: soRec,
    dr: soDr,
    totalBasicDisc: sumAll(i => i.totalBasicDiscount),
    totalAddlDisc: sumAll(i => i.ad),
    pre: soPreTax,
    tax: soTax,
    ded: soDeductedTax,
    grand: soGrandTotal,
    preRaw: soPreRaw,
    taxRaw: soTaxRaw,
    dedRaw: soDedRaw,
    grandRaw: soGrandRaw
  };

  // Ringkasan Finansial untuk Masing-Masing Kolom Invoice
  const invoiceColumns: InvoiceFinancialSummary[] = periods.map((period, k) => {
    const colOne = sumByType('One time', i => i.rows[k].gt);
    const colRec = sumByType('Recurring', i => i.rows[k].gt);
    const colDr = sumByType('DR (Daily)', i => i.rows[k].gt);
    const colPreTax = roundSummary(colOne + colRec + colDr);

    // Pajak dan potongan pajak tiap invoice dibulatkan murni (Math.round) dari pre-tax invoice tersebut.
    // Tidak ada penyerapan selisih: jika jumlah pajak seluruh invoice berbeda dengan pajak SO
    // (akibat pembulatan per invoice), selisihnya ditampilkan apa adanya pada kolom Difference.
    const colTax = Math.round(colPreTax * taxRate);
    const colDeductedTax = Math.round(colPreTax * deductedTaxRate);

    const colGrandTotal = Math.round(colPreTax + colTax - colDeductedTax);

    // Nilai sebelum pembulatan (untuk ditampilkan 2 desimal pada tabel breakdown)
    const colPreRaw = colOne + colRec + colDr;
    const colTaxRaw = colPreTax * taxRate;
    const colDedRaw = colPreTax * deductedTaxRate;
    const colGrandRaw = colPreRaw + colTaxRaw - colDedRaw;

    return {
      one: colOne,
      rec: colRec,
      dr: colDr,
      totalBasicDisc: sumAll(i => +i.rows[k].tbd || 0),
      totalAddlDisc: sumAll(i => +i.rows[k].ad || 0),
      pre: colPreTax,
      tax: colTax,
      ded: colDeductedTax,
      grand: colGrandTotal,
      preRaw: colPreRaw,
      taxRaw: colTaxRaw,
      dedRaw: colDedRaw,
      grandRaw: colGrandRaw,
      label: `INV ${k + 1}`,
      p: period
    };
  });

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
    prorataBasis,
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
    isInvalidDateRange,
    prorataBasis
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

  // Total diskon dasar seluruh produk (semua tipe)
  const totalBasicDiscount = keepPrecision(
    activeItems.reduce((acc, item) => acc + item.totalBasicDiscount, 0)
  );

  return {
    W: warnings,
    dur: recurringDuration,
    mpi: monthsPerInvoice,
    per: periods,
    all: allItems,
    its: activeItems,
    so: soSummary,
    cols: invoiceColumns,
    totalBasicDiscount
  };
}
