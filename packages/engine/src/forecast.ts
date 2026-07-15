/**
 * Public forecast entry point. Returns the final, stage-selected, buffer-aware
 * rolling forecast. All the interesting ordering lives in runPipelineCore.
 */

import type { EngineInput, ForecastResult } from '@fb/types';
import { runPipelineCore } from './core.js';

export function generate90DayForecast(input: EngineInput): ForecastResult {
  return runPipelineCore(input).forecast;
}
