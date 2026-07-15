/**
 * Goal feasibility (PRD §16/§30/§31). Computes what a goal needs per paycheck
 * and per month, and estimates a completion date from the COMMITTED pace (only
 * committed contributions are real — see the locked goals-vs-StS decision).
 *
 * If the committed pace can't reach the target date, we say so plainly rather
 * than forcing an artificial allocation.
 */

import type {
  EngineInput,
  FundingEvent,
  GoalFeasibilityResult,
  GoalInput,
  ISODate,
} from '@fb/types';
import { addDays, compareDate, daysBetween } from './dateutil.js';

const DEFAULT_PAYCHECK_GAP_DAYS = 14; // user is biweekly
const AT_RISK_SLACK_DAYS = 30;

function futurePaychecks(input: EngineInput): FundingEvent[] {
  const today = input.clock.today;
  return input.fundingEvents
    .filter((f) => compareDate(f.date, today) > 0)
    .sort((a, b) => compareDate(a.date, b.date));
}

function averageGapDays(paychecks: FundingEvent[]): number {
  if (paychecks.length < 2) return DEFAULT_PAYCHECK_GAP_DAYS;
  let total = 0;
  for (let i = 1; i < paychecks.length; i++) {
    total += daysBetween(paychecks[i - 1]!.date, paychecks[i]!.date);
  }
  return Math.max(1, Math.round(total / (paychecks.length - 1)));
}

/** Project the date the committed pace reaches `remaining`, or null if never. */
function estimateCompletion(
  remaining: number,
  committedPerPaycheck: number,
  paychecks: FundingEvent[],
  today: ISODate,
): ISODate | null {
  if (remaining <= 0) return today;
  if (committedPerPaycheck <= 0) return null;

  let acc = 0;
  for (const p of paychecks) {
    acc += committedPerPaycheck;
    if (acc >= remaining) return p.date;
  }
  // Ran past the known paychecks: extrapolate at the average cadence.
  const gap = averageGapDays(paychecks);
  const stillNeeded = remaining - acc;
  const extraPaychecks = Math.ceil(stillNeeded / committedPerPaycheck);
  const anchor = paychecks.length > 0 ? paychecks[paychecks.length - 1]!.date : today;
  return addDays(anchor, extraPaychecks * gap);
}

export function calculateGoalFeasibility(
  goal: GoalInput,
  input: EngineInput,
): GoalFeasibilityResult {
  const today = input.clock.today;
  const remaining = Math.max(0, goal.targetCents - goal.savedCents);
  const paychecks = futurePaychecks(input);
  const committed = goal.committedPerPaycheckCents;

  const estimatedCompletionDate = estimateCompletion(remaining, committed, paychecks, today);

  // Requirements to hit the target date.
  let requiredPerPaycheckCents = 0;
  let requiredPerMonthCents = 0;
  let shortfallCents = 0;
  let feasible: boolean;

  if (goal.targetDate) {
    const paychecksBeforeTarget = paychecks.filter(
      (p) => compareDate(p.date, goal.targetDate!) <= 0,
    ).length;
    const daysToTarget = Math.max(0, daysBetween(today, goal.targetDate));
    const monthsToTarget = daysToTarget / 30;

    requiredPerPaycheckCents =
      paychecksBeforeTarget > 0 ? Math.ceil(remaining / paychecksBeforeTarget) : remaining;
    requiredPerMonthCents = monthsToTarget > 0 ? Math.ceil(remaining / monthsToTarget) : remaining;

    const willSave = committed * paychecksBeforeTarget;
    shortfallCents = Math.max(0, remaining - willSave);
    feasible = remaining === 0 || willSave >= remaining;
  } else {
    feasible = remaining === 0 || committed > 0;
  }

  let status: GoalFeasibilityResult['status'];
  if (remaining === 0) {
    status = 'COMPLETED';
  } else if (goal.targetDate && estimatedCompletionDate) {
    if (compareDate(estimatedCompletionDate, goal.targetDate) <= 0) status = 'ON_TRACK';
    else if (
      compareDate(estimatedCompletionDate, addDays(goal.targetDate, AT_RISK_SLACK_DAYS)) <= 0
    )
      status = 'AT_RISK';
    else status = 'OFF_TRACK';
  } else {
    status = committed > 0 ? 'ON_TRACK' : 'OFF_TRACK';
  }

  return {
    goalId: goal.id,
    remainingCents: remaining,
    requiredPerPaycheckCents,
    requiredPerMonthCents,
    estimatedCompletionDate,
    feasible,
    status,
    shortfallCents,
  };
}
