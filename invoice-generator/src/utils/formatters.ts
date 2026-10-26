/**
 * Formatting and precision utilities
 */

/**
 * Retains up to 2 decimal places (2 angka di belakang koma)
 */
export const keepPrecision = (x: number): number => {
  return Number(x.toFixed(2));
};

// Aliases used across formulas and components
export const keepPrecision2 = keepPrecision;
export const keepPrecision9 = keepPrecision;
export const r2 = keepPrecision;
export const r9 = keepPrecision;
export const f9 = keepPrecision;

/**
 * Formats a value for display:
 * - Empty string or null/undefined -> empty string
 * - Number -> formatted with thousands separators and up to 2 decimal places
 * - Other -> returned as string
 */
export const formatDisplayNumber = (v: unknown): string => {
  if (v === '' || v == null) return '';
  if (typeof v === 'number') {
    return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return String(v);
};

// Alias for display formatting
export const fmt = formatDisplayNumber;
