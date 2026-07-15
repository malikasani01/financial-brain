/**
 * computeEngineOutput — the single canonical result screens read and snapshots
 * persist. Runs the pipeline core ONCE, then layers Safe to Spend, urgency, and
 * goal feasibility on top of it.
 */

import type { EngineInput, EngineOutput } from '@fb/types';
import { runPipelineCore } from './core.js';
import { safeToSpendFromCore } from './safe-to-spend.js';
import { calculateUrgencyScore } from './urgency.js';
import { calculateGoalFeasibility } from './goal.js';

export function computeEngineOutput(input: EngineInput): EngineOutput {
  const core = runPipelineCore(input);
  return {
    computedForDate: input.clock.today,
    stage: core.stageResult,
    safetyBufferCents: core.safetyBufferCents,
    recommendedBufferCents: core.recommendedBufferCents,
    forecast: core.forecast,
    safeToSpend: safeToSpendFromCore(core, input),
    urgency: input.obligations.map((o) => calculateUrgencyScore(o, input)),
    goalFeasibility: input.goals.map((g) => calculateGoalFeasibility(g, input)),
  };
}
