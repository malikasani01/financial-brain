/**
 * Money-management guidance per paycheck-ledger period: is this period
 * healthy, tight, or negative; how much of it is genuinely safe to move to
 * savings and split across which goals; and which discretionary life costs
 * (groceries, eating out, ...) have room to trim if it's tight.
 *
 * CODE DECIDES: every number here is computed, not templated guesswork.
 *
 * Two rules matter:
 *  1. Savings are cumulative. Money moved to a goal in one period is gone in
 *     the next, so we carry a running `cumulativeSaved` and cap each period's
 *     savings at (worst ending balance from here to the horizon end) minus
 *     what's already been earmarked minus the buffer. This mirrors Safe to
 *     Spend, applied across periods rather than at a single instant.
 *  2. Goals fill in priority order (then smaller remaining first), and each
 *     goal's remaining need decrements as periods save toward it — so a goal is
 *     never suggested more than it needs, and a small emergency fund is
 *     finished before a larger goal.
 */

import type {
  EngineInput,
  GoalFeasibilityResult,
  GoalInput,
  LifeCostInput,
  PaycheckLedger,
  PeriodAdvice,
  PeriodHealth,
  PeriodSavingsAllocation,
  PeriodTrim,
} from '@fb/types';
import { PERSONAL_PRIORITIES } from '@fb/types';
import { calculateGoalFeasibility } from './goal.js';

/** Goals still needing money, in the order savings should fill them. */
function orderedGoals(
  goals: GoalInput[],
  feasByGoal: Map<string, GoalFeasibilityResult>,
): GoalInput[] {
  const rank = (g: GoalInput) => PERSONAL_PRIORITIES.indexOf(g.personalPriority);
  // Every goal id is present in feasByGoal (built from this same array), so
  // lookups are trusted rather than guarded.
  return goals
    .filter((g) => feasByGoal.get(g.id)!.remainingCents > 0)
    .sort((a, b) => {
      const byPriority = rank(a) - rank(b);
      if (byPriority !== 0) return byPriority;
      // Same priority: finish the smaller goal first (e.g. a starter emergency
      // fund before a large multi-thousand-dollar goal).
      return feasByGoal.get(a.id)!.remainingCents - feasByGoal.get(b.id)!.remainingCents;
    });
}

function healthFor(lowestCents: number, safetyBufferCents: number): PeriodHealth {
  if (lowestCents < 0) return 'NEGATIVE';
  if (lowestCents < safetyBufferCents) return 'TIGHT';
  return 'HEALTHY';
}

/** Discretionary life-cost lines in a period with headroom above their minimum. */
function trimsFor(
  lines: PaycheckLedger['periods'][number]['lines'],
  lifeCostById: Map<string, LifeCostInput>,
): PeriodTrim[] {
  const byCategory = new Map<string, PeriodTrim>();
  for (const line of lines) {
    if (line.kind !== 'LIFE_COST') continue;
    // Every LIFE_COST line's sourceId originates from input.lifeCosts (see
    // buildLifeCostEvents), so it is guaranteed present here.
    const lc = lifeCostById.get(line.sourceId)!;
    if (lc.planningMode === 'MIN' || lc.planningMode === 'CUSTOM') continue; // user already fixed this
    if (lc.normalCents <= lc.minimumCents) continue; // no headroom to trim
    if (Math.abs(line.amountCents) <= lc.minimumCents) continue; // already posted at minimum

    const potential = lc.normalCents - lc.minimumCents;
    const existing = byCategory.get(lc.id);
    byCategory.set(lc.id, {
      lifeCostId: lc.id,
      category: lc.category,
      potentialSavingsCents: (existing?.potentialSavingsCents ?? 0) + potential,
    });
  }
  return [...byCategory.values()].sort((a, b) => b.potentialSavingsCents - a.potentialSavingsCents);
}

export function advisePaycheckPeriods(input: EngineInput, ledger: PaycheckLedger): PeriodAdvice[] {
  const lifeCostById = new Map(input.lifeCosts.map((lc) => [lc.id, lc]));
  const feasByGoal = new Map(input.goals.map((g) => [g.id, calculateGoalFeasibility(g, input)]));
  const goals = orderedGoals(input.goals, feasByGoal);
  const remainingByGoal = new Map(goals.map((g) => [g.id, feasByGoal.get(g.id)!.remainingCents]));
  const buffer = ledger.safetyBufferCents;

  let cumulativeSaved = 0;

  return ledger.periods.map((p, i) => {
    const health = healthFor(p.lowestCents, buffer);

    // Worst ending balance from this period through the end of the horizon.
    // Subtract what earlier periods already earmarked (that cash is gone) and
    // the buffer to get what's genuinely free to save this period.
    const worstAheadCents = Math.min(...ledger.periods.slice(i).map((pp) => pp.endingCents));
    const availableToSaveCents = Math.max(0, worstAheadCents - cumulativeSaved - buffer);

    const allocations: PeriodSavingsAllocation[] = [];
    if (health === 'HEALTHY') {
      let budget = availableToSaveCents;
      for (const g of goals) {
        if (budget <= 0) break;
        const remaining = remainingByGoal.get(g.id)!;
        if (remaining <= 0) continue;
        const take = Math.min(budget, remaining);
        const remainingAfter = remaining - take;
        allocations.push({ goalId: g.id, amountCents: take, remainingAfterCents: remainingAfter });
        remainingByGoal.set(g.id, remainingAfter);
        budget -= take;
        cumulativeSaved += take;
      }
    }

    const suggestedSavingsCents = allocations.reduce((s, a) => s + a.amountCents, 0);
    return {
      health,
      suggestedSavingsCents,
      allocations,
      trims: health === 'HEALTHY' ? [] : trimsFor(p.lines, lifeCostById),
    };
  });
}
