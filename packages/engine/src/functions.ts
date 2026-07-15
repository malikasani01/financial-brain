/**
 * Engine function surface. Signatures are FINAL (Phase 0); bodies are filled in
 * Phase 1 behind a full test suite. Every function is pure: same input =>
 * identical output, no I/O, no Date.now(), no Math.random().
 *
 * Calculation order (acyclic — resolves the stage/buffer/StS cycle):
 *   normalize -> stageForecast(buffer=0) -> stage -> buffer -> lifeCostSelect
 *   -> forecast -> safeToSpend -> urgency -> goalFeasibility
 *   -> decisions / allocation / solvers (on copies)
 */

import type {
  AllocationResult,
  Cents,
  EngineInput,
  ForecastResult,
  GoalFeasibilityResult,
  GoalInput,
  ObligationInput,
  PurchaseInput,
  PurchaseResult,
  SafeToSpendResult,
  StageResult,
  UrgencyResult,
} from '@fb/types';

const PHASE_1 = 'not implemented yet (Phase 1)';

/** Walk projected cash for each day of the horizon; return the low point. */
export function generate90DayForecast(_input: EngineInput): ForecastResult {
  throw new Error(`generate90DayForecast: ${PHASE_1}`);
}

/**
 * Determine the financial stage. Takes a zero-floor forecast (computed with
 * buffer = 0) so stage is knowable before the buffer, breaking the cycle.
 */
export function calculateFinancialStage(
  _input: EngineInput,
  _zeroFloorForecast: ForecastResult,
): StageResult {
  throw new Error(`calculateFinancialStage: ${PHASE_1}`);
}

/** Recommended safety buffer for a stage (may be overridden by the user). */
export function calculateRecommendedSafetyBuffer(
  _stage: StageResult['stage'],
  _input: EngineInput,
): Cents {
  throw new Error(`calculateRecommendedSafetyBuffer: ${PHASE_1}`);
}

/** The headline number: max(0, lowestProjectedCash - buffer) + daily flex. */
export function calculateSafeToSpend(_input: EngineInput): SafeToSpendResult {
  throw new Error(`calculateSafeToSpend: ${PHASE_1}`);
}

/** Financial Urgency Score (0–100) for one obligation. */
export function calculateUrgencyScore(
  _obligation: ObligationInput,
  _input: EngineInput,
): UrgencyResult {
  throw new Error(`calculateUrgencyScore: ${PHASE_1}`);
}

/** Recommend how to split a lump sum across obligations, buffer, and near-term costs. */
export function allocateAvailableCash(
  _availableCents: Cents,
  _input: EngineInput,
): AllocationResult {
  throw new Error(`allocateAvailableCash: ${PHASE_1}`);
}

/** Run the five tests and return a GREEN/YELLOW/RED decision with structured facts. */
export function simulatePurchaseDecision(
  _purchase: PurchaseInput,
  _input: EngineInput,
): PurchaseResult {
  throw new Error(`simulatePurchaseDecision: ${PHASE_1}`);
}

/** Required per-paycheck/month contribution and feasibility for one goal. */
export function calculateGoalFeasibility(
  _goal: GoalInput,
  _input: EngineInput,
): GoalFeasibilityResult {
  throw new Error(`calculateGoalFeasibility: ${PHASE_1}`);
}

/**
 * Invert the engine: the largest one-time or recurring amount for a category
 * that still returns GREEN. Powers the Brain's "how much can I afford" answers
 * via binary search over simulatePurchaseDecision. (CODE decides the number.)
 */
export function maxAffordable(
  _kind: 'ONE_TIME' | 'RECURRING',
  _category: string,
  _input: EngineInput,
): Cents {
  throw new Error(`maxAffordable: ${PHASE_1}`);
}
