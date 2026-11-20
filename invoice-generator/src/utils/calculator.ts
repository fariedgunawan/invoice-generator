import type {
  InvoiceCalculatorState,
  ProductItem,
  ProductStatus,
  DateObject,
  InvoicePeriod,
  CalculatedProductItem,
  CalculatedProductPeriodRow,
  InvoiceFinancialSummary,
  CalculationResult,
  ProductType,
  DiscountType,
  UnitType,
  TableDisplayRow
} from '../types';

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const MONTHS_PER_INVOICE_MAP: Record<string, number> = {
  Monthly: 1,
  Quarterly: 3,
  Semester: 6,
  Yearly: 12
};

export const PRORATA_BASIS_MAP: Record<string, number> = {
  Monthly: 30,
  Quarterly: 30,
  Semester: 30,
  Yearly: 30
};

export function roundToInteger(value: number): number {
  return Math.round(value);
}

export function roundToTwoDecimals(value: number): number {
  let roundedValue = Number(`${Math.round(Number(`${value}e9`))}e-9`);
  for (let decimals = 8; decimals >= 2; decimals--) {
    roundedValue = Number(`${Math.round(Number(`${roundedValue}e${decimals}`))}e-${decimals}`);
  }
  return roundedValue;
}

export function roundToNineDecimals(value: number): number {
  return Number(value.toFixed(9));
}

export function isGigabyteUnit(unit: UnitType): boolean {
  return (unit || '').trim().toLowerCase() === 'gb';
}

export function roundByUnitType(value: number, unit: UnitType): number {
  return isGigabyteUnit(unit) ? roundToTwoDecimals(value) : roundToInteger(value);
}

export function formatDisplayNumber(value: unknown, maxFractionDigits = 2): string {
  if (value === '' || value == null) return '';
  if (typeof value === 'number') {
    return value.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits });
  }
  return String(value);
}

export function formatNumberWithTwoDecimals(value: unknown): string {
  if (typeof value !== 'number') return value === '' || value == null ? '' : String(value);
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatNumberWithNineDecimals(value: unknown): string {
  return formatDisplayNumber(value, 9);
}

export function formatDateToDisplay(date: DateObject): string {
  const paddedDay = String(date.day).padStart(2, '0');
  const monthName = MONTH_NAMES[date.month - 1];
  return `${paddedDay}-${monthName}-${date.year}`;
}

export function adjustDayFor360Convention(day: number): number {
  return [28, 29, 31].includes(day) ? 30 : day;
}

export function parseDateString(dateString: string): DateObject {
  const [year, month, day] = (dateString || '').replace(/\//g, '-').split('-').map(Number);
  return {
    year: year || 2000,
    month: month || 1,
    day: day || 1
  };
}

export function convertDateToSerialDays(date: DateObject): number {
  return Date.UTC(date.year, date.month - 1, date.day) / 86400000;
}

export function convertSerialDaysToDate(serialDays: number): DateObject {
  const utcDate = new Date(serialDays * 86400000);
  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate()
  };
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonthsToDate(date: DateObject, monthsToAdd: number): DateObject {
  const totalMonths = date.year * 12 + date.month - 1 + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const maxDayInTargetMonth = getDaysInMonth(targetYear, targetMonth);
  return {
    year: targetYear,
    month: targetMonth,
    day: Math.min(date.day, maxDayInTargetMonth)
  };
}

export function createNormalizedDate(year: number, month: number, day: number): DateObject {
  const totalMonths = year * 12 + month - 1;
  return {
    year: Math.floor(totalMonths / 12),
    month: (totalMonths % 12) + 1,
    day
  };
}

export function calculateDays360Between(startDate: DateObject, endDate: DateObject): number {
  return (
    (endDate.year - startDate.year) * 360 +
    (endDate.month - startDate.month) * 30 +
    adjustDayFor360Convention(endDate.day) -
    adjustDayFor360Convention(startDate.day) +
    1
  );
}

export function calculateProRataFactor(days: number, prorataBasis = 30): number {
  return roundToNineDecimals(days / prorataBasis);
}

export function isProductStatusDeleted(status: ProductStatus): boolean {
  return status === 'Delete';
}

export function isProductStatusSuspended(status: ProductStatus): boolean {
  return status === 'Suspend';
}

export function isProductStatusTerminated(status: ProductStatus): boolean {
  return status === 'Terminate';
}

export function isProductStatusBillable(status: ProductStatus): boolean {
  return status === 'Production' || status === 'Suspend' || status === 'Terminate';
}

export function canApplyTerminateAllToProduct(item: ProductItem): boolean {
  return item.status !== 'Terminate' && item.status !== 'Delete';
}

export function applyTerminateAllToProductList(
  items: ProductItem[],
  terminateAllDate: string
): ProductItem[] {
  return items.map(item => {
    if (!canApplyTerminateAllToProduct(item)) {
      return item;
    }
    return {
      ...item,
      status: 'Terminate',
      terminateDate: terminateAllDate
    };
  });
}

export function calculateContractDurationInMonths(
  startDate: DateObject,
  endDate: DateObject,
  prorataBasis: number,
  isInvalidDateRange: boolean
): number {
  if (isInvalidDateRange) return 0;
  return roundToTwoDecimals(calculateDays360Between(startDate, endDate) / prorataBasis);
}

export function validateDatesAndCalculateDuration(state: InvoiceCalculatorState) {
  const warnings: string[] = [];
  const startDate = parseDateString(state.startDate || '2000-01-01');
  const endDate = parseDateString(state.endDate || '2000-01-01');
  const monthsPerInvoice = MONTHS_PER_INVOICE_MAP[state.billingFrequency] || 1;
  const prorataBasis = PRORATA_BASIS_MAP[state.billingFrequency] || 30;
  const cycleDay = state.billingFrequency === 'Monthly' ? Number(state.cycleDay) || 0 : 0;

  const isInvalidDateRange = convertDateToSerialDays(startDate) > convertDateToSerialDays(endDate);

  if (isInvalidDateRange) {
    warnings.push('Start is after end');
  }

  if (state.billingFrequency === 'Monthly' && !cycleDay && startDate.day > 28) {
    warnings.push('Start on the 29th-31st without a cycle day: enter a cycle day 1-28');
  }

  const recurringDurationMonths = calculateContractDurationInMonths(
    startDate,
    endDate,
    prorataBasis,
    isInvalidDateRange
  );

  return {
    startDate,
    endDate,
    monthsPerInvoice,
    prorataBasis,
    cycleDay,
    isInvalidDateRange,
    recurringDurationMonths,
    warnings
  };
}

export function calculateNextCutoffDate(
  contractStartDate: DateObject,
  currentPeriodStartDate: DateObject,
  monthsPerInvoice: number,
  invoiceSequenceNumber: number,
  cycleDay: number
): DateObject {
  if (!cycleDay) {
    return addMonthsToDate(contractStartDate, monthsPerInvoice * invoiceSequenceNumber);
  }
  if (currentPeriodStartDate.day === cycleDay) {
    return addMonthsToDate(currentPeriodStartDate, monthsPerInvoice);
  }
  if (currentPeriodStartDate.day < cycleDay) {
    return createNormalizedDate(currentPeriodStartDate.year, currentPeriodStartDate.month, cycleDay);
  }
  return createNormalizedDate(currentPeriodStartDate.year, currentPeriodStartDate.month + 1, cycleDay);
}

export function generateBillingPeriods(
  startDate: DateObject,
  endDate: DateObject,
  monthsPerInvoice: number,
  cycleDay: number,
  isInvalidDateRange: boolean,
  prorataBasis = 30
): { billingPeriods: InvoicePeriod[]; periodWarning?: string } {
  const billingPeriods: InvoicePeriod[] = [];
  const maxInvoicesAllowed = 25;

  for (let sequence = 1; sequence <= maxInvoicesAllowed && !isInvalidDateRange; sequence++) {
    let periodStartDate = startDate;

    if (sequence > 1) {
      const previousEndSerial = convertDateToSerialDays(billingPeriods[sequence - 2].endDate);
      if (previousEndSerial >= convertDateToSerialDays(endDate)) break;
      periodStartDate = convertSerialDaysToDate(previousEndSerial + 1);
    }

    const nextCutoffDate = calculateNextCutoffDate(
      startDate,
      periodStartDate,
      monthsPerInvoice,
      sequence,
      cycleDay
    );

    const periodEndSerial = Math.min(
      convertDateToSerialDays(endDate),
      convertDateToSerialDays(nextCutoffDate) - 1
    );
    const periodEndDate = convertSerialDaysToDate(periodEndSerial);
    const periodDays = calculateDays360Between(periodStartDate, periodEndDate);
    const proRataFactor = calculateProRataFactor(periodDays, prorataBasis);
    const isLastPeriod = convertDateToSerialDays(periodEndDate) === convertDateToSerialDays(endDate);

    billingPeriods.push({
      startDate: periodStartDate,
      endDate: periodEndDate,
      days: periodDays,
      proRataFactor,
      isLastPeriod
    });
  }

  let periodWarning: string | undefined;
  if (
    billingPeriods.length &&
    convertDateToSerialDays(billingPeriods[billingPeriods.length - 1].endDate) < convertDateToSerialDays(endDate)
  ) {
    periodWarning = 'More than 25 invoices needed (max 25)';
  }

  return { billingPeriods, periodWarning };
}

export function resolveProductEffectiveEndDate(
  item: ProductItem,
  contractEndDate: DateObject
): DateObject | undefined {
  if (item.status === 'Production' || item.status === 'Suspend') {
    return contractEndDate;
  }
  if (item.status === 'Terminate') {
    if (!item.terminateDate) return undefined;
    const parsedTerminateDate = parseDateString(item.terminateDate);
    const effectiveSerial = Math.min(
      convertDateToSerialDays(contractEndDate),
      convertDateToSerialDays(parsedTerminateDate)
    );
    return convertSerialDaysToDate(effectiveSerial);
  }
  return undefined;
}

export function calculateDailyRateContractDurationDays(item: ProductItem): number {
  if (item.type !== 'DR (Daily)' || !item.dailyRateStartDate || !item.dailyRateEndDate) {
    return 0;
  }
  const drStart = parseDateString(item.dailyRateStartDate);
  const drEnd = parseDateString(item.dailyRateEndDate);
  return Math.max(0, calculateDays360Between(drStart, drEnd));
}

export function calculateDailyRateActiveInvoiceDays(item: CalculatedProductItem): number {
  if (item.type !== 'DR (Daily)' || !item.dailyRateStartDate || !item.dailyRateEndDate) {
    return 0;
  }
  const drStart = parseDateString(item.dailyRateStartDate);
  const drEnd = parseDateString(item.dailyRateEndDate);

  if (item.status === 'Terminate') {
    if (!item.terminateDate) return 0;
    const terminateDateObj = parseDateString(item.terminateDate);
    if (convertDateToSerialDays(terminateDateObj) < convertDateToSerialDays(drStart)) {
      return 0;
    }
    const effectiveDrEnd =
      convertDateToSerialDays(terminateDateObj) < convertDateToSerialDays(drEnd)
        ? terminateDateObj
        : drEnd;
    return Math.max(0, calculateDays360Between(drStart, effectiveDrEnd));
  }

  return Math.max(0, calculateDays360Between(drStart, drEnd));
}

export function calculateProductContractDuration(
  item: ProductItem,
  recurringDurationMonths: number
): number {
  if (isProductStatusDeleted(item.status)) {
    return 0;
  }
  if (item.type === 'Recurring') {
    return recurringDurationMonths;
  }
  if (item.type === 'One time') {
    return 1;
  }
  return calculateDailyRateContractDurationDays(item);
}

export function calculateBasicDiscountPerUnit(
  pricePerUnit: number,
  discountType: DiscountType,
  discountValue: number,
  unit: UnitType
): number {
  if (discountType === 'Percentage') {
    return roundByUnitType((pricePerUnit * discountValue) / 100, unit);
  }
  return roundByUnitType(discountValue, unit);
}

export function calculateNetPricePerUnit(
  pricePerUnit: number,
  basicDiscountPerUnit: number
): number {
  return roundToInteger(pricePerUnit - basicDiscountPerUnit);
}

export function calculateTotalBasicDiscount(
  basicDiscountPerUnit: number,
  quantity: number,
  duration: number,
  unit: UnitType
): number {
  return roundByUnitType(basicDiscountPerUnit * quantity * duration, unit);
}

export function calculateTotalAfterBasicDiscount(
  pricePerUnit: number,
  basicDiscountPerUnit: number,
  quantity: number,
  duration: number
): number {
  const netPricePerUnit = calculateNetPricePerUnit(pricePerUnit, basicDiscountPerUnit);
  return roundToInteger(netPricePerUnit * quantity * duration);
}

export function calculateAdditionalDiscountAmount(
  totalAfterBasicDiscount: number,
  discountType: DiscountType,
  discountValue: number
): number {
  if (discountType === 'Percentage') {
    return roundToInteger((totalAfterBasicDiscount * discountValue) / 100);
  }
  return roundToInteger(discountValue);
}

export function calculateItemGrandTotal(
  totalAfterBasicDiscount: number,
  additionalDiscountAmount: number
): number {
  return roundToInteger(totalAfterBasicDiscount - additionalDiscountAmount);
}

export function calculateBasicDiscountRatio(
  pricePerUnit: number,
  discountType: DiscountType,
  discountValue: number
): number {
  if (discountType === 'Percentage') return discountValue / 100;
  return pricePerUnit ? discountValue / pricePerUnit : 0;
}

export function calculateSingleProductMetrics(
  rawItem: ProductItem,
  itemIndex: number,
  contractEndDate: DateObject,
  recurringDurationMonths: number
): CalculatedProductItem {
  const status: ProductStatus = rawItem.status || 'Production';
  const hasPrice = rawItem.price !== '';
  const isUsed = hasPrice && !isProductStatusDeleted(status);
  const isBillable = isUsed && isProductStatusBillable(status);
  const unit: UnitType = rawItem.unit || 'Unit';
  const basicDiscountType = rawItem.basicDiscountType || 'Percentage';
  const additionalDiscountType = rawItem.additionalDiscountType || 'Amount';
  const basicDiscountValue = Number(rawItem.basicDiscountValue) || 0;
  const additionalDiscountValue = Number(rawItem.additionalDiscountValue) || 0;
  const effectiveEndDate = resolveProductEffectiveEndDate(rawItem, contractEndDate);

  const emptyItem: CalculatedProductItem = {
    id: rawItem.id,
    name: rawItem.name,
    status,
    terminateDate: rawItem.terminateDate || '',
    effectiveEndDate,
    type: rawItem.type,
    unit,
    price: 0,
    quantity: 0,
    basicDiscountType,
    basicDiscountValue,
    basicDiscountPerUnit: 0,
    totalBasicDiscount: 0,
    netPricePerUnit: 0,
    duration: 0,
    totalAfterBasicDiscount: 0,
    additionalDiscountType,
    additionalDiscountValue,
    additionalDiscountAmount: 0,
    grandTotal: 0,
    basicDiscountRatio: 0,
    salesOrderExpectedTotal: rawItem.salesOrderExpectedTotal,
    dailyRateStartDate: rawItem.dailyRateStartDate,
    dailyRateEndDate: rawItem.dailyRateEndDate,
    isUsed,
    isBillable,
    originalIndex: itemIndex,
    periodRows: []
  };

  if (!isUsed) return emptyItem;

  const price = roundByUnitType(Number(rawItem.price) || 0, unit);
  const quantity = Number(rawItem.quantity) || 0;
  const duration = calculateProductContractDuration(rawItem, recurringDurationMonths);
  const basicDiscountPerUnit = calculateBasicDiscountPerUnit(price, basicDiscountType, basicDiscountValue, unit);
  const netPricePerUnit = calculateNetPricePerUnit(price, basicDiscountPerUnit);
  const totalBasicDiscount = calculateTotalBasicDiscount(basicDiscountPerUnit, quantity, duration, unit);
  const totalAfterBasicDiscount = calculateTotalAfterBasicDiscount(price, basicDiscountPerUnit, quantity, duration);
  const additionalDiscountAmount = calculateAdditionalDiscountAmount(
    totalAfterBasicDiscount,
    additionalDiscountType,
    additionalDiscountValue
  );
  const grandTotal = calculateItemGrandTotal(totalAfterBasicDiscount, additionalDiscountAmount);
  const basicDiscountRatio = calculateBasicDiscountRatio(price, basicDiscountType, basicDiscountValue);

  return {
    ...emptyItem,
    price,
    quantity,
    basicDiscountPerUnit,
    totalBasicDiscount,
    netPricePerUnit,
    duration,
    totalAfterBasicDiscount,
    additionalDiscountAmount,
    grandTotal,
    basicDiscountRatio
  };
}

export function findTargetInvoiceIndexForDailyRate(
  item: CalculatedProductItem,
  billingPeriods: InvoicePeriod[]
): number {
  if (item.type !== 'DR (Daily)' || !item.dailyRateStartDate || billingPeriods.length === 0) {
    return 0;
  }
  const drStartSerial = convertDateToSerialDays(parseDateString(item.dailyRateStartDate));
  const matchedIndex = billingPeriods.findIndex(
    period =>
      convertDateToSerialDays(period.startDate) <= drStartSerial &&
      drStartSerial <= convertDateToSerialDays(period.endDate)
  );
  if (matchedIndex !== -1) return matchedIndex;
  return drStartSerial < convertDateToSerialDays(billingPeriods[0].startDate)
    ? 0
    : billingPeriods.length - 1;
}

export function createEmptyPeriodRow(): CalculatedProductPeriodRow {
  return {
    unitPrice: '',
    basicDiscountPerUnit: '',
    netPricePerUnit: '',
    totalBasicDiscount: 0,
    totalAfterBasicDiscount: 0,
    additionalDiscountAmount: 0,
    grandTotal: 0,
    activeDays: 0,
    proRataFactor: 0,
    isLastActivePeriod: false
  };
}

export function calculateOneTimeOrDailyRatePeriodRow(
  item: CalculatedProductItem,
  period: InvoicePeriod,
  contractStartDate: DateObject
): CalculatedProductPeriodRow {
  if (item.type === 'One time') {
    if (item.status === 'Terminate') {
      if (!item.terminateDate) return createEmptyPeriodRow();
      const terminateSerial = convertDateToSerialDays(parseDateString(item.terminateDate));
      if (terminateSerial < convertDateToSerialDays(contractStartDate)) {
        return createEmptyPeriodRow();
      }
    }
    return {
      unitPrice: item.price,
      basicDiscountPerUnit: item.basicDiscountPerUnit,
      netPricePerUnit: item.netPricePerUnit,
      totalBasicDiscount: item.totalBasicDiscount,
      totalAfterBasicDiscount: item.totalAfterBasicDiscount,
      additionalDiscountAmount: item.additionalDiscountAmount,
      grandTotal: item.grandTotal,
      activeDays: period.days,
      proRataFactor: 1,
      activeStartDate: period.startDate,
      activeEndDate: period.endDate,
      isLastActivePeriod: true
    };
  }

  const activeDrDays = calculateDailyRateActiveInvoiceDays(item);
  if (activeDrDays <= 0) {
    return createEmptyPeriodRow();
  }

  if (activeDrDays === item.duration) {
    return {
      unitPrice: item.price,
      basicDiscountPerUnit: item.basicDiscountPerUnit,
      netPricePerUnit: item.netPricePerUnit,
      totalBasicDiscount: item.totalBasicDiscount,
      totalAfterBasicDiscount: item.totalAfterBasicDiscount,
      additionalDiscountAmount: item.additionalDiscountAmount,
      grandTotal: item.grandTotal,
      activeDays: activeDrDays,
      proRataFactor: 1,
      activeStartDate: period.startDate,
      activeEndDate: period.endDate,
      isLastActivePeriod: true
    };
  }

  const totalBasicDiscount = calculateTotalBasicDiscount(
    item.basicDiscountPerUnit,
    item.quantity,
    activeDrDays,
    item.unit
  );
  const totalAfterBasicDiscount = calculateTotalAfterBasicDiscount(
    item.price,
    item.basicDiscountPerUnit,
    item.quantity,
    activeDrDays
  );
  const additionalDiscountAmount =
    item.additionalDiscountType === 'Percentage'
      ? calculateAdditionalDiscountAmount(
          totalAfterBasicDiscount,
          item.additionalDiscountType,
          item.additionalDiscountValue
        )
      : item.duration > 0
        ? roundToInteger((item.additionalDiscountAmount * activeDrDays) / item.duration)
        : 0;
  const grandTotal = calculateItemGrandTotal(totalAfterBasicDiscount, additionalDiscountAmount);

  return {
    unitPrice: item.price,
    basicDiscountPerUnit: item.basicDiscountPerUnit,
    netPricePerUnit: item.netPricePerUnit,
    totalBasicDiscount,
    totalAfterBasicDiscount,
    additionalDiscountAmount,
    grandTotal,
    activeDays: activeDrDays,
    proRataFactor: roundToNineDecimals(activeDrDays / (item.duration || 1)),
    activeStartDate: parseDateString(item.dailyRateStartDate),
    activeEndDate: item.terminateDate ? parseDateString(item.terminateDate) : parseDateString(item.dailyRateEndDate),
    isLastActivePeriod: true
  };
}

export function calculateRecurringPeriodRow(
  item: CalculatedProductItem,
  periodStartDate: DateObject,
  activeEndDate: DateObject,
  activeDays: number,
  periodProRataFactor: number,
  shouldProrateUnitPrice: boolean,
  shouldAbsorbFullContractRemainder: boolean,
  isLastActivePeriod: boolean,
  cumulativeBasicDiscount: number,
  cumulativeTotalAfterBasic: number,
  cumulativeAdditionalDiscount: number,
  cumulativeGrandTotal: number
): CalculatedProductPeriodRow {
  if (!item.duration || activeDays <= 0) return createEmptyPeriodRow();

  const unitPrice = shouldProrateUnitPrice
    ? roundByUnitType(item.price * periodProRataFactor, item.unit)
    : item.price;

  const basicDiscountPerUnit = shouldProrateUnitPrice
    ? item.basicDiscountType === 'Percentage'
      ? roundByUnitType((unitPrice * item.basicDiscountValue) / 100, item.unit)
      : roundByUnitType(item.basicDiscountPerUnit * periodProRataFactor, item.unit)
    : item.basicDiscountPerUnit;

  const netPricePerUnit = shouldProrateUnitPrice
    ? roundToInteger(unitPrice - basicDiscountPerUnit)
    : item.netPricePerUnit;

  if (shouldAbsorbFullContractRemainder) {
    const remainingTotalBasicDiscount = roundByUnitType(
      item.totalBasicDiscount - cumulativeBasicDiscount,
      item.unit
    );
    const remainingTotalAfterBasic = item.totalAfterBasicDiscount - cumulativeTotalAfterBasic;

    let remainderUnitPrice = unitPrice;
    let remainderBasicDiscountPerUnit = basicDiscountPerUnit;
    let remainderNetPricePerUnit = netPricePerUnit;
    let remainderTotalBasicDiscount = remainingTotalBasicDiscount;

    if (shouldProrateUnitPrice && item.quantity > 0) {
      const rawNetPricePerUnit = remainingTotalAfterBasic / item.quantity;
      remainderNetPricePerUnit = roundToInteger(rawNetPricePerUnit);

      if (item.basicDiscountType === 'Percentage' && item.basicDiscountValue < 100) {
        remainderUnitPrice = roundByUnitType(
          rawNetPricePerUnit / (1 - item.basicDiscountValue / 100),
          item.unit
        );
        remainderBasicDiscountPerUnit = roundByUnitType(
          remainderUnitPrice - remainderNetPricePerUnit,
          item.unit
        );
      } else {
        const rawBasicDiscountPerUnit = remainingTotalBasicDiscount / item.quantity;
        remainderBasicDiscountPerUnit = roundByUnitType(rawBasicDiscountPerUnit, item.unit);
        remainderUnitPrice = roundByUnitType(
          rawNetPricePerUnit + rawBasicDiscountPerUnit,
          item.unit
        );
      }

      remainderTotalBasicDiscount = roundByUnitType(
        remainderBasicDiscountPerUnit * item.quantity,
        item.unit
      );
    }

    return {
      unitPrice: remainderUnitPrice,
      basicDiscountPerUnit: remainderBasicDiscountPerUnit,
      netPricePerUnit: remainderNetPricePerUnit,
      totalBasicDiscount: remainderTotalBasicDiscount,
      totalAfterBasicDiscount: remainingTotalAfterBasic,
      additionalDiscountAmount: item.additionalDiscountAmount - cumulativeAdditionalDiscount,
      grandTotal: item.grandTotal - cumulativeGrandTotal,
      activeDays,
      proRataFactor: periodProRataFactor,
      isUnitPriceProrated: shouldProrateUnitPrice,
      isFullContractRemainderAbsorbed: true,
      activeStartDate: periodStartDate,
      activeEndDate,
      isLastActivePeriod
    };
  }

  const totalBasicDiscount = shouldProrateUnitPrice
    ? roundByUnitType(basicDiscountPerUnit * item.quantity, item.unit)
    : roundByUnitType(basicDiscountPerUnit * item.quantity * periodProRataFactor, item.unit);

  const totalAfterBasicDiscount = shouldProrateUnitPrice
    ? roundToInteger(netPricePerUnit * item.quantity)
    : roundToInteger(netPricePerUnit * item.quantity * periodProRataFactor);

  const additionalDiscountAmount = roundToInteger(
    (item.additionalDiscountAmount * periodProRataFactor) / item.duration
  );
  const grandTotal = roundToInteger(totalAfterBasicDiscount - additionalDiscountAmount);

  return {
    unitPrice,
    basicDiscountPerUnit,
    netPricePerUnit,
    totalBasicDiscount,
    totalAfterBasicDiscount,
    additionalDiscountAmount,
    grandTotal,
    activeDays,
    proRataFactor: periodProRataFactor,
    isUnitPriceProrated: shouldProrateUnitPrice,
    activeStartDate: periodStartDate,
    activeEndDate,
    isLastActivePeriod
  };
}

export function allocateProductToBillingPeriods(
  item: CalculatedProductItem,
  billingPeriods: InvoicePeriod[],
  contractStartDate: DateObject,
  contractEndDate: DateObject,
  billingFrequency = 'Monthly',
  prorataBasis = 30
): void {
  item.periodRows = [];

  if (!item.isBillable || item.duration <= 0) {
    billingPeriods.forEach(() => {
      item.periodRows.push(createEmptyPeriodRow());
    });
    return;
  }

  let cumulativeTotalAfterBasic = 0;
  let cumulativeAdditionalDiscount = 0;
  let cumulativeBasicDiscount = 0;
  let cumulativeGrandTotal = 0;

  const dailyRateTargetIndex = findTargetInvoiceIndexForDailyRate(item, billingPeriods);
  const effectiveEndSerial = item.effectiveEndDate
    ? convertDateToSerialDays(item.effectiveEndDate)
    : -1;
  const contractEndSerial = convertDateToSerialDays(contractEndDate);
  const reachesFullContractEnd = effectiveEndSerial >= contractEndSerial;
  const isMonthlyFrequency = billingFrequency === 'Monthly';

  billingPeriods.forEach((period, periodIndex) => {
    if (item.type === 'Recurring') {
      const periodStartSerial = convertDateToSerialDays(period.startDate);
      const periodEndSerial = convertDateToSerialDays(period.endDate);

      if (effectiveEndSerial < periodStartSerial) {
        item.periodRows.push(createEmptyPeriodRow());
        return;
      }

      const activeEndSerial = Math.min(periodEndSerial, effectiveEndSerial);
      const activeEndDate = convertSerialDaysToDate(activeEndSerial);
      const isLastActivePeriod = activeEndSerial === effectiveEndSerial;
      const shouldAbsorbFullContractRemainder = period.isLastPeriod && reachesFullContractEnd;
      const isFullPeriod = activeEndSerial === periodEndSerial;
      const isTerminatedMidPeriod = item.status === 'Terminate' && !isFullPeriod;
      const shouldProrateUnitPrice = isMonthlyFrequency || isTerminatedMidPeriod;
      const activeDays = isFullPeriod
        ? period.days
        : calculateDays360Between(period.startDate, activeEndDate);
      const periodProRataFactor = isFullPeriod
        ? period.proRataFactor
        : calculateProRataFactor(activeDays, prorataBasis);

      const recurringRow = calculateRecurringPeriodRow(
        item,
        period.startDate,
        activeEndDate,
        activeDays,
        periodProRataFactor,
        shouldProrateUnitPrice,
        shouldAbsorbFullContractRemainder,
        isLastActivePeriod,
        cumulativeBasicDiscount,
        cumulativeTotalAfterBasic,
        cumulativeAdditionalDiscount,
        cumulativeGrandTotal
      );

      cumulativeTotalAfterBasic += recurringRow.totalAfterBasicDiscount;
      cumulativeAdditionalDiscount += recurringRow.additionalDiscountAmount;
      cumulativeBasicDiscount = roundByUnitType(
        cumulativeBasicDiscount + recurringRow.totalBasicDiscount,
        item.unit
      );
      cumulativeGrandTotal += recurringRow.grandTotal;
      item.periodRows.push(recurringRow);
      return;
    }

    const shouldBillInThisPeriod =
      (item.type === 'One time' && periodIndex === 0) ||
      (item.type === 'DR (Daily)' && periodIndex === dailyRateTargetIndex);

    if (shouldBillInThisPeriod) {
      item.periodRows.push(calculateOneTimeOrDailyRatePeriodRow(item, period, contractStartDate));
    } else {
      item.periodRows.push(createEmptyPeriodRow());
    }
  });
}

export function sumProductTotalsByType(
  activeItems: CalculatedProductItem[],
  productType: ProductType,
  valueSelector: (item: CalculatedProductItem) => number
): number {
  return roundToTwoDecimals(
    activeItems
      .filter(item => item.type === productType)
      .reduce((sum, item) => sum + valueSelector(item), 0)
  );
}

export function hasAnyGigabyteProduct(activeItems: CalculatedProductItem[]): boolean {
  return activeItems.some(item => isGigabyteUnit(item.unit));
}

export function roundSummaryAmount(value: number, hasGigabyteProduct: boolean): number {
  return hasGigabyteProduct ? roundToTwoDecimals(value) : roundToInteger(value);
}

export function sumAllProductsAmount(
  activeItems: CalculatedProductItem[],
  hasGigabyteProduct: boolean,
  valueSelector: (item: CalculatedProductItem) => number
): number {
  return roundSummaryAmount(
    activeItems.reduce((sum, item) => sum + valueSelector(item), 0),
    hasGigabyteProduct
  );
}

export function buildFinancialSummaryObject(
  oneTimeTotal: number,
  recurringTotal: number,
  dailyRateTotal: number,
  totalBasicDiscount: number,
  totalAdditionalDiscount: number,
  taxRateDecimal: number,
  deductedTaxRateDecimal: number,
  hasGigabyteProduct: boolean,
  label?: string,
  period?: InvoicePeriod
): InvoiceFinancialSummary {
  const preTaxTotal = roundSummaryAmount(oneTimeTotal + recurringTotal + dailyRateTotal, hasGigabyteProduct);
  const taxAmount = roundToInteger(preTaxTotal * taxRateDecimal);
  const deductedTaxAmount = roundToInteger(preTaxTotal * deductedTaxRateDecimal);
  const grandTotal = roundToInteger(preTaxTotal + taxAmount - deductedTaxAmount);

  const preTaxRaw = oneTimeTotal + recurringTotal + dailyRateTotal;
  const taxRaw = preTaxTotal * taxRateDecimal;
  const deductedTaxRaw = preTaxTotal * deductedTaxRateDecimal;
  const grandTotalRaw = preTaxRaw + taxRaw - deductedTaxRaw;

  return {
    oneTimeTotal,
    recurringTotal,
    dailyRateTotal,
    totalBasicDiscount,
    totalAdditionalDiscount,
    preTaxTotal,
    taxAmount,
    deductedTaxAmount,
    grandTotal,
    preTaxRaw,
    taxRaw,
    deductedTaxRaw,
    grandTotalRaw,
    label,
    period
  };
}

export function calculateInvoiceFinancialSummaries(
  activeItems: CalculatedProductItem[],
  billingPeriods: InvoicePeriod[],
  taxRatePercent: string,
  deductedTaxRatePercent: string
): { salesOrderSummary: InvoiceFinancialSummary; invoiceColumns: InvoiceFinancialSummary[] } {
  const taxRateDecimal = (Number(taxRatePercent) || 0) / 100;
  const deductedTaxRateDecimal = (Number(deductedTaxRatePercent) || 0) / 100;
  const hasGigabyteProduct = hasAnyGigabyteProduct(activeItems);

  const salesOrderSummary = buildFinancialSummaryObject(
    sumProductTotalsByType(activeItems, 'One time', item => item.grandTotal),
    sumProductTotalsByType(activeItems, 'Recurring', item => item.grandTotal),
    sumProductTotalsByType(activeItems, 'DR (Daily)', item => item.grandTotal),
    sumAllProductsAmount(activeItems, hasGigabyteProduct, item => item.totalBasicDiscount),
    sumAllProductsAmount(activeItems, hasGigabyteProduct, item => item.additionalDiscountAmount),
    taxRateDecimal,
    deductedTaxRateDecimal,
    hasGigabyteProduct
  );

  const invoiceColumns: InvoiceFinancialSummary[] = billingPeriods.map((period, periodIndex) =>
    buildFinancialSummaryObject(
      sumProductTotalsByType(activeItems, 'One time', item => item.periodRows[periodIndex].grandTotal),
      sumProductTotalsByType(activeItems, 'Recurring', item => item.periodRows[periodIndex].grandTotal),
      sumProductTotalsByType(activeItems, 'DR (Daily)', item => item.periodRows[periodIndex].grandTotal),
      sumAllProductsAmount(
        activeItems,
        hasGigabyteProduct,
        item => Number(item.periodRows[periodIndex].totalBasicDiscount) || 0
      ),
      sumAllProductsAmount(
        activeItems,
        hasGigabyteProduct,
        item => Number(item.periodRows[periodIndex].additionalDiscountAmount) || 0
      ),
      taxRateDecimal,
      deductedTaxRateDecimal,
      hasGigabyteProduct,
      `INV ${periodIndex + 1}`,
      period
    )
  );

  return { salesOrderSummary, invoiceColumns };
}

export function applyExchangeRateToTableRow(
  row: TableDisplayRow,
  exchangeRateMultiplier: number
): TableDisplayRow {
  if (row.isCurrency) {
    row.values = row.values.map((value, columnIndex) =>
      columnIndex > 0 && typeof value === 'number'
        ? roundToNineDecimals(value * exchangeRateMultiplier)
        : value
    );
  }
  return row;
}

export function extractNumericProperty(
  record: Record<string, unknown>,
  propertyName: string
): number {
  return typeof record[propertyName] === 'number' ? (record[propertyName] as number) : 0;
}

export function createFinancialSummaryRow(
  calculation: CalculationResult,
  label: string,
  metricKey: string,
  targetCurrencySuffix: string,
  exchangeRateMultiplier: number,
  customClass = '',
  rawMetricKey?: string
): TableDisplayRow {
  const totalAcrossInvoices = roundToNineDecimals(
    calculation.invoiceColumns.reduce(
      (sum, column) => sum + extractNumericProperty(column, metricKey),
      0
    )
  );
  const salesOrderValue = extractNumericProperty(calculation.salesOrderSummary, metricKey);
  const differenceValue = roundToNineDecimals(totalAcrossInvoices - salesOrderValue);

  const displayRow = applyExchangeRateToTableRow(
    {
      id: metricKey,
      customClass,
      isCurrency: true,
      values: [
        label + targetCurrencySuffix,
        salesOrderValue,
        totalAcrossInvoices,
        differenceValue,
        ...calculation.invoiceColumns.map(column =>
          typeof column[metricKey] === 'number' ? (column[metricKey] as number) : ''
        )
      ]
    },
    exchangeRateMultiplier
  );

  if (rawMetricKey) {
    const rawTotalAcrossInvoices = roundToNineDecimals(
      calculation.invoiceColumns.reduce(
        (sum, column) => sum + extractNumericProperty(column, rawMetricKey),
        0
      )
    );
    const rawSalesOrderValue = extractNumericProperty(calculation.salesOrderSummary, rawMetricKey);
    const rawDisplayRow = applyExchangeRateToTableRow(
      {
        isCurrency: true,
        values: [
          'Before rounding (2 decimals)',
          rawSalesOrderValue,
          rawTotalAcrossInvoices,
          roundToNineDecimals(rawTotalAcrossInvoices - rawSalesOrderValue),
          ...calculation.invoiceColumns.map(column => extractNumericProperty(column, rawMetricKey))
        ]
      },
      exchangeRateMultiplier
    );
    displayRow.rawValues = rawDisplayRow.values;
  }

  return displayRow;
}

export function createPeriodScheduleRow(
  calculation: CalculationResult,
  label: string,
  valueExtractor: (period: InvoicePeriod) => string | number
): TableDisplayRow {
  return {
    values: [
      label,
      '',
      '',
      '',
      ...calculation.invoiceColumns.map(column =>
        column.period ? valueExtractor(column.period) : ''
      )
    ]
  };
}

export function buildInvoiceSummaryTableRows(
  calculation: CalculationResult,
  targetCurrencySuffix: string,
  exchangeRateMultiplier: number
): TableDisplayRow[] {
  return [
    createPeriodScheduleRow(calculation, 'Period start', period => formatDateToDisplay(period.startDate)),
    createPeriodScheduleRow(calculation, 'Period end', period => formatDateToDisplay(period.endDate)),
    createPeriodScheduleRow(calculation, 'Days (30/360)', period => period.days),
    createPeriodScheduleRow(calculation, 'Pro-rata factor (days / 30)', period => period.proRataFactor),
    createFinancialSummaryRow(
      calculation,
      'One time total',
      'oneTimeTotal',
      targetCurrencySuffix,
      exchangeRateMultiplier
    ),
    createFinancialSummaryRow(
      calculation,
      'Recurring total',
      'recurringTotal',
      targetCurrencySuffix,
      exchangeRateMultiplier
    ),
    createFinancialSummaryRow(
      calculation,
      'Total basic discount',
      'totalBasicDiscount',
      targetCurrencySuffix,
      exchangeRateMultiplier,
      'text-gray-500 dark:text-slate-400 text-xs italic'
    ),
    createFinancialSummaryRow(
      calculation,
      'Total additional discount',
      'totalAdditionalDiscount',
      targetCurrencySuffix,
      exchangeRateMultiplier,
      'text-gray-500 dark:text-slate-400 text-xs italic'
    ),
    createFinancialSummaryRow(
      calculation,
      'DR (Daily) total',
      'dailyRateTotal',
      targetCurrencySuffix,
      exchangeRateMultiplier
    ),
    createFinancialSummaryRow(
      calculation,
      'Pre-tax total',
      'preTaxTotal',
      targetCurrencySuffix,
      exchangeRateMultiplier,
      'font-medium bg-gray-50 dark:bg-slate-800/60 border-t border-b border-gray-100 dark:border-slate-800',
      'preTaxRaw'
    ),
    createFinancialSummaryRow(
      calculation,
      'Taxes and charges',
      'taxAmount',
      targetCurrencySuffix,
      exchangeRateMultiplier,
      '',
      'taxRaw'
    ),
    createFinancialSummaryRow(
      calculation,
      'Deducted taxes',
      'deductedTaxAmount',
      targetCurrencySuffix,
      exchangeRateMultiplier,
      '',
      'deductedTaxRaw'
    ),
    createFinancialSummaryRow(
      calculation,
      'Invoice grand total',
      'grandTotal',
      targetCurrencySuffix,
      exchangeRateMultiplier,
      'font-semibold bg-gray-100 dark:bg-slate-800',
      'grandTotalRaw'
    )
  ];
}

export type ProductPeriodDisplayKey =
  | 'unitPrice'
  | 'basicDiscountPerUnit'
  | 'totalBasicDiscount'
  | 'netPricePerUnit'
  | 'totalAfterBasicDiscount'
  | 'additionalDiscountAmount'
  | 'grandTotal';

export function buildProductBreakdownTableRows(
  item: CalculatedProductItem,
  calculation: CalculationResult,
  targetCurrencySuffix: string,
  exchangeRateMultiplier: number
): TableDisplayRow[] {
  const metricDefinitions: [
    string,
    ProductPeriodDisplayKey,
    keyof CalculatedProductItem
  ][] = [
    ['Price per unit', 'unitPrice', 'price'],
    ['Basic discount / unit', 'basicDiscountPerUnit', 'basicDiscountPerUnit'],
    ['Total basic discount', 'totalBasicDiscount', 'totalBasicDiscount'],
    ['Net price per unit', 'netPricePerUnit', 'netPricePerUnit'],
    ['Total after basic', 'totalAfterBasicDiscount', 'totalAfterBasicDiscount'],
    ['Additional discount', 'additionalDiscountAmount', 'additionalDiscountAmount'],
    ['Item grand total', 'grandTotal', 'grandTotal']
  ];

  const summableKeys: ProductPeriodDisplayKey[] = [
    'totalBasicDiscount',
    'totalAfterBasicDiscount',
    'additionalDiscountAmount',
    'grandTotal'
  ];

  return metricDefinitions.map(([label, periodMetricKey, salesOrderMetricKey]) => {
    const periodValues = calculation.invoiceColumns.map(
      (_, columnIndex) => item.periodRows[columnIndex][periodMetricKey]
    );
    const isSummable = summableKeys.includes(periodMetricKey);
    const summedAcrossPeriods = isSummable
      ? roundToNineDecimals(
          periodValues.reduce<number>((sum, value) => sum + (Number(value) || 0), 0)
        )
      : '';
    const differenceFromSalesOrder = isSummable
      ? roundToNineDecimals((summedAcrossPeriods as number) - (item[salesOrderMetricKey] as number))
      : '';

    return applyExchangeRateToTableRow(
      {
        isCurrency: true,
        customClass:
          periodMetricKey === 'grandTotal' ? 'bg-gray-50 dark:bg-slate-800/60 font-medium' : '',
        values: [
          label + targetCurrencySuffix,
          item[salesOrderMetricKey] as number,
          summedAcrossPeriods,
          differenceFromSalesOrder,
          ...periodValues
        ]
      },
      exchangeRateMultiplier
    );
  });
}

export function collectProductStatusWarnings(
  items: ProductItem[],
  contractStartDate: DateObject
): string[] {
  const statusWarnings: string[] = [];
  const startSerial = convertDateToSerialDays(contractStartDate);

  items.forEach((item, index) => {
    if (item.price === '' || item.status !== 'Terminate') return;
    const itemLabel = item.name || `Product #${index + 1}`;
    if (!item.terminateDate) {
      statusWarnings.push(`${itemLabel}: status is Terminate but Terminate Date is empty`);
      return;
    }
    const terminateSerial = convertDateToSerialDays(parseDateString(item.terminateDate));
    if (terminateSerial < startSerial) {
      statusWarnings.push(`${itemLabel}: Terminate Date (${item.terminateDate}) is before subscription start`);
    }
  });

  return statusWarnings;
}

export function collectInvoiceReconciliationWarnings(
  calculation: CalculationResult,
  invoiceSummaryRows: TableDisplayRow[]
): string[] {
  const warnings = [...calculation.warnings];
  const preTaxRow = invoiceSummaryRows.find(row =>
    String(row.values[0]).startsWith('Pre-tax total')
  );
  const preTaxDifference = preTaxRow ? roundToNineDecimals(preTaxRow.values[3] as number) : 0;

  if (calculation.invoiceColumns.length && Math.abs(preTaxDifference) >= 0.01) {
    warnings.push('Pre-tax of invoices differs from SO by ' + formatDisplayNumber(preTaxDifference));
  }
  if (calculation.invoiceColumns.some(column => column.grandTotal < 0)) {
    warnings.push('An invoice has a negative amount: check dates and durations');
  }

  return warnings;
}

export function createNewEmptyProductItem(): ProductItem {
  return {
    id: Math.random().toString(36).slice(2, 9),
    name: '',
    status: 'Production',
    terminateDate: '',
    type: 'Recurring',
    unit: 'Unit',
    price: '',
    basicDiscountType: 'Amount',
    basicDiscountValue: '',
    quantity: '1',
    dailyRateStartDate: '',
    dailyRateEndDate: '',
    additionalDiscountType: 'Amount',
    additionalDiscountValue: '',
    salesOrderExpectedTotal: ''
  };
}

export function calculateInvoiceSchedule(state: InvoiceCalculatorState): CalculationResult {
  const {
    startDate,
    endDate,
    monthsPerInvoice,
    prorataBasis,
    cycleDay,
    isInvalidDateRange,
    recurringDurationMonths,
    warnings
  } = validateDatesAndCalculateDuration(state);

  const { billingPeriods, periodWarning } = generateBillingPeriods(
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

  const productStatusWarnings = collectProductStatusWarnings(state.items, startDate);
  warnings.push(...productStatusWarnings);

  const allCalculatedItems: CalculatedProductItem[] = state.items.map((rawItem, itemIndex) =>
    calculateSingleProductMetrics(
      rawItem,
      itemIndex,
      endDate,
      recurringDurationMonths
    )
  );
  const activeCalculatedItems = allCalculatedItems.filter(item => item.isUsed);

  activeCalculatedItems.forEach(item => {
    allocateProductToBillingPeriods(
      item,
      billingPeriods,
      startDate,
      endDate,
      state.billingFrequency,
      prorataBasis
    );
  });

  const { salesOrderSummary, invoiceColumns } = calculateInvoiceFinancialSummaries(
    activeCalculatedItems,
    billingPeriods,
    state.taxRatePercent,
    state.deductedTaxRatePercent
  );

  const totalBasicDiscount = roundToTwoDecimals(
    activeCalculatedItems.reduce((sum, item) => sum + item.totalBasicDiscount, 0)
  );

  return {
    warnings,
    recurringDurationMonths,
    monthsPerInvoice,
    billingPeriods,
    allCalculatedItems,
    activeCalculatedItems,
    salesOrderSummary,
    invoiceColumns,
    totalBasicDiscount
  };
}
