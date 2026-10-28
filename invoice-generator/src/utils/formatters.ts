/**
 * Formatting and precision utilities
 */

/**
 * Retains up to 2 decimal places (2 angka di belakang koma)
 */
export const keepPrecision = (x: number): number => {
  return Number(x.toFixed(2));
};

export const keepPrecision2 = keepPrecision;
export const r2 = keepPrecision;

/**
 * Retains up to 9 decimal places (9 angka di belakang koma)
 */
export const keepPrecision9 = (x: number): number => {
  return Number(x.toFixed(9));
};

export const r9 = keepPrecision9;
export const f9 = keepPrecision9;

/**
 * Formats a value for display:
 * - Empty string or null/undefined -> empty string
 * - Number -> formatted with thousands separators and up to maxDigits decimal places (default 2)
 * - Other -> returned as string
 */
export const formatDisplayNumber = (v: unknown, maxDigits = 2): string => {
  if (v === '' || v == null) return '';
  if (typeof v === 'number') {
    return v.toLocaleString('en-US', { maximumFractionDigits: maxDigits });
  }
  return String(v);
};

// Alias for display formatting
export const fmt = formatDisplayNumber;
export const fmt9 = (v: unknown): string => formatDisplayNumber(v, 9);

/**
 * Formats a number with exactly 2 decimal places (selalu 2 angka di belakang koma)
 */
export const fmt2 = (v: unknown): string => {
  if (typeof v !== 'number') return v === '' || v == null ? '' : String(v);
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

