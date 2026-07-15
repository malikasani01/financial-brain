/**
 * @fb/data — the ONLY layer that talks to Supabase.
 *
 * Phase 2 fills this in: repositories that read rows and map them into the
 * engine's materialized input types (@fb/types), plus persistence of forecast
 * snapshots. The engine never imports Supabase; this package bridges the two.
 */

import type { EngineInput } from '@fb/types';

/** Placeholder so the package has a typed surface in Phase 0. */
export type BuildEngineInput = (userId: string, horizonDays: number) => Promise<EngineInput>;
