import type { DateObj } from '../types';

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];
export const MN = MONTH_NAMES;

/**
 * Formats a DateObj into DD-MMM-YYYY (e.g. 01-Jan-2026)
 */
export const formatDate = (date: DateObj): string => {
  return String(date.d).padStart(2, '0') + '-' + MONTH_NAMES[date.m - 1] + '-' + date.y;
};
export const fd = formatDate;

/**
 * 30/360 day adjustment rule:
 * In the 30/360 day-count convention, month ends on 28, 29, 31 are adjusted to 30.
 */
export const adjustDay360 = (day: number): number => {
  return [28, 29, 31].includes(day) ? 30 : day;
};
export const adj = adjustDay360;

/**
 * Parses a date string (YYYY-MM-DD or YYYY/MM/DD) into a DateObj { y, m, d }
 */
export const parseDate = (dateStr: string): DateObj => {
  const [year, month, day] = (dateStr || '').replace(/\//g, '-').split('-').map(Number);
  return {
    y: year || 2000,
    m: month || 1,
    d: day || 1
  };
};
export const P = parseDate;

/**
 * Converts a DateObj into a UTC serial day number (days since Unix epoch)
 */
export const dateToSerial = (date: DateObj): number => {
  return Date.UTC(date.y, date.m - 1, date.d) / 864e5;
};
export const ser = dateToSerial;

/**
 * Converts a UTC serial day number back into a DateObj
 */
export const serialToDate = (serialDays: number): DateObj => {
  const dt = new Date(serialDays * 864e5);
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate()
  };
};
export const fromSer = serialToDate;

/**
 * Gets total number of days in a given year and month
 */
export const daysInMonth = (year: number, month: number): number => {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};
export const dim = daysInMonth;

/**
 * Adds N months to a date, clamping the day to the maximum days of the target month
 */
export const addMonths = (date: DateObj, monthsToAdd: number): DateObj => {
  const totalMonths = date.y * 12 + date.m - 1 + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const maxDay = daysInMonth(targetYear, targetMonth);
  return {
    y: targetYear,
    m: targetMonth,
    d: Math.min(date.d, maxDay)
  };
};
export const addM = addMonths;

/**
 * Normalizes a year and month overflow with a specific target day (e.g. for billing cycle cutoffs)
 */
export const makeNormalizedDate = (year: number, month: number, day: number): DateObj => {
  const totalMonths = year * 12 + month - 1;
  return {
    y: Math.floor(totalMonths / 12),
    m: (totalMonths % 12) + 1,
    d: day
  };
};
export const mk = makeNormalizedDate;

/**
 * Calculates the number of days between two dates using the 30/360 day-count convention:
 * Days = (Y2 - Y1) * 360 + (M2 - M1) * 30 + adj(D2) - adj(D1) + 1
 */
export const calculateDays360 = (startDate: DateObj, endDate: DateObj): number => {
  return (
    (endDate.y - startDate.y) * 360 +
    (endDate.m - startDate.m) * 30 +
    adjustDay360(endDate.d) -
    adjustDay360(startDate.d) +
    1
  );
};
export const days = calculateDays360;
