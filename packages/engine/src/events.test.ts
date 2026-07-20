import { describe, expect, it } from 'vitest';
import { buildLifeCostEvents } from './events.js';
import { lifeCost, makeInput } from './test-fixtures.js';

// A WEEKLY life cost anchored at today emits on 2026-07-15, 07-22, 07-29, ...
const D0 = '2026-07-15';
const D1 = '2026-07-22';

describe('buildLifeCostEvents overrides', () => {
  it('uses the planned amount when there are no overrides', () => {
    const input = makeInput({ lifeCosts: [lifeCost({ planningMode: 'CUSTOM', customCents: 12000 })] });
    const out = buildLifeCostEvents(input, 'STABLE');
    expect(out.every((e) => e.amountCents === -12000)).toBe(true);
    expect(out.length).toBeGreaterThan(1);
  });

  it('replaces the amount on an overridden date only', () => {
    const input = makeInput({
      lifeCosts: [
        lifeCost({ planningMode: 'CUSTOM', customCents: 12000, overrides: [{ date: D1, amountCents: 5000 }] }),
      ],
    });
    const out = buildLifeCostEvents(input, 'STABLE');
    expect(out.find((e) => e.date === D0)?.amountCents).toBe(-12000); // unchanged
    expect(out.find((e) => e.date === D1)?.amountCents).toBe(-5000); // one-off tweak
  });

  it('drops just the overridden occurrence when its amount is zero', () => {
    const input = makeInput({
      lifeCosts: [
        lifeCost({ planningMode: 'CUSTOM', customCents: 12000, overrides: [{ date: D1, amountCents: 0 }] }),
      ],
    });
    const out = buildLifeCostEvents(input, 'STABLE');
    expect(out.some((e) => e.date === D1)).toBe(false); // this week skipped
    expect(out.some((e) => e.date === D0)).toBe(true); // others remain
  });

  it('emits an override even when the planned base amount is zero', () => {
    const input = makeInput({
      lifeCosts: [
        lifeCost({ planningMode: 'CUSTOM', customCents: 0, overrides: [{ date: D1, amountCents: 8000 }] }),
      ],
    });
    const out = buildLifeCostEvents(input, 'STABLE');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ date: D1, amountCents: -8000, kind: 'LIFE_COST' });
  });

  it('skips a life cost entirely when base is zero and there are no overrides', () => {
    const input = makeInput({ lifeCosts: [lifeCost({ planningMode: 'CUSTOM', customCents: 0 })] });
    expect(buildLifeCostEvents(input, 'STABLE')).toEqual([]);
  });
});

describe('buildLifeCostEvents budget mode', () => {
  // TODAY is 2026-07-15, horizon 90 days -> covers Jul, Aug, Sep (ends ~Oct 12).
  it('reserves the remaining budget this month and the full budget for later months', () => {
    const input = makeInput({
      lifeCosts: [lifeCost({ budgetMode: true, monthlyBudgetCents: 12000, spentThisMonthCents: 7000 })],
    });
    const out = buildLifeCostEvents(input, 'STABLE');
    // July: 12000 - 7000 = 5000 at month-end; Aug & Sep: full 12000 at month-end.
    expect(out.find((e) => e.date === '2026-07-31')?.amountCents).toBe(-5000);
    expect(out.find((e) => e.date === '2026-08-31')?.amountCents).toBe(-12000);
    expect(out.find((e) => e.date === '2026-09-30')?.amountCents).toBe(-12000);
    expect(out.every((e) => e.kind === 'LIFE_COST')).toBe(true);
  });

  it('reserves nothing for the current month once the budget is spent', () => {
    const input = makeInput({
      lifeCosts: [lifeCost({ budgetMode: true, monthlyBudgetCents: 12000, spentThisMonthCents: 15000 })],
    });
    const out = buildLifeCostEvents(input, 'STABLE');
    expect(out.some((e) => e.date === '2026-07-31')).toBe(false); // overspent -> 0
    expect(out.find((e) => e.date === '2026-08-31')?.amountCents).toBe(-12000);
  });

  it('emits nothing when the monthly budget is zero or unset', () => {
    const zero = makeInput({ lifeCosts: [lifeCost({ budgetMode: true, monthlyBudgetCents: 0 })] });
    expect(buildLifeCostEvents(zero, 'STABLE')).toEqual([]);
    const unset = makeInput({ lifeCosts: [lifeCost({ budgetMode: true, monthlyBudgetCents: null })] });
    expect(buildLifeCostEvents(unset, 'STABLE')).toEqual([]);
  });

  it('defaults spent to zero when not provided', () => {
    const input = makeInput({ lifeCosts: [lifeCost({ budgetMode: true, monthlyBudgetCents: 9000 })] });
    const out = buildLifeCostEvents(input, 'STABLE');
    expect(out.find((e) => e.date === '2026-07-31')?.amountCents).toBe(-9000);
  });
});
