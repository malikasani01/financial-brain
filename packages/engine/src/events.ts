/**
 * Turns EngineInput into the concrete CashEvent stream the forecast walks.
 *
 * Two responsibilities:
 *  - Expand life-cost categories into dated outflow events, choosing the
 *    minimum or normal amount according to the financial stage.
 *  - Filter the official ("conservative") forecast to CONFIRMED income only.
 */

import type { CashEvent, EngineInput, FinancialStage, LifeCostInput } from '@fb/types';
import { expandOccurrences } from './recurrence.js';

/** The amount a life-cost category contributes, given the stage. */
export function selectLifeCostAmount(lc: LifeCostInput, stage: FinancialStage): number {
  switch (lc.planningMode) {
    case 'MIN':
      return lc.minimumCents;
    case 'NORMAL':
      return lc.normalCents;
    case 'CUSTOM':
      return lc.customCents ?? lc.minimumCents;
    case 'STAGE_DEFAULT':
      // Tighter stages live on the minimum; healthier stages use the normal amount.
      return stage === 'CRITICAL' || stage === 'STABILIZING' ? lc.minimumCents : lc.normalCents;
  }
}

/** Expand every life cost into dated outflow events for the given stage. */
export function buildLifeCostEvents(input: EngineInput, stage: FinancialStage): CashEvent[] {
  const { clock, horizonDays } = input;
  const out: CashEvent[] = [];
  for (const lc of input.lifeCosts) {
    const amount = selectLifeCostAmount(lc, stage);
    if (amount <= 0) continue;
    const anchor = lc.nextDate ?? clock.today;
    for (const date of expandOccurrences(anchor, lc.frequency, clock.today, horizonDays)) {
      out.push({
        date,
        amountCents: -amount,
        kind: 'LIFE_COST',
        sourceId: lc.id,
        confidence: 'CONFIRMED',
        isEssential: lc.isEssential,
      });
    }
  }
  return out;
}

/**
 * The conservative forecast counts ALL outflows but only CONFIRMED income.
 * VARIABLE / HIGHLY_LIKELY / SPECULATIVE income never increases Safe to Spend.
 */
export function filterConservative(events: CashEvent[]): CashEvent[] {
  return events.filter((e) => e.kind !== 'INCOME' || e.confidence === 'CONFIRMED');
}

/** All forecast events for a stage: stage-independent events + life costs. */
export function buildForecastEvents(input: EngineInput, stage: FinancialStage): CashEvent[] {
  return [...filterConservative(input.events), ...buildLifeCostEvents(input, stage)];
}
