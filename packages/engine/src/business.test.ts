import { describe, expect, it } from 'vitest';
import type { BusinessScenarioInput } from '@fb/types';
import {
  calculateBusinessScenario,
  calculateFreedom,
  effectiveMonthlyPriceCents,
} from './business.js';

function scenario(over: Partial<BusinessScenarioInput> = {}): BusinessScenarioInput {
  return {
    id: 's',
    label: null,
    weeklyPriceCents: null,
    monthlyPriceCents: null,
    annualPriceCents: null,
    payingUsers: 0,
    variableCostPerUserCents: 0,
    fixedMonthlyCents: 0,
    ...over,
  };
}

describe('calculateFreedom', () => {
  it('freedom gap is desired replacement minus current business income, floored at 0', () => {
    expect(calculateFreedom(700000, 0)).toEqual({
      freedomNumberCents: 700000,
      currentBusinessIncomeCents: 0,
      freedomGapCents: 700000,
    });
    // Business income already exceeds the target => gap is 0, not negative.
    expect(calculateFreedom(700000, 900000).freedomGapCents).toBe(0);
  });
});

describe('effectiveMonthlyPriceCents', () => {
  it('prefers monthly, then weekly (x52/12), then annual (/12)', () => {
    expect(effectiveMonthlyPriceCents(scenario({ monthlyPriceCents: 999 }))).toBe(999);
    expect(effectiveMonthlyPriceCents(scenario({ weeklyPriceCents: 699 }))).toBe(
      Math.round((699 * 52) / 12),
    );
    expect(effectiveMonthlyPriceCents(scenario({ annualPriceCents: 6999 }))).toBe(
      Math.round(6999 / 12),
    );
    expect(effectiveMonthlyPriceCents(scenario())).toBe(0); // nothing set
  });
});

describe('calculateBusinessScenario', () => {
  const FREEDOM = 700000; // $7,000/mo

  it('Scenario A: $9.99/mo, 100 users, $1 var, $500 fixed', () => {
    const r = calculateBusinessScenario(
      scenario({
        label: 'A',
        monthlyPriceCents: 999,
        payingUsers: 100,
        variableCostPerUserCents: 100,
        fixedMonthlyCents: 50000,
      }),
      FREEDOM,
    );
    expect(r.monthlyPricePerUserCents).toBe(999);
    expect(r.mrrCents).toBe(99900); // $999
    expect(r.arrCents).toBe(99900 * 12);
    expect(r.grossProfitCents).toBe(99900 - 100 * 100); // MRR - variable
    expect(r.netOperatingProfitCents).toBe(99900 - 10000 - 50000);
    // contribution per user = 999 - 100 = 899; needed = ceil((700000+50000)/899)
    expect(r.customersToFreedom).toBe(Math.ceil((700000 + 50000) / 899));
    expect(r.freedomCoveragePercent).toBe(
      Math.max(0, Math.round((r.netOperatingProfitCents / FREEDOM) * 100)),
    );
  });

  it('Scenario B: $6.99/week normalizes to a monthly price', () => {
    const r = calculateBusinessScenario(
      scenario({
        label: 'B',
        weeklyPriceCents: 699,
        payingUsers: 50,
        variableCostPerUserCents: 50,
        fixedMonthlyCents: 0,
      }),
      FREEDOM,
    );
    expect(r.monthlyPricePerUserCents).toBe(Math.round((699 * 52) / 12));
    expect(r.mrrCents).toBe(r.monthlyPricePerUserCents * 50);
  });

  it('unit economics that cannot reach freedom => customersToFreedom is null', () => {
    // price <= variable cost: every user loses money, no user count reaches freedom.
    const r = calculateBusinessScenario(
      scenario({
        monthlyPriceCents: 500,
        payingUsers: 10,
        variableCostPerUserCents: 500,
        fixedMonthlyCents: 0,
      }),
      FREEDOM,
    );
    expect(r.customersToFreedom).toBeNull();
  });

  it('negative net profit clamps coverage to 0', () => {
    const r = calculateBusinessScenario(
      scenario({
        monthlyPriceCents: 999,
        payingUsers: 1,
        variableCostPerUserCents: 100,
        fixedMonthlyCents: 100000,
      }),
      FREEDOM,
    );
    expect(r.netOperatingProfitCents).toBeLessThan(0);
    expect(r.freedomCoveragePercent).toBe(0);
  });

  it('a zero Freedom Number yields 0% coverage without dividing by zero', () => {
    const r = calculateBusinessScenario(
      scenario({ monthlyPriceCents: 999, payingUsers: 100, variableCostPerUserCents: 100 }),
      0,
    );
    expect(r.freedomCoveragePercent).toBe(0);
    expect(r.customersToFreedom).toBe(Math.ceil(0 / (999 - 100)));
  });
});
