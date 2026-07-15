import { describe, expect, it } from 'vitest';
import { computeEngineOutput } from './pipeline.js';
import { evt, funding, goal, lifeCost, makeInput, ob } from './test-fixtures.js';

const realistic = makeInput({
  liquidCashCents: 284700,
  events: [
    evt({ date: '2026-08-12', amountCents: -120000, kind: 'OBLIGATION', isEssential: true }),
    evt({ date: '2026-07-29', amountCents: 273000, kind: 'INCOME', confidence: 'CONFIRMED' }),
  ],
  lifeCosts: [lifeCost({ frequency: 'WEEKLY', planningMode: 'STAGE_DEFAULT' })],
  obligations: [
    ob({
      name: 'Rent',
      category: 'Housing',
      isEssential: true,
      amountDueCents: 120000,
      frequency: 'MONTHLY',
      consequenceType: 'HOUSING_RISK',
      interestRate: 0,
    }),
  ],
  goals: [
    goal({
      name: 'Immigration',
      targetCents: 600000,
      savedCents: 35000,
      committedPerPaycheckCents: 30000,
      targetDate: '2026-10-15',
    }),
  ],
  fundingEvents: [funding('2026-07-29', 273000)],
});

describe('computeEngineOutput', () => {
  it('returns a fully-populated aggregate', () => {
    const out = computeEngineOutput(realistic);
    expect(out.computedForDate).toBe('2026-07-15');
    expect(out.stage.stage).toBeDefined();
    expect(out.forecast.days).toHaveLength(90);
    expect(out.safeToSpend.safeToSpendCents).toBeGreaterThanOrEqual(0);
    expect(out.urgency).toHaveLength(1);
    expect(out.goalFeasibility).toHaveLength(1);
    expect(out.recommendedBufferCents).toBeGreaterThan(0);
  });

  it('DETERMINISM: identical input yields byte-identical output every run', () => {
    const first = JSON.stringify(computeEngineOutput(realistic));
    for (let i = 0; i < 200; i++) {
      expect(JSON.stringify(computeEngineOutput(realistic))).toBe(first);
    }
  });

  it('does not mutate its input', () => {
    const snapshot = JSON.stringify(realistic);
    computeEngineOutput(realistic);
    expect(JSON.stringify(realistic)).toBe(snapshot);
  });
});
