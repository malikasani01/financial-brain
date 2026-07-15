import { describe, expect, it } from 'vitest';
import type { ForecastResult } from '@fb/types';
import { calculateFinancialStage } from './stage.js';
import { calculateRecommendedSafetyBuffer, resolveBufferCents } from './buffer.js';
import { essentialMonthlyCostCents } from './essentials.js';
import { lifeCost, makeInput, ob, goal, TODAY } from './test-fixtures.js';

function fc(low: number, negativeDates: string[] = []): ForecastResult {
  return {
    days: [],
    lowestProjectedCashCents: low,
    lowestCashDate: TODAY,
    negativeDates,
    belowBufferDates: [],
  };
}

describe('essentialMonthlyCostCents', () => {
  it('sums essential obligations + essential life costs, monthly-normalized', () => {
    const input = makeInput({
      obligations: [
        ob({ isEssential: true, amountDueCents: 120000, frequency: 'MONTHLY' }),
        ob({ isEssential: false, amountDueCents: 99999, frequency: 'MONTHLY' }), // ignored
        ob({ isEssential: true, amountDueCents: 6000, frequency: 'ONE_TIME' }), // no monthly eq
      ],
      lifeCosts: [
        lifeCost({ isEssential: true, frequency: 'MONTHLY', normalCents: 30000 }),
        lifeCost({ isEssential: false, frequency: 'MONTHLY', normalCents: 50000 }), // ignored
      ],
    });
    expect(essentialMonthlyCostCents(input)).toBe(150000);
  });

  it('falls back to minimumRequired when amountDue is null', () => {
    const input = makeInput({
      obligations: [
        ob({
          isEssential: true,
          amountDueCents: null,
          minimumRequiredCents: 40000,
          frequency: 'MONTHLY',
        }),
      ],
    });
    expect(essentialMonthlyCostCents(input)).toBe(40000);
  });
});

describe('calculateFinancialStage', () => {
  it('CRITICAL when cash goes negative within 30 days', () => {
    const r = calculateFinancialStage(makeInput(), fc(-100, ['2026-07-25']));
    expect(r.stage).toBe('CRITICAL');
  });

  it('CRITICAL when an essential obligation consequence is already occurring', () => {
    const input = makeInput({
      obligations: [ob({ isEssential: true, consequenceAlreadyOccurring: true })],
    });
    expect(calculateFinancialStage(input, fc(100000)).stage).toBe('CRITICAL');
  });

  it('CRITICAL when an essential obligation is severely overdue', () => {
    const input = makeInput({
      obligations: [ob({ isEssential: true, status: 'SEVERELY_OVERDUE' })],
    });
    expect(calculateFinancialStage(input, fc(100000)).stage).toBe('CRITICAL');
  });

  it('STABILIZING when a non-essential obligation is overdue', () => {
    const input = makeInput({ obligations: [ob({ isEssential: false, status: 'OVERDUE' })] });
    expect(calculateFinancialStage(input, fc(100000)).stage).toBe('STABILIZING');
  });

  it('STABILIZING when reserves stay below one month of essentials', () => {
    const input = makeInput({
      lifeCosts: [lifeCost({ isEssential: true, frequency: 'MONTHLY', normalCents: 75000 })],
    });
    expect(calculateFinancialStage(input, fc(50000)).stage).toBe('STABILIZING');
  });

  it('STABLE when current and reserves cover a month', () => {
    expect(calculateFinancialStage(makeInput(), fc(100000)).stage).toBe('STABLE');
  });

  it('BUILDING_FREEDOM when funding goals with a healthy reserve', () => {
    const input = makeInput({
      liquidCashCents: 100000,
      goals: [goal({ committedPerPaycheckCents: 5000 })],
    });
    expect(calculateFinancialStage(input, fc(100000)).stage).toBe('BUILDING_FREEDOM');
  });

  it('stays STABLE when funding goals but reserve is too thin', () => {
    const input = makeInput({
      liquidCashCents: 100000,
      goals: [goal({ committedPerPaycheckCents: 5000 })],
      lifeCosts: [lifeCost({ isEssential: true, frequency: 'MONTHLY', normalCents: 75000 })],
    });
    // essentialMonthly = 75000; 3x = 225000 > liquid 100000 => not enough reserve.
    expect(calculateFinancialStage(input, fc(80000)).stage).toBe('STABLE');
  });
});

describe('safety buffer', () => {
  const withEssentials = makeInput({
    lifeCosts: [lifeCost({ isEssential: true, frequency: 'MONTHLY', normalCents: 30000 })],
  });

  it('uses stage defaults', () => {
    expect(calculateRecommendedSafetyBuffer('CRITICAL', withEssentials)).toBe(50000);
    expect(calculateRecommendedSafetyBuffer('STABILIZING', withEssentials)).toBe(100000);
    expect(calculateRecommendedSafetyBuffer('STABLE', withEssentials)).toBe(30000);
    expect(calculateRecommendedSafetyBuffer('BUILDING_FREEDOM', withEssentials)).toBe(90000);
  });

  it('resolveBufferCents prefers the override when present', () => {
    expect(resolveBufferCents(makeInput({ bufferOverrideCents: 7777 }), 'CRITICAL')).toBe(7777);
    expect(resolveBufferCents(withEssentials, 'STABLE')).toBe(30000);
  });
});
