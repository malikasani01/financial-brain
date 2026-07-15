import { describe, expect, it } from 'vitest';
import { calculateGoalFeasibility } from './goal.js';
import { funding, goal, makeInput } from './test-fixtures.js';

describe('calculateGoalFeasibility', () => {
  it('a fully-saved goal is COMPLETED', () => {
    const r = calculateGoalFeasibility(goal({ targetCents: 5000, savedCents: 5000 }), makeInput());
    expect(r.status).toBe('COMPLETED');
    expect(r.remainingCents).toBe(0);
    expect(r.estimatedCompletionDate).toBe('2026-07-15');
  });

  it('with no committed contributions and no target, it is OFF_TRACK', () => {
    const r = calculateGoalFeasibility(goal({ committedPerPaycheckCents: 0 }), makeInput());
    expect(r.estimatedCompletionDate).toBeNull();
    expect(r.status).toBe('OFF_TRACK');
    expect(r.feasible).toBe(false);
  });

  it('with committed pace and no target, it is ON_TRACK', () => {
    const r = calculateGoalFeasibility(goal({ committedPerPaycheckCents: 25000 }), makeInput());
    expect(r.status).toBe('ON_TRACK');
    expect(r.feasible).toBe(true);
  });

  it('reaches completion on a known paycheck date', () => {
    const input = makeInput({
      fundingEvents: [funding('2026-07-29', 200000), funding('2026-08-12', 200000)],
    });
    const r = calculateGoalFeasibility(
      goal({
        targetCents: 30000,
        savedCents: 0,
        committedPerPaycheckCents: 20000,
        targetDate: '2026-08-31',
      }),
      input,
    );
    // 20000 + 20000 >= 30000 by the 2nd paycheck (Aug 12) <= target => ON_TRACK.
    expect(r.estimatedCompletionDate).toBe('2026-08-12');
    expect(r.status).toBe('ON_TRACK');
    expect(r.requiredPerPaycheckCents).toBe(15000); // 30000 / 2 paychecks before target
    expect(r.feasible).toBe(true);
  });

  it('extrapolates beyond the known paychecks at the average cadence', () => {
    const input = makeInput({
      fundingEvents: [funding('2026-07-29', 200000), funding('2026-08-12', 200000)],
    });
    const r = calculateGoalFeasibility(
      goal({
        targetCents: 100000,
        savedCents: 0,
        committedPerPaycheckCents: 20000,
        targetDate: '2026-08-20',
      }),
      input,
    );
    // Needs 5 paychecks; only 2 are known (gap 14d) => extrapolated past target.
    expect(r.estimatedCompletionDate! > '2026-08-20').toBe(true);
    expect(r.shortfallCents).toBeGreaterThan(0);
    expect(['AT_RISK', 'OFF_TRACK']).toContain(r.status);
    expect(r.feasible).toBe(false);
  });

  it('AT_RISK when completion lands just past the target date', () => {
    const input = makeInput({ fundingEvents: [funding('2026-08-05', 200000)] });
    const r = calculateGoalFeasibility(
      goal({
        targetCents: 20000,
        savedCents: 0,
        committedPerPaycheckCents: 20000,
        targetDate: '2026-08-01',
      }),
      input,
    );
    // One committed paycheck on Aug 5 clears it, but target was Aug 1 (within 30d slack).
    expect(r.status).toBe('AT_RISK');
  });

  it('uses required-per-month and handles a target date of today', () => {
    const r = calculateGoalFeasibility(
      goal({
        targetCents: 50000,
        savedCents: 0,
        committedPerPaycheckCents: 0,
        targetDate: '2026-07-15',
      }),
      makeInput(),
    );
    expect(r.requiredPerMonthCents).toBe(50000); // months-to-target 0 => whole remainder
    expect(r.requiredPerPaycheckCents).toBe(50000); // no paychecks before target
  });
});
