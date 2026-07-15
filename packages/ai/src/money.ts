import type { Cents } from '@fb/types';

/** Format integer cents as a human dollar string. The AI only ever quotes these. */
export function usd(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Parse a dollar number (from a tool call) into integer cents. */
export function dollarsToCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}
