/**
 * Recalculation orchestration. The single entry point that all writes call:
 * fetch rows -> normalize -> run the deterministic engine -> persist a snapshot.
 *
 * The snapshot is the canonical result screens read; it is never treated as
 * "current" if a recalculation fails (callers surface an error instead of a
 * stale number).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Clock, EngineOutput } from '@fb/types';
import { computeEngineOutput } from '@fb/engine';
import { FORECAST_HORIZON_DAYS } from '@fb/engine';
import { fetchUserFinancialData } from './repositories.js';
import { normalizeToEngineInput } from './normalize.js';

export async function recalculateFinancials(
  supabase: SupabaseClient,
  userId: string,
  clock: Clock,
): Promise<EngineOutput> {
  const raw = await fetchUserFinancialData(supabase, userId);
  const input = normalizeToEngineInput(raw, clock, FORECAST_HORIZON_DAYS);
  const output = computeEngineOutput(input);

  const { error: snapErr } = await supabase.from('forecast_snapshots').insert({
    user_id: userId,
    safe_to_spend_cents: output.safeToSpend.safeToSpendCents,
    lowest_cash_cents: output.safeToSpend.lowestProjectedCashCents,
    lowest_cash_date: output.safeToSpend.lowestCashDate,
    safety_buffer_cents: output.safetyBufferCents,
    stage: output.stage.stage,
    daily_flexibility_cents: output.safeToSpend.dailyFlexibilityCents,
    urgent_count: output.urgency.filter((u) => u.score >= 70).length,
    full_result: output,
  });
  if (snapErr) throw new Error(`Failed to persist forecast snapshot: ${snapErr.message}`);

  const { error: stageErr } = await supabase
    .from('financial_stage_history')
    .insert({ user_id: userId, stage: output.stage.stage });
  if (stageErr) throw new Error(`Failed to persist stage history: ${stageErr.message}`);

  return output;
}

/** Read the most recent snapshot (screens render this for instant load). */
export async function latestSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<EngineOutput | null> {
  const { data, error } = await supabase
    .from('forecast_snapshots')
    .select('full_result')
    .eq('user_id', userId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load snapshot: ${error.message}`);
  return (data?.full_result as EngineOutput | undefined) ?? null;
}
