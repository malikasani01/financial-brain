import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  compareDate,
  dateRange,
  daysBetween,
  daysInMonth,
  isISODate,
  maxDate,
  minDate,
} from './dateutil.js';

describe('isISODate', () => {
  it('accepts valid dates', () => {
    expect(isISODate('2026-07-15')).toBe(true);
    expect(isISODate('2024-02-29')).toBe(true); // leap year
  });
  it('rejects malformed or overflowing dates', () => {
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-2-3')).toBe(false);
    expect(isISODate('07/15/2026')).toBe(false);
    expect(isISODate('2025-02-29')).toBe(false); // not a leap year
  });
});

describe('addDays', () => {
  it('adds and subtracts across month and year boundaries', () => {
    expect(addDays('2026-07-15', 14)).toBe('2026-07-29');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29'); // leap
  });
  it('is timezone-independent (pure calendar math)', () => {
    // Adding 90 days must never drift regardless of host timezone / DST.
    expect(addDays('2026-03-01', 90)).toBe('2026-05-30');
  });
});

describe('daysBetween', () => {
  it('counts whole calendar days, signed', () => {
    expect(daysBetween('2026-07-15', '2026-07-29')).toBe(14);
    expect(daysBetween('2026-07-29', '2026-07-15')).toBe(-14);
    expect(daysBetween('2026-07-15', '2026-07-15')).toBe(0);
  });
  it('is unaffected by DST transitions', () => {
    // US DST spring-forward is in March; 90 days must still be 90.
    expect(daysBetween('2026-03-01', '2026-05-30')).toBe(90);
  });
});

describe('compareDate / minDate / maxDate', () => {
  it('orders correctly', () => {
    expect(compareDate('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareDate('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareDate('2026-01-01', '2026-01-01')).toBe(0);
    expect(minDate('2026-01-02', '2026-01-01')).toBe('2026-01-01');
    expect(minDate('2026-01-01', '2026-01-02')).toBe('2026-01-01');
    expect(maxDate('2026-01-02', '2026-01-01')).toBe('2026-01-02');
    expect(maxDate('2026-01-01', '2026-01-02')).toBe('2026-01-02');
  });
});

describe('daysInMonth', () => {
  it('knows month lengths incl. leap February', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe('addMonths', () => {
  it('preserves day-of-month, clamping to shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28'); // clamp
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31'); // restored
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29'); // leap clamp
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15'); // year rollover
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28'); // negative
  });
});

describe('dateRange', () => {
  it('produces an inclusive contiguous range', () => {
    const r = dateRange('2026-07-15', 3);
    expect(r).toEqual(['2026-07-15', '2026-07-16', '2026-07-17']);
  });
});
