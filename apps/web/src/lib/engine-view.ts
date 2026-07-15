import type { EngineInput, EngineOutput } from '@fb/types';
import { buildEngineInput } from '@fb/data';
import { computeEngineOutput, FORECAST_HORIZON_DAYS } from '@fb/engine';
import { getSessionContext, type SessionContext } from '@/lib/session';

export interface EngineView extends SessionContext {
  input: EngineInput;
  output: EngineOutput;
}

/**
 * Compute a fresh engine view for the current user. The engine is pure and
 * cheap, so screens recompute live rather than risk a stale snapshot. The
 * forecast_snapshots table is for history, not for reads.
 */
export async function loadEngineView(): Promise<EngineView> {
  const ctx = await getSessionContext();
  const input = await buildEngineInput(ctx.supabase, ctx.userId, ctx.clock, FORECAST_HORIZON_DAYS);
  const output = computeEngineOutput(input);
  return { ...ctx, input, output };
}
