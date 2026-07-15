/**
 * Pure calendar-date helpers operating on 'YYYY-MM-DD' strings.
 *
 * All arithmetic is done in UTC internally purely to get correct calendar-day
 * math; no timezone conversion and no Date.now() is involved, so these stay
 * fully deterministic. The user's timezone matters only when *deriving* today's
 * ISODate at the edge of the system, never in here.
 */

import type { ISODate } from '@fb/types';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: string): value is ISODate {
  if (!ISO_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Reject overflow like 2026-02-30 (which JS would roll to March).
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUTC(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(dt: Date): ISODate {
  const y = dt.getUTCFullYear().toString().padStart(4, '0');
  const m = (dt.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = dt.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Add (or subtract, if negative) a number of calendar days. */
export function addDays(date: ISODate, days: number): ISODate {
  const dt = toUTC(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUTC(dt);
}

/** Whole calendar days from `a` to `b`. Positive when `b` is after `a`. */
export function daysBetween(a: ISODate, b: ISODate): number {
  const MS = 86_400_000;
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / MS);
}

/** -1 if a<b, 0 if equal, 1 if a>b. */
export function compareDate(a: ISODate, b: ISODate): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b;
}

/** Inclusive list of dates from `start` to `start + horizonDays - 1`. */
export function dateRange(start: ISODate, horizonDays: number): ISODate[] {
  const out: ISODate[] = [];
  for (let i = 0; i < horizonDays; i++) out.push(addDays(start, i));
  return out;
}
