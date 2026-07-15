/**
 * The acyclic core shared by Safe to Spend, the forecast, and the aggregate
 * output. Runs the locked pipeline order exactly once:
 *
 *   essentials -> stage-detection forecast (buffer 0, life costs conservative)
 *   -> stage -> buffer -> final forecast (stage-selected life costs, real buffer)
 */

import type { CashEvent, Cents, EngineInput, ForecastResult, StageResult } from '@fb/types';
import { buildForecastEvents } from './events.js';
import { walkForecast } from './forecast-core.js';
import { calculateFinancialStage } from './stage.js';
import { calculateRecommendedSafetyBuffer, resolveBufferCents } from './buffer.js';
import { essentialMonthlyCostCents } from './essentials.js';

export interface PipelineCore {
  essentialMonthlyCents: Cents;
  zeroFloorForecast: ForecastResult;
  stageResult: StageResult;
  recommendedBufferCents: Cents;
  safetyBufferCents: Cents;
  forecast: ForecastResult;
  /** The final, stage-selected conservative event stream (reused downstream). */
  finalEvents: CashEvent[];
}

export function runPipelineCore(input: EngineInput): PipelineCore {
  const { liquidCashCents, clock, horizonDays } = input;

  // Stage-detection pass: force STAGE_DEFAULT life costs to their minimum by
  // selecting as if CRITICAL. Explicit MIN/NORMAL/CUSTOM modes are respected.
  const stageEvents = buildForecastEvents(input, 'CRITICAL');
  const zeroFloorForecast = walkForecast(liquidCashCents, stageEvents, clock.today, horizonDays, 0);

  const stageResult = calculateFinancialStage(input, zeroFloorForecast);
  const recommendedBufferCents = calculateRecommendedSafetyBuffer(stageResult.stage, input);
  const safetyBufferCents = resolveBufferCents(input, stageResult.stage);

  const finalEvents = buildForecastEvents(input, stageResult.stage);
  const forecast = walkForecast(
    liquidCashCents,
    finalEvents,
    clock.today,
    horizonDays,
    safetyBufferCents,
  );

  return {
    essentialMonthlyCents: essentialMonthlyCostCents(input),
    zeroFloorForecast,
    stageResult,
    recommendedBufferCents,
    safetyBufferCents,
    forecast,
    finalEvents,
  };
}
