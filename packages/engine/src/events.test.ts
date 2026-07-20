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
