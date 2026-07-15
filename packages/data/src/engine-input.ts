/**
 * Fetch a user's rows and normalize them into an EngineInput. The one place
 * that composes the read path with the pure normalizer, reused by both the
 * recalculation job and any screen that needs a live engine view.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Clock, EngineInput } from '@fb/types';
import { fetchUserFinancialData } from './repositories.js';
import { normalizeToEngineInput } from './normalize.js';

export async function buildEngineInput(
  supabase: SupabaseClient,
  userId: string,
  clock: Clock,
  horizonDays: number,
): Promise<EngineInput> {
  const raw = await fetchUserFinancialData(supabase, userId);
  return normalizeToEngineInput(raw, clock, horizonDays);
}
