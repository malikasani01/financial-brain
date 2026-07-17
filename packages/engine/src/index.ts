// Constants & primitives
export * from './constants.js';
export * from './dateutil.js';
export * from './money-util.js';
export * from './recurrence.js';

// Engine internals worth exposing for the data/AI layers
export { buildForecastEvents, buildLifeCostEvents, selectLifeCostAmount } from './events.js';
export { walkForecast } from './forecast-core.js';
export { essentialMonthlyCostCents } from './essentials.js';
export { runPipelineCore, type PipelineCore } from './core.js';

// The nine engine functions (CODE DECIDES)
export { generate90DayForecast } from './forecast.js';
export { calculateFinancialStage } from './stage.js';
export { calculateRecommendedSafetyBuffer, resolveBufferCents } from './buffer.js';
export { calculateSafeToSpend, safeToSpendFromCore } from './safe-to-spend.js';
export { calculateUrgencyScore } from './urgency.js';
export { allocateAvailableCash } from './allocate.js';
export { simulatePurchaseDecision, purchaseToEvents } from './purchase.js';
export { calculateGoalFeasibility } from './goal.js';
export { maxAffordable } from './max-affordable.js';
export { buildPaycheckLedger } from './ledger.js';
export { advisePaycheckPeriods } from './advice.js';
export { reservedForBills } from './reserved.js';

// Freedom & business scenarios
export {
  calculateFreedom,
  calculateBusinessScenario,
  effectiveMonthlyPriceCents,
} from './business.js';

// Aggregate
export { computeEngineOutput } from './pipeline.js';
