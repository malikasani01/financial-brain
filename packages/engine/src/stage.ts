/**
 * Financial stage detection (spec §40), made deterministic.
 *
 * Takes a ZERO-FLOOR forecast (walked with buffer = 0) so the stage is known
 * before the buffer — this is what breaks the stage->buffer->StS->stage cycle.
 * Rules and thresholds live in constants (STAGE.*) and are documented there.
 */

import type { EngineInput, FinancialStage, ForecastResult, StageResult } from '@fb/types';
import { STAGE } from './constants.js';
import { daysBetween } from './dateutil.js';
import { essentialMonthlyCostCents } from './essentials.js';

export function calculateFinancialStage(
  input: EngineInput,
  zeroFloorForecast: ForecastResult,
): StageResult {
  const today = input.clock.today;
  const essentialMonthly = essentialMonthlyCostCents(input);
  const low = zeroFloorForecast.lowestProjectedCashCents;

  const nearTermNegative = zeroFloorForecast.negativeDates.some(
    (d) => daysBetween(today, d) <= STAGE.NEAR_TERM_DAYS,
  );

  const unresolved = input.obligations.filter((o) => !o.resolved);
  const criticalConsequence = unresolved.some(
    (o) => o.isEssential && o.consequenceAlreadyOccurring === true,
  );
  const severelyOverdueEssential = unresolved.some(
    (o) => o.isEssential && o.status === 'SEVERELY_OVERDUE',
  );
  const anyOverdue = unresolved.some(
    (o) => o.status === 'OVERDUE' || o.status === 'SEVERELY_OVERDUE',
  );

  const reasons: string[] = [];
  let stage: FinancialStage;

  if (nearTermNegative || criticalConsequence || severelyOverdueEssential) {
    stage = 'CRITICAL';
    if (nearTermNegative) reasons.push('Cash is projected to go negative within 30 days.');
    if (criticalConsequence)
      reasons.push('An essential obligation has a consequence already occurring.');
    if (severelyOverdueEssential) reasons.push('An essential obligation is severely overdue.');
  } else if (anyOverdue || low < essentialMonthly) {
    stage = 'STABILIZING';
    if (anyOverdue) reasons.push('One or more obligations are overdue.');
    if (low < essentialMonthly)
      reasons.push('Projected reserves stay below one month of essential costs.');
  } else {
    const fundingFreedom = input.goals.some((g) => g.committedPerPaycheckCents > 0);
    const hasReserve =
      input.liquidCashCents >= STAGE.BUILDING_FREEDOM_RESERVE_MONTHS * essentialMonthly;
    if (fundingFreedom && hasReserve) {
      stage = 'BUILDING_FREEDOM';
      reasons.push('Obligations are current and you are actively funding longer-term goals.');
    } else {
      stage = 'STABLE';
      reasons.push('No overdue essentials and the forecast stays above one month of costs.');
    }
  }

  return { stage, reasons };
}
