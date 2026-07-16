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

describe('advisePaycheckPeriods — savings cap', () => {
  it('caps savings at the worst ending balance ahead, minus the buffer', () => {
    const ledger = ledgerOf(
      [
        period({ endingCents: 100000, lowestCents: 100000 }),
        period({ endingCents: 25000, lowestCents: 25000 }),
      ],
      20000,
    );
    const input = makeInput({ goals: [goal({ id: 'g1', targetCents: 500000, savedCents: 0 })] });
    const advice = advisePaycheckPeriods(input, ledger);
    // Worst ending ahead of period 0 is 25,000; minus the 20,000 buffer = 5,000.
    expect(advice[0]!.suggestedSavingsCents).toBe(5000);
    expect(advice[0]!.allocations).toEqual([
      { goalId: 'g1', amountCents: 5000, remainingAfterCents: 495000 },
    ]);
  });

  it('suggests nothing (and no allocations) when a healthy period has no headroom', () => {
    const ledger = ledgerOf([period({ endingCents: 20000, lowestCents: 20000 })], 20000);
    const input = makeInput({ goals: [goal({ id: 'g1' })] });
    const advice = advisePaycheckPeriods(input, ledger);
    expect(advice[0]!.health).toBe('HEALTHY');
    expect(advice[0]!.suggestedSavingsCents).toBe(0);
    expect(advice[0]!.allocations).toEqual([]);
  });
});

describe('advisePaycheckPeriods — goal fill order', () => {
  it('fills a higher-priority goal before a lower-priority one', () => {
    const high = goal({ id: 'high', personalPriority: 'NON_NEGOTIABLE', targetCents: 100000, savedCents: 0 });
    const low = goal({ id: 'low', personalPriority: 'IMPORTANT', targetCents: 5000, savedCents: 0 });
    const ledger = ledgerOf([period({ endingCents: 50000, lowestCents: 50000 })], 0);
    const advice = advisePaycheckPeriods(makeInput({ goals: [low, high] }), ledger);
    // Priority wins over size: the whole $500 goes to the NON_NEGOTIABLE goal.
    expect(advice[0]!.allocations).toEqual([
      { goalId: 'high', amountCents: 50000, remainingAfterCents: 50000 },
    ]);
  });

  it('within equal priority, finishes the smaller goal first, then partially funds the next, then stops', () => {
    const emergency = goal({ id: 'emergency', personalPriority: 'IMPORTANT', targetCents: 30000, savedCents: 0 });
    const mid = goal({ id: 'mid', personalPriority: 'IMPORTANT', targetCents: 40000, savedCents: 0 });
    const big = goal({ id: 'big', personalPriority: 'IMPORTANT', targetCents: 500000, savedCents: 0 });
    const ledger = ledgerOf([period({ endingCents: 50000, lowestCents: 50000 })], 0);
    const advice = advisePaycheckPeriods(makeInput({ goals: [big, mid, emergency] }), ledger);
    expect(advice[0]!.allocations).toEqual([
      { goalId: 'emergency', amountCents: 30000, remainingAfterCents: 0 }, // filled (take = remaining)
      { goalId: 'mid', amountCents: 20000, remainingAfterCents: 20000 }, // partial (take = budget)
      // 'big' never reached — budget hit zero (break).
    ]);
    expect(advice[0]!.suggestedSavingsCents).toBe(50000);
  });

  it('excludes goals that are already fully saved', () => {
    const done = goal({ id: 'done', targetCents: 100000, savedCents: 100000 });
    const open = goal({ id: 'open', targetCents: 100000, savedCents: 0 });
    const ledger = ledgerOf([period({ endingCents: 60000, lowestCents: 60000 })], 0);
    const advice = advisePaycheckPeriods(makeInput({ goals: [done, open] }), ledger);
    expect(advice[0]!.allocations.map((a) => a.goalId)).toEqual(['open']);
  });

  it('makes no allocations when there are no goals', () => {
    const ledger = ledgerOf([period({ endingCents: 60000, lowestCents: 60000 })], 0);
    const advice = advisePaycheckPeriods(makeInput({ goals: [] }), ledger);
    expect(advice[0]!.allocations).toEqual([]);
    expect(advice[0]!.suggestedSavingsCents).toBe(0);
  });
});

describe('advisePaycheckPeriods — cumulative across periods', () => {
  it('decrements a goal as periods fund it and skips it once complete, carrying savings forward', () => {
    const emergency = goal({ id: 'emergency', personalPriority: 'IMPORTANT', targetCents: 20000, savedCents: 0 });
    const immigration = goal({ id: 'immigration', personalPriority: 'IMPORTANT', targetCents: 500000, savedCents: 0 });
    const ledger = ledgerOf(
      [
        period({ endingCents: 30000, lowestCents: 30000 }),
        period({ endingCents: 100000, lowestCents: 100000 }),
      ],
      0,
    );
    const advice = advisePaycheckPeriods(
      makeInput({ goals: [immigration, emergency] }),
      ledger,
    );

    // Period 0: worst-ahead 30,000. Emergency fills ($200), immigration gets the rest ($100).
    expect(advice[0]!.allocations).toEqual([
      { goalId: 'emergency', amountCents: 20000, remainingAfterCents: 0 },
      { goalId: 'immigration', amountCents: 10000, remainingAfterCents: 490000 },
    ]);

    // Period 1: worst-ahead 100,000 minus the 30,000 already saved = 70,000, all
    // to immigration (emergency is complete and skipped).
    expect(advice[1]!.allocations).toEqual([
      { goalId: 'immigration', amountCents: 70000, remainingAfterCents: 420000 },
    ]);
    expect(advice[1]!.suggestedSavingsCents).toBe(70000);
  });
});

describe('advisePaycheckPeriods — discretionary trims', () => {
  it('suggests no trims for a healthy period even with headroom', () => {
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

  it('sums repeated occurrences and sorts categories by potential savings', () => {
    const ledger = ledgerOf([
      period({
        endingCents: 10000,
        lowestCents: 10000,
        lines: [
          line({ kind: 'LIFE_COST', sourceId: 'groceries', amountCents: -17500 }),
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
    // Groceries: 2 x (17,500-10,000) = 15,000; Eating out: 15,000 too, but ties
    // resolve to a stable order — assert both present with the right amounts.
    expect(trims).toContainEqual({ lifeCostId: 'groceries', category: 'Groceries', potentialSavingsCents: 15000 });
    expect(trims).toContainEqual({ lifeCostId: 'eatingout', category: 'Eating out', potentialSavingsCents: 15000 });
  });

  it('sorts a clearly larger trim ahead of a smaller one', () => {
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

  it('excludes life costs pinned to MIN or CUSTOM, with no headroom, or already at minimum', () => {
    const ledger = ledgerOf([
      period({
        endingCents: 10000,
        lowestCents: 10000,
        lines: [
          line({ kind: 'LIFE_COST', sourceId: 'pinned-min', amountCents: -10000 }),
          line({ kind: 'LIFE_COST', sourceId: 'pinned-custom', amountCents: -15000 }),
          line({ kind: 'LIFE_COST', sourceId: 'no-headroom', amountCents: -10000 }),
          line({ kind: 'LIFE_COST', sourceId: 'at-minimum', amountCents: -10000 }),
        ],
      }),
    ]);
    const input = makeInput({
      lifeCosts: [
        lifeCost({ id: 'pinned-min', minimumCents: 10000, normalCents: 17500, planningMode: 'MIN' }),
        lifeCost({ id: 'pinned-custom', minimumCents: 10000, normalCents: 17500, customCents: 15000, planningMode: 'CUSTOM' }),
        lifeCost({ id: 'no-headroom', minimumCents: 10000, normalCents: 10000, planningMode: 'STAGE_DEFAULT' }),
        lifeCost({ id: 'at-minimum', minimumCents: 10000, normalCents: 17500, planningMode: 'STAGE_DEFAULT' }),
      ],
    });
    expect(advisePaycheckPeriods(input, ledger)[0]!.trims).toEqual([]);
  });

  it('skips non-life-cost lines and still computes trims for a negative period', () => {
    const ledger = ledgerOf([
      period({
        endingCents: -5000,
        lowestCents: -5000,
        lines: [
          line({ kind: 'OBLIGATION', sourceId: 'rent', amountCents: -300000 }),
          line({ kind: 'LIFE_COST', sourceId: 'groceries', amountCents: -17500 }),
        ],
      }),
    ]);
    const input = makeInput({
      lifeCosts: [lifeCost({ id: 'groceries', category: 'Groceries', minimumCents: 10000, normalCents: 17500, planningMode: 'NORMAL' })],
    });
    const advice = advisePaycheckPeriods(input, ledger)[0]!;
    expect(advice.allocations).toEqual([]); // no savings in a negative period
    expect(advice.trims).toEqual([{ lifeCostId: 'groceries', category: 'Groceries', potentialSavingsCents: 7500 }]);
  });
});
