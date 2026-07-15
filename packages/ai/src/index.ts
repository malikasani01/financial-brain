/**
 * @fb/ai — the "AI EXPLAINS" layer.
 *
 * Phase 4 fills this in: a context-builder that maps each question type to a
 * minimal, whitelisted struct of ALREADY-COMPUTED engine outputs, and the
 * Claude call that turns those facts into calm, non-shaming prose. This layer
 * never calculates financial values and never receives the raw database.
 *
 * Models (locked): claude-opus-4-8 for the Brain's reasoning-heavy answers,
 * claude-haiku-4-5 for lighter explanation calls.
 */

import type { EngineOutput } from '@fb/types';

/** Placeholder so the package has a typed surface in Phase 0. */
export type ExplainContext = {
  question: string;
  engineOutput: EngineOutput;
};
