import { describe, expect, it } from 'vitest';
import {
  GOAL_ALIGNMENT,
  URGENCY_WEIGHTS,
  monthlyEquivalentRaw,
  OCCURRENCES_PER_YEAR,
} from './constants.js';

describe('constants integrity', () => {
  it('urgency weights sum to exactly 1', () => {
    const sum = Object.values(URGENCY_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('every goal-alignment key has a score in 0..100', () => {
    for (const v of Object.values(GOAL_ALIGNMENT)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('monthly-equivalent normalizes frequencies correctly', () => {
    expect(monthlyEquivalentRaw(1200, 'MONTHLY')).toBe(1200);
    expect(monthlyEquivalentRaw(1200, 'ANNUAL')).toBe(100);
    // biweekly: 26 payments / 12 months
    expect(monthlyEquivalentRaw(10000, 'BIWEEKLY')).toBeCloseTo((10000 * 26) / 12, 6);
    // one-time and custom have no periodic monthly equivalent
    expect(monthlyEquivalentRaw(5000, 'ONE_TIME')).toBe(0);
    expect(OCCURRENCES_PER_YEAR.SEMIMONTHLY).toBe(24);
  });
});
