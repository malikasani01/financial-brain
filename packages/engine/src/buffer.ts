/**
 * Safety buffer (spec §41). Recommendation is a function of stage; the user may
 * override it (the UI warns when the override is below the recommendation — the
 * engine simply uses whatever value is in effect).
 */

import type { Cents, EngineInput, FinancialStage } from '@fb/types';
import { SAFETY_BUFFER } from './constants.js';
import { essentialMonthlyCostCents } from './essentials.js';

export function calculateRecommendedSafetyBuffer(stage: FinancialStage, input: EngineInput): Cents {
  const essentialMonthly = essentialMonthlyCostCents(input);
  switch (stage) {
    case 'CRITICAL':
      return SAFETY_BUFFER.CRITICAL_CENTS;
    case 'STABILIZING':
      return SAFETY_BUFFER.STABILIZING_CENTS;
    case 'STABLE':
      return essentialMonthly;
    case 'BUILDING_FREEDOM':
      return SAFETY_BUFFER.BUILDING_FREEDOM_MONTHS * essentialMonthly;
  }
}

/** The buffer in effect: user override if set, else the recommendation. */
export function resolveBufferCents(input: EngineInput, stage: FinancialStage): Cents {
  return input.bufferOverrideCents ?? calculateRecommendedSafetyBuffer(stage, input);
}
