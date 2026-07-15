/**
 * Safe to Spend = max(0, lowestProjectedCash - safetyBuffer) over the horizon.
 *
 * The raw headroom (which may be negative) is kept separately: it drives
 * CRITICAL detection and the "how far underwater" messaging, while the headline
 * number is floored at zero.
 */

import type { CashEvent, Cents, EngineInput, SafeToSpendResult } from '@fb/types';
import { runPipelineCore, type PipelineCore } from './core.js';
import { compareDate, daysBetween } from './dateutil.js';

/** Sum event amounts of the given kinds (returns the signed sum). */
function sumKinds(events: CashEvent[], kinds: CashEvent['kind'][]): Cents {
  return events.filter((e) => kinds.includes(e.kind)).reduce((s, e) => s + e.amountCents, 0);
}

export function calculateSafeToSpend(input: EngineInput): SafeToSpendResult {
  return safeToSpendFromCore(runPipelineCore(input), input);
}

/** Build the Safe to Spend result from an already-computed pipeline core. */
export function safeToSpendFromCore(core: PipelineCore, input: EngineInput): SafeToSpendResult {
  const low = core.forecast.lowestProjectedCashCents;
  const buffer = core.safetyBufferCents;
  const rawHeadroom = low - buffer;
  const safeToSpend = Math.max(0, rawHeadroom);

  const ev = core.finalEvents;
  const totalConfirmedIncomeCents = sumKinds(ev, ['INCOME']); // already confirmed-only
  const totalRequiredObligationsCents = -sumKinds(ev, [
    'OBLIGATION',
    'SUBSCRIPTION',
    'PLANNED_PURCHASE',
  ]);
  const totalPlannedEssentialCents = -sumKinds(ev, ['LIFE_COST']);
  const totalCommittedGoalContribCents = -sumKinds(ev, ['GOAL_CONTRIBUTION']);

  // Daily flexibility spreads Safe to Spend across the days until the next
  // confirmed funding event. Null when there is no such event in view.
  const today = input.clock.today;
  const nextFunding = input.fundingEvents
    .filter((f) => compareDate(f.date, today) > 0)
    .sort((a, b) => compareDate(a.date, b.date))[0];

  let dailyFlexibilityCents: Cents | null = null;
  let daysUntilNextFundingEvent: number | null = null;
  if (nextFunding) {
    daysUntilNextFundingEvent = daysBetween(today, nextFunding.date);
    dailyFlexibilityCents = Math.floor(safeToSpend / daysUntilNextFundingEvent);
  }

  return {
    safeToSpendCents: safeToSpend,
    rawHeadroomCents: rawHeadroom,
    lowestProjectedCashCents: low,
    lowestCashDate: core.forecast.lowestCashDate,
    safetyBufferCents: buffer,
    currentLiquidCashCents: input.liquidCashCents,
    totalConfirmedIncomeCents,
    totalRequiredObligationsCents,
    totalPlannedEssentialCents,
    totalCommittedGoalContribCents,
    dailyFlexibilityCents,
    daysUntilNextFundingEvent,
  };
}
