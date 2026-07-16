import { describe, expect, it } from 'vitest';
import type { LedgerLine, LedgerPeriod, PaycheckLedger } from '@fb/types';
import { advisePaycheckPeriods } from './advice.js';
import { goal, lifeCost, makeInput } from './test-fixtures.js';

// Local, minimal ledger builders — advisePaycheckPeriods is tested in
// isolation from buildPaycheckLedger (which has its own coverage), so we
// hand-construct exactly the periods/lines each test needs.
function period(over: Partial<LedgerPeriod> = {}): LedgerPeriod {
  return {
    incomeDate: null,
    incomeSourceIds: [],
    incomeAmountCents: 0,
    openingCents: 0,
    availableCents: 0,
    lines: [],
    endingCents: 0,
    lowestCents: 0,
    ...over,
  };
}

function line(over: Partial<LedgerLine> = {}): LedgerLine {
  return {
    date: '2026-07-20',
    sourceId: 's',
    kind: 'OBLIGATION',
    amountCents: 0,
    runningCents: 0,
    belowBuffer: false,
    negative: false,
    ...over,
  };
}

function ledgerOf(periods: LedgerPeriod[], safetyBufferCents = 20000): PaycheckLedger {
  return { periods, safetyBufferCents, lowestCents: Math.min(...periods.map((p) => p.lowestCents)) };
}

describe('advisePaycheckPeriods — health classification', () => {
  it('classifies HEALTHY, TIGHT, and NEGATIVE periods', () => {
    const ledger = ledgerOf([
      period({ endingCents: 50000, lowestCents: 50000 }),
      period({ endingCents: 10000, lowestCents: 10000 }),
      period({ endingCents: -5000, lowestCents: -5000 }),
    ]);
    const advice = advisePaycheckPeriods(makeInput(), ledger);
    expect(advice.map((a) => a.health)).toEqual(['HEALTHY', 'TIGHT', 'NEGATIVE']);
  });
});

describe('advisePaycheckPeriods — safe-to-save cap', () => {
  it("caps a healthy period's savings by a later period's lower ending balance", () => {
    const ledger = ledgerOf([
      period({ endingCents: 100000, lowestCents: 100000 }),
      period({ endingCents: 25000, lowestCents: 25000 }),
    ]);
    const input = makeInput({ goals: [goal({ id: 'g1' })] });
    const advice = advisePaycheckPeriods(input, ledger);
    // Both periods are constrained by the worst point ahead: 25000 - 20000 buffer = 5000.
    expect(advice[0]!.suggestedSavingsCents).toBe(5000);
    expect(advice[1]!.suggestedSavingsCents).toBe(5000);
    expect(advice[0]!.suggestedGoalId).toBe('g1');
  });

  it("suggests no goal when a healthy period's safe-to-save is zero", () => {
    const ledger = ledgerOf([period({ endingCents: 20000, lowestCents: 20000 })], 20000);
    const input = makeInput({ goals: [goal({ id: 'g1' })] });
    const advice = advisePaycheckPeriods(input, ledger);
    expect(advice[0]!.health).toBe('HEALTHY');
    expect(advice[0]!.suggestedSavingsCents).toBe(0);
    expect(advice[0]!.suggestedGoalId).toBeNull();
  });
});

describe('advisePaycheckPeriods — goal picking', () => {
  const healthyLedger = ledgerOf([period({ endingCents: 500000, lowestCents: 500000 })]);

  it('suggests the highest-priority off-track goal, breaking ties by larger shortfall', () => {
    const ga = goal({
      id: 'ga',
      personalPriority: 'VERY_IMPORTANT',
      targetDate: '2026-09-01',
      committedPerPaycheckCents: 0,
      targetCents: 500000,
      savedCents: 0,
    });
    const gb = goal({
      id: 'gb',
      personalPriority: 'VERY_IMPORTANT',
      targetDate: '2026-09-01',
      committedPerPaycheckCents: 0,
      targetCents: 200000,
      savedCents: 0,
    });
    const gc = goal({
      id: 'gc',
      personalPriority: 'NON_NEGOTIABLE',
      targetDate: '2026-09-01',
      committedPerPaycheckCents: 0,
      targetCents: 100000,
      savedCents: 0,
    });
    const input = makeInput({ goals: [ga, gb, gc] });
    const advice = advisePaycheckPeriods(input, healthyLedger);
    // gc wins on priority alone, despite the smallest shortfall of the three.
    expect(advice[0]!.suggestedGoalId).toBe('gc');
  });

  it('falls back to the best active goal when none are off-track', () => {
    const onTrack = goal({
      id: 'on-track',
      committedPerPaycheckCents: 50000,
      targetCents: 100000,
      savedCents: 0,
      targetDate: null,
    });
    const input = makeInput({ goals: [onTrack] });
    const advice = advisePaycheckPeriods(input, healthyLedger);
    expect(advice[0]!.suggestedGoalId).toBe('on-track');
  });

  it('ignores completed goals entirely', () => {
    const completed = goal({ id: 'done', targetCents: 100000, savedCents: 100000 });
    const offTrack = goal({ id: 'off-track', targetCents: 100000, savedCents: 0 });
    const input = makeInput({ goals: [completed, offTrack] });
    const advice = advisePaycheckPeriods(input, healthyLedger);
    expect(advice[0]!.suggestedGoalId).toBe('off-track');
  });

  it('suggests no goal when there are no goals at all', () => {
    const advice = advisePaycheckPeriods(makeInput({ goals: [] }), healthyLedger);
    expect(advice[0]!.suggestedGoalId).toBeNull();
  });

  it('suggests no goal when every goal is already completed', () => {
    const completed = goal({ id: 'done', targetCents: 100000, savedCents: 100000 });
    const advice = advisePaycheckPeriods(makeInput({ goals: [completed] }), healthyLedger);
    expect(advice[0]!.suggestedGoalId).toBeNull();
  });
});

describe('advisePaycheckPeriods — discretionary trims', () => {
  it('suggests no trims for a healthy period even with headroom available', () => {
    const ledger = ledgerOf([
      period({
        endingCents: 500000,
        lowestCents: 500000,
        lines: [line({ kind: 'LIFE_COST', sourceId: 'groceries', amountCents: -17500 })],
      }),
    ]);
    const input = makeInput({
      lifeCosts: [lifeCost({ id: 'groceries', minimumCents: 10000, normalCents: 17500, planningMode: 'NORMAL' })],
    });
    expect(advisePaycheckPeriods(input, ledger)[0]!.trims).toEqual([]);
  });

  it('finds a NORMAL-mode life cost above its minimum, summing repeated occurrences in the period', () => {
    const ledger = ledgerOf([
      period({
        endingCents: 10000,
        lowestCents: 10000,
        lines: [
          line({ kind: 'LIFE_COST', sourceId: 'groceries', amountCents: -17500 }),
          line({ kind: 'LIFE_COST', sourceId: 'groceries', amountCents: -17500 }),
        ],
      }),
    ]);
    const input = makeInput({
      lifeCosts: [lifeCost({ id: 'groceries', category: 'Groceries', minimumCents: 10000, normalCents: 17500, planningMode: 'NORMAL' })],
    });
    const trims = advisePaycheckPeriods(input, ledger)[0]!.trims;
    expect(trims).toEqual([{ lifeCostId: 'groceries', category: 'Groceries', potentialSavingsCents: 15000 }]);
  });

  it('sorts multiple trimmable categories by potential savings, descending', () => {
    const ledger = ledgerOf([
      period({
        endingCents: 10000,
        lowestCents: 10000,
        lines: [
          line({ kind: 'LIFE_COST', sourceId: 'groceries', amountCents: -17500 }),
          line({ kind: 'LIFE_COST', sourceId: 'eatingout', amountCents: -20000 }),
        ],
      }),
    ]);
    const input = makeInput({
      lifeCosts: [
        lifeCost({ id: 'groceries', category: 'Groceries', minimumCents: 10000, normalCents: 17500, planningMode: 'NORMAL' }),
        lifeCost({ id: 'eatingout', category: 'Eating out', minimumCents: 5000, normalCents: 20000, planningMode: 'NORMAL' }),
      ],
    });
    const trims = advisePaycheckPeriods(input, ledger)[0]!.trims;
    expect(trims.map((t) => t.category)).toEqual(['Eating out', 'Groceries']);
  });

  it('excludes a life cost pinned by the user to MIN or CUSTOM', () => {
    const ledger = ledgerOf([
      period({
        endingCents: 10000,
        lowestCents: 10000,
        lines: [
          line({ kind: 'LIFE_COST', sourceId: 'pinned-min', amountCents: -10000 }),
          line({ kind: 'LIFE_COST', sourceId: 'pinned-custom', amountCents: -15000 }),
        ],
      }),
    ]);
    const input = makeInput({
      lifeCosts: [
        lifeCost({ id: 'pinned-min', minimumCents: 10000, normalCents: 17500, planningMode: 'MIN' }),
        lifeCost({ id: 'pinned-custom', minimumCents: 10000, normalCents: 17500, customCents: 15000, planningMode: 'CUSTOM' }),
      ],
    });
    expect(advisePaycheckPeriods(input, ledger)[0]!.trims).toEqual([]);
  });

  it('excludes a life cost with no headroom between normal and minimum', () => {
    const ledger = ledgerOf([
      period({
        endingCents: 10000,
        lowestCents: 10000,
        lines: [line({ kind: 'LIFE_COST', sourceId: 'fixed', amountCents: -10000 })],
      }),
    ]);
    const input = makeInput({
      lifeCosts: [lifeCost({ id: 'fixed', minimumCents: 10000, normalCents: 10000, planningMode: 'STAGE_DEFAULT' })],
    });
    expect(advisePaycheckPeriods(input, ledger)[0]!.trims).toEqual([]);
  });

  it('excludes a life cost already posted at its minimum this period', () => {
    const ledger = ledgerOf([
      period({
        endingCents: 10000,
        lowestCents: 10000,
        // Posted at the minimum (e.g. a tight financial stage already selected
        // it) even though normal > minimum — nothing further to trim.
        lines: [line({ kind: 'LIFE_COST', sourceId: 'groceries', amountCents: -10000 })],
      }),
    ]);
    const input = makeInput({
      lifeCosts: [lifeCost({ id: 'groceries', minimumCents: 10000, normalCents: 17500, planningMode: 'STAGE_DEFAULT' })],
    });
    expect(advisePaycheckPeriods(input, ledger)[0]!.trims).toEqual([]);
  });

  it('skips non-life-cost lines when computing trims', () => {
    const ledger = ledgerOf([
      period({
        endingCents: 10000,
        lowestCents: 10000,
        lines: [
          line({ kind: 'OBLIGATION', sourceId: 'rent', amountCents: -300000 }),
          line({ kind: 'LIFE_COST', sourceId: 'groceries', amountCents: -17500 }),
        ],
      }),
    ]);
    const input = makeInput({
      lifeCosts: [lifeCost({ id: 'groceries', category: 'Groceries', minimumCents: 10000, normalCents: 17500, planningMode: 'NORMAL' })],
    });
    const trims = advisePaycheckPeriods(input, ledger)[0]!.trims;
    expect(trims).toHaveLength(1);
    expect(trims[0]!.lifeCostId).toBe('groceries');
  });

  it('computes trims for a negative period too', () => {
    const ledger = ledgerOf([
      period({
        endingCents: -5000,
        lowestCents: -5000,
        lines: [line({ kind: 'LIFE_COST', sourceId: 'groceries', amountCents: -17500 })],
      }),
    ]);
    const input = makeInput({
      lifeCosts: [lifeCost({ id: 'groceries', category: 'Groceries', minimumCents: 10000, normalCents: 17500, planningMode: 'NORMAL' })],
    });
    const trims = advisePaycheckPeriods(input, ledger)[0]!.trims;
    expect(trims).toEqual([{ lifeCostId: 'groceries', category: 'Groceries', potentialSavingsCents: 7500 }]);
  });
});
