/**
 * Input and output contracts for the deterministic financial engine.
 *
 * The engine takes a fully-materialized {@link EngineInput} and returns plain
 * data. Every result carries the structured facts that justify it — the AI
 * layer turns those facts into prose, it never invents them.
 */

import type { Cents, Clock, ISODate } from './money.js';
import type { DecisionState, DecisionType, FinancialStage, GoalStatus, Purpose } from './enums.js';
import type {
  CashEvent,
  FundingEvent,
  GoalInput,
  LifeCostInput,
  ObligationInput,
} from './domain.js';

/** Fully-materialized input to the engine. No DB or framework types leak in. */
export interface EngineInput {
  clock: Clock;
  /** Forecast horizon in days (90 for Safe to Spend; longer for feasibility). */
  horizonDays: number;
  /** Sum of account balances minus active reservations. */
  liquidCashCents: Cents;
  /**
   * All stage-INDEPENDENT cash movements, already expanded & de-duplicated:
   * income, obligation outflows, subscriptions, committed goal contributions,
   * and planned purchases. The `kind` field distinguishes them. Life costs are
   * NOT here — see `lifeCosts`.
   */
  events: CashEvent[];
  /** Stage-dependent; the engine expands these per the resolved stage. */
  lifeCosts: LifeCostInput[];
  /** Rich obligation metadata for urgency, stage detection, and conflicts. */
  obligations: ObligationInput[];
  goals: GoalInput[];
  /** Confirmed funding events, ascending by date, for daily-flexibility math. */
  fundingEvents: FundingEvent[];
  /** User override for the safety buffer; null => use the recommendation. */
  bufferOverrideCents: Cents | null;
}

// ---- Forecast --------------------------------------------------------------

export interface ForecastDay {
  date: ISODate;
  projectedCashCents: Cents;
}

export interface ForecastResult {
  days: ForecastDay[];
  lowestProjectedCashCents: Cents;
  lowestCashDate: ISODate;
  negativeDates: ISODate[];
  belowBufferDates: ISODate[];
}

// ---- Financial stage & buffer ---------------------------------------------

export interface StageResult {
  stage: FinancialStage;
  /** Human-readable reasons the stage was assigned (facts, not prose). */
  reasons: string[];
}

// ---- Safe to Spend ---------------------------------------------------------

export interface SafeToSpendResult {
  /** max(0, rawHeadroom). What the UI shows as "Safe to Spend". */
  safeToSpendCents: Cents;
  /** lowestProjectedCash - buffer. May be negative; drives CRITICAL detection. */
  rawHeadroomCents: Cents;
  lowestProjectedCashCents: Cents;
  lowestCashDate: ISODate;
  safetyBufferCents: Cents;
  currentLiquidCashCents: Cents;
  totalConfirmedIncomeCents: Cents;
  totalRequiredObligationsCents: Cents;
  totalPlannedEssentialCents: Cents;
  totalCommittedGoalContribCents: Cents;
  /** null when there is no confirmed funding event within the horizon. */
  dailyFlexibilityCents: Cents | null;
  daysUntilNextFundingEvent: number | null;
}

// ---- Urgency ---------------------------------------------------------------

export interface UrgencyComponent {
  key: string;
  /** null => factor is UNKNOWN; excluded from the renormalized weighted sum. */
  scoreOrNull: number | null;
  weight: number;
}

export interface UrgencyResult {
  obligationId: string;
  /** 0–100, capped. */
  score: number;
  components: UrgencyComponent[];
  /** Factors surfaced to the UI as "information needed". */
  unknownFactors: string[];
}

// ---- Allocation ------------------------------------------------------------

export interface AllocationLine {
  obligationId: string | null;
  label: string;
  amountCents: Cents;
  reason: string;
  urgencyScore: number | null;
}

export interface AllocationResult {
  /** Lines sum EXACTLY to the input available amount (largest-remainder). */
  lines: AllocationLine[];
  totalAllocatedCents: Cents;
  protectedAsBufferCents: Cents;
}

// ---- Purchase decision -----------------------------------------------------

export interface PurchaseInput {
  name: string;
  amountCents: Cents;
  type: DecisionType;
  purpose: Purpose;
  /** For SUBSCRIPTION / PAYMENT_PLAN / LOAN. */
  monthlyPaymentCents?: Cents;
  termMonths?: number;
  /** Defaults to clock.today when omitted. */
  plannedDate?: ISODate;
  /** Business ROI context (Test 5). */
  businessContext?: BusinessDecisionContext;
}

export interface BusinessDecisionContext {
  ownsAlternative: boolean | null;
  requiredToLaunch: boolean | null;
  requiredToOperate: boolean | null;
  lowerCostOptionExists: boolean | null;
  businessHasRevenue: boolean | null;
}

export interface TestOutcome {
  passed: boolean;
  contributesTo: DecisionState;
  detail: string;
}

export interface GoalDelay {
  goalId: string;
  daysDelayed: number;
}

export interface PurchaseResult {
  state: DecisionState;
  tests: {
    safeToSpend: TestOutcome;
    ninetyDayCash: TestOutcome;
    priorityConflict: TestOutcome;
    goalDelay: TestOutcome;
    businessRoi?: TestOutcome;
    longHorizonLoad?: TestOutcome;
  };
  safeToSpendBeforeCents: Cents;
  safeToSpendAfterCents: Cents;
  dailyFlexBeforeCents: Cents | null;
  dailyFlexAfterCents: Cents | null;
  lowestCashAfterCents: Cents;
  goalDelays: GoalDelay[];
  /** Structured facts the AI explains. Never prose. */
  reasons: string[];
}

// ---- Goal feasibility ------------------------------------------------------

export interface GoalFeasibilityResult {
  goalId: string;
  remainingCents: Cents;
  requiredPerPaycheckCents: Cents;
  requiredPerMonthCents: Cents;
  estimatedCompletionDate: ISODate | null;
  /** Can current confirmed cash flow support the target date? */
  feasible: boolean;
  status: GoalStatus;
  shortfallCents: Cents;
}

// ---- Aggregate output ------------------------------------------------------

/** The canonical result persisted to forecast_snapshots and read by screens. */
export interface EngineOutput {
  computedForDate: ISODate;
  stage: StageResult;
  safetyBufferCents: Cents;
  recommendedBufferCents: Cents;
  forecast: ForecastResult;
  safeToSpend: SafeToSpendResult;
  urgency: UrgencyResult[];
  goalFeasibility: GoalFeasibilityResult[];
}
