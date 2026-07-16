/**
 * Money-management guidance per paycheck-ledger period: is this period
 * healthy, tight, or negative; how much of it is genuinely safe to move to
 * savings; which goal that surplus should go toward; and which discretionary
 * life costs (groceries, eating out, ...) have room to trim if it's tight.
 *
 * CODE DECIDES: every number here is computed, not templated guesswork. The
 * key safety rule — mirroring Safe to Spend — is that a period's suggested
 * savings amount is capped by every period from here through the end of the
 * horizon, not just this one. Cash that looks free today but is needed to
 * cover a bill three periods out is never suggested as "safe to save."
 */

import type {
  EngineInput,
  GoalFeasibilityResult,
  GoalInput,
  LifeCostInput,
  PaycheckLedger,
  PeriodAdvice,
  PeriodHealth,
  PeriodTrim,
} from '@fb/types';
import { PERSONAL_PRIORITIES } from '@fb/types';
import { calculateGoalFeasibility } from './goal.js';

/** The single goal this ledger's surplus should be suggested toward, if any. */
function pickGoal(
  goals: GoalInput[],
  feasByGoal: Map<string, GoalFeasibilityResult>,
): string | null {
  // Every goal id is guaranteed present in feasByGoal (built from this same
  // goals array just above), so lookups are trusted rather than guarded.
  const active = goals.filter((g) => feasByGoal.get(g.id)!.status !== 'COMPLETED');
  if (active.length === 0) return null;

  const rank = (g: GoalInput) => PERSONAL_PRIORITIES.indexOf(g.personalPriority);
  const behind = active.filter((g) => feasByGoal.get(g.id)!.feasible === false);
  const pool = behind.length > 0 ? behind : active;

  const sorted = [...pool].sort((a, b) => {
    const byPriority = rank(a) - rank(b);
    if (byPriority !== 0) return byPriority;
    return feasByGoal.get(b.id)!.shortfallCents - feasByGoal.get(a.id)!.shortfallCents;
  });
  return sorted[0]!.id;
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
  const feasByGoal = new Map(
    input.goals.map((g) => [g.id, calculateGoalFeasibility(g, input)]),
  );
  const suggestedGoalId = pickGoal(input.goals, feasByGoal);

  return ledger.periods.map((p, i) => {
    const health = healthFor(p.lowestCents, ledger.safetyBufferCents);

    // Safe to save from this period on = the worst ending balance from here
    // through the rest of the horizon, minus the buffer. Using only this
    // period's own ending balance would ignore a shortfall later on.
    const worstAheadCents = Math.min(...ledger.periods.slice(i).map((pp) => pp.endingCents));
    const safeToSaveCents = Math.max(0, worstAheadCents - ledger.safetyBufferCents);

    const healthy = health === 'HEALTHY';
    return {
      health,
      suggestedSavingsCents: healthy ? safeToSaveCents : 0,
      suggestedGoalId: healthy && safeToSaveCents > 0 ? suggestedGoalId : null,
      trims: healthy ? [] : trimsFor(p.lines, lifeCostById),
    };
  });
}
