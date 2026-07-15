/**
 * Deterministic recurrence expansion. Given an anchor date and a frequency,
 * produce every occurrence date that falls within the forecast window.
 *
 * Only life costs are expanded here (income and obligations arrive already
 * expanded in EngineInput.events). Occurrences are always generated forward
 * from the anchor; if the anchor is before the window, we fast-forward.
 */

import type { Frequency, ISODate } from '@fb/types';
import { addDays, addMonths, compareDate } from './dateutil.js';

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

/** Twice per month: the anchor's day and ~15 days later, month over month. */
function stepSemimonthly(anchor: ISODate, start: ISODate, end: ISODate): ISODate[] {
  const dates = new Set<ISODate>();
  let k = 0;
  // Walk months from the anchor; for each, add day and day+15 (clamped by addDays).
  while (true) {
    const monthStart = addMonths(anchor, k);
    if (compareDate(monthStart, end) > 0) break;
    dates.add(monthStart);
    dates.add(addDays(monthStart, 15));
    k += 1;
  }
  return [...dates].filter((d) => compareDate(d, start) >= 0 && compareDate(d, end) <= 0).sort();
}
