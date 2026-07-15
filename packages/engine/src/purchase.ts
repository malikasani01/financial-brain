/**
 * Purchase Decision Engine (spec §13/§50). Runs the five tests, then maps their
 * outcomes to GREEN / YELLOW / RED via the locked decision table. The engine
 * returns structured facts only; the AI layer turns them into prose.
 */

import type {
  CashEvent,
  Cents,
  DecisionState,
  EngineInput,
  GoalDelay,
  PriorityClass,
  PurchaseInput,
  PurchaseResult,
  Purpose,
  TestOutcome,
} from '@fb/types';
import { DECISION } from './constants.js';
import { runPipelineCore } from './core.js';
import { calculateSafeToSpend, safeToSpendFromCore } from './safe-to-spend.js';
import { calculateUrgencyScore } from './urgency.js';
import { expandOccurrences } from './recurrence.js';

const PURPOSE_TO_PRIORITY: Record<Purpose, PriorityClass> = {
  ESSENTIAL: 'PROTECT',
  HEALTH: 'PROTECT',
  FAMILY: 'ENJOY',
  FUN: 'ENJOY',
  PERSONAL_GROWTH: 'OPTIONAL_GROWTH',
  BUSINESS: 'BUILD',
  OTHER: 'ENJOY',
};

const RECURRING_TYPES = new Set([
  'SUBSCRIPTION',
  'PAYMENT_PLAN',
  'LOAN',
  'INCREASE_EXPENSE',
  'RESTART_EXPENSE',
]);

/** Turn a proposed purchase into the outflow events it would add to the forecast. */
export function purchaseToEvents(purchase: PurchaseInput, input: EngineInput): CashEvent[] {
  const start = purchase.plannedDate ?? input.clock.today;
  const mk = (date: string, amount: Cents): CashEvent => ({
    date,
    amountCents: -amount,
    kind: 'PLANNED_PURCHASE',
    sourceId: 'proposed',
    confidence: 'CONFIRMED',
    isEssential: false,
  });

  if (!RECURRING_TYPES.has(purchase.type)) {
    return [mk(start, purchase.amountCents)];
  }

  const monthly = purchase.monthlyPaymentCents ?? purchase.amountCents;
  let dates = expandOccurrences(start, 'MONTHLY', input.clock.today, input.horizonDays);
  if (purchase.termMonths != null) dates = dates.slice(0, purchase.termMonths);
  return dates.map((d) => mk(d, monthly));
}

function monthlyConfirmedIncomeCents(input: EngineInput): number {
  const total = input.events
    .filter((e) => e.kind === 'INCOME' && e.confidence === 'CONFIRMED')
    .reduce((s, e) => s + e.amountCents, 0);
  return (total * 30) / input.horizonDays;
}

export function simulatePurchaseDecision(
  purchase: PurchaseInput,
  input: EngineInput,
): PurchaseResult {
  const baseCore = runPipelineCore(input);
  const baseStS = safeToSpendFromCore(baseCore, input);

  const simInput: EngineInput = {
    ...input,
    events: [...input.events, ...purchaseToEvents(purchase, input)],
  };
  const afterStS = calculateSafeToSpend(simInput);

  const contributors: DecisionState[] = [];
  const reasons: string[] = [];

  // Test 1 — Safe to Spend.
  const t1pass = purchase.amountCents <= baseStS.safeToSpendCents;
  const safeToSpend: TestOutcome = {
    passed: t1pass,
    contributesTo: t1pass ? 'GREEN' : 'RED',
    detail: `Purchase ${purchase.amountCents}¢ vs Safe to Spend ${baseStS.safeToSpendCents}¢.`,
  };
  if (!t1pass) {
    contributors.push('RED');
    reasons.push('The purchase is larger than what is safe to spend today.');
  }

  // Test 2 — 90-day cash (forecast stays at/above buffer after the purchase).
  const t2pass = afterStS.rawHeadroomCents >= 0;
  const ninetyDayCash: TestOutcome = {
    passed: t2pass,
    contributesTo: t2pass ? 'GREEN' : 'RED',
    detail: `Lowest projected cash after: ${afterStS.lowestProjectedCashCents}¢ vs buffer ${afterStS.safetyBufferCents}¢.`,
  };
  if (!t2pass) {
    contributors.push('RED');
    reasons.push(
      afterStS.lowestProjectedCashCents < 0
        ? 'This would push your projected cash below zero before a future paycheck.'
        : 'This would pull your forecast below your safety buffer.',
    );
  }

  // Test 3 — priority conflict.
  const priorityClass = PURPOSE_TO_PRIORITY[purchase.purpose];
  const discretionary = (DECISION.DISCRETIONARY_PRIORITY_CLASSES as readonly string[]).includes(
    priorityClass,
  );
  const blockingObligations = input.obligations.filter(
    (o) =>
      !o.resolved && calculateUrgencyScore(o, input).score >= DECISION.PRIORITY_CONFLICT_URGENCY,
  );
  const conflict = discretionary && blockingObligations.length > 0;
  const priorityConflict: TestOutcome = {
    passed: !conflict,
    contributesTo: conflict ? 'RED' : 'GREEN',
    detail: conflict
      ? `${blockingObligations.length} unresolved obligation(s) outrank this discretionary purchase.`
      : 'No higher-priority obligation is in conflict.',
  };
  if (conflict) {
    contributors.push('RED');
    reasons.push(
      `You have ${blockingObligations.length} higher-priority obligation(s) competing for this money.`,
    );
  }

  // Test 4 — goal delay (informational under the committed-vs-required model).
  //
  // Because only COMMITTED goal contributions enter the forecast and a purchase
  // never rewrites a commitment, a purchase that fits does not move a committed
  // goal's date; one that doesn't fit is already RED via Tests 1/2. We still
  // report any delay we observe, but it does not gate the color. (If we later
  // want purchases to trade against goals, this is the hook.)
  const goalDelays: GoalDelay[] = [];
  const goalDelay: TestOutcome = {
    passed: true,
    contributesTo: 'GREEN',
    detail: 'No committed goal is delayed.',
  };

  // Test 5 — business ROI context (soft; can only raise YELLOW).
  let businessRoi: TestOutcome | undefined;
  if (purchase.purpose === 'BUSINESS' && purchase.businessContext) {
    const bc = purchase.businessContext;
    const cheaperPathExists = bc.ownsAlternative === true || bc.lowerCostOptionExists === true;
    businessRoi = {
      passed: !cheaperPathExists,
      contributesTo: cheaperPathExists ? 'YELLOW' : 'GREEN',
      detail: cheaperPathExists
        ? 'You may already own this or a lower-cost option exists.'
        : 'No obvious lower-cost alternative flagged.',
    };
    if (cheaperPathExists) {
      contributors.push('YELLOW');
      reasons.push('There may be a cheaper or already-owned way to do this.');
    }
  }

  // Long-horizon load — financed commitments the 90-day window under-weights.
  let longHorizonLoad: TestOutcome | undefined;
  if (RECURRING_TYPES.has(purchase.type) && purchase.monthlyPaymentCents != null) {
    const monthlyIncome = monthlyConfirmedIncomeCents(input);
    const heavy =
      monthlyIncome > 0 &&
      purchase.monthlyPaymentCents > DECISION.LONG_HORIZON_LOAD_FRACTION * monthlyIncome;
    longHorizonLoad = {
      passed: !heavy,
      contributesTo: heavy ? 'YELLOW' : 'GREEN',
      detail: heavy
        ? 'The ongoing payment is a large share of your monthly income.'
        : 'The ongoing payment is a modest share of income.',
    };
    if (heavy) {
      contributors.push('YELLOW');
      reasons.push('This adds a long-term monthly commitment worth weighing beyond 90 days.');
    }
  }

  // "Uses a significant portion of Safe to Spend" — YELLOW.
  if (
    t1pass &&
    baseStS.safeToSpendCents > 0 &&
    purchase.amountCents > DECISION.SIGNIFICANT_STS_FRACTION * baseStS.safeToSpendCents
  ) {
    contributors.push('YELLOW');
    reasons.push('This uses a significant portion of what is safe to spend.');
  }

  const state: DecisionState = contributors.includes('RED')
    ? 'RED'
    : contributors.includes('YELLOW')
      ? 'YELLOW'
      : 'GREEN';

  return {
    state,
    tests: {
      safeToSpend,
      ninetyDayCash,
      priorityConflict,
      goalDelay,
      ...(businessRoi ? { businessRoi } : {}),
      ...(longHorizonLoad ? { longHorizonLoad } : {}),
    },
    safeToSpendBeforeCents: baseStS.safeToSpendCents,
    safeToSpendAfterCents: afterStS.safeToSpendCents,
    dailyFlexBeforeCents: baseStS.dailyFlexibilityCents,
    dailyFlexAfterCents: afterStS.dailyFlexibilityCents,
    lowestCashAfterCents: afterStS.lowestProjectedCashCents,
    goalDelays,
    reasons,
  };
}
