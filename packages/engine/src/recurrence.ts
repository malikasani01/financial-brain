/**
 * Deterministic recurrence expansion. Given an anchor date and a frequency,
 * produce every occurrence date that falls within the forecast window.
 *
 * Only life costs are expanded here (income and obligations arrive already
 * expanded in EngineInput.events). Occurrences are always generated forward
 * from the anchor; if the anchor is before the window, we fast-forward.
 */

import type { Frequency, ISODate } from '@fb/types';
import { addDays, addMonths, compareDate, daysInMonth } from './dateutil.js';

/** Inclusive window [start, start + horizonDays - 1]. */
export function expandOccurrences(
  anchor: ISODate,
  frequency: Frequency,
  start: ISODate,
  horizonDays: number,
): ISODate[] {
  const end = addDays(start, horizonDays - 1);
  const within = (d: ISODate) => compareDate(d, start) >= 0 && compareDate(d, end) <= 0;
  const out: ISODate[] = [];

  switch (frequency) {
    case 'ONE_TIME':
    // A one-off, or a custom schedule we can't model yet: single occurrence.
    case 'CUSTOM': {
      if (within(anchor)) out.push(anchor);
      return out;
    }

    case 'WEEKLY':
      return stepByDays(anchor, 7, start, end);
    case 'BIWEEKLY':
      return stepByDays(anchor, 14, start, end);

    case 'MONTHLY':
      return stepByMonths(anchor, 1, start, end);
    case 'QUARTERLY':
      return stepByMonths(anchor, 3, start, end);
    case 'ANNUAL':
      return stepByMonths(anchor, 12, start, end);

    case 'SEMIMONTHLY':
      return stepSemimonthly(anchor, start, end);
  }
}

function stepByDays(anchor: ISODate, step: number, start: ISODate, end: ISODate): ISODate[] {
  // Fast-forward to the first occurrence >= start.
  let d = anchor;
  while (compareDate(d, start) < 0) d = addDays(d, step);
  const out: ISODate[] = [];
  while (compareDate(d, end) <= 0) {
    out.push(d);
    d = addDays(d, step);
  }
  return out;
}

function stepByMonths(anchor: ISODate, step: number, start: ISODate, end: ISODate): ISODate[] {
  let k = 0;
  let d = anchor;
  while (compareDate(d, start) < 0) {
    k += step;
    d = addMonths(anchor, k);
  }
  const out: ISODate[] = [];
  while (compareDate(d, end) <= 0) {
    out.push(d);
    k += step;
    d = addMonths(anchor, k);
  }
  return out;
}

/**
 * Twice per month on two FIXED days of the month (e.g. the 5th and the 20th),
 * so paydays don't drift and land on the same dates every month. The two days
 * are the anchor's day and its half-month partner (15 apart) — anchor on the
 * 20th → the 5th and 20th; on the 1st → the 1st and 16th. Days past a shorter
 * month's length clamp to that month's last day.
 */
function stepSemimonthly(anchor: ISODate, start: ISODate, end: ISODate): ISODate[] {
  const anchorDay = Number(anchor.slice(8, 10));
  const partner = anchorDay > 15 ? anchorDay - 15 : anchorDay + 15;
  const days = [Math.min(anchorDay, partner), Math.max(anchorDay, partner)];

  const out: ISODate[] = [];
  // Walk each month overlapping the window, emitting both fixed days.
  let cursor: ISODate = `${start.slice(0, 7)}-01`;
  while (compareDate(cursor, end) <= 0) {
    const year = Number(cursor.slice(0, 4));
    const month = Number(cursor.slice(5, 7));
    const lastDay = daysInMonth(year, month);
    for (const day of days) {
      const dd = Math.min(day, lastDay);
      const iso: ISODate = `${cursor.slice(0, 7)}-${String(dd).padStart(2, '0')}`;
      if (compareDate(iso, start) >= 0 && compareDate(iso, end) <= 0) out.push(iso);
    }
    cursor = addMonths(cursor, 1);
  }
  return out.sort();
}
