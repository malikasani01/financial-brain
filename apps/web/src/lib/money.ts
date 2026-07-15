/** View-layer money helpers. Storage & engine are always integer cents. */

export function centsToDollars(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Whole-dollar display for big headline numbers (e.g. "$183"). */
export function centsToWholeDollars(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${Math.round(Math.abs(cents) / 100).toLocaleString('en-US')}`;
}

/** Parse a user-entered dollar string ("1,234.56", "$40", "") to integer cents. */
export function dollarsToCents(value: FormDataEntryValue | null): number {
  if (value == null) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return 0;
  return Math.round(parseFloat(cleaned) * 100);
}

/** Nullable variant: empty input stays null (for optional amounts). */
export function dollarsToCentsOrNull(value: FormDataEntryValue | null): number | null {
  if (value == null || String(value).trim() === '') return null;
  return dollarsToCents(value);
}

export function textOrNull(value: FormDataEntryValue | null): string | null {
  const s = value == null ? '' : String(value).trim();
  return s === '' ? null : s;
}
