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
  CashEventKind,
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

// ---- Paycheck ledger -------------------------------------------------------

/** One posted item in the running-balance ledger. */
export interface LedgerLine {
  date: ISODate;
  /** Originating record id, for labelling in the UI. */
  sourceId: string;
  kind: CashEventKind;
  /** Signed: outflows negative, inflows positive. */
  amountCents: Cents;
  /** Balance immediately after this line is applied. */
  runningCents: Cents;
  /** runningCents fell below the safety buffer. */
  belowBuffer: boolean;
  /** runningCents went negative. */
  negative: boolean;
}

/**
 * A paycheck period: the income that opens it plus every outflow it must cover
 * until the next income. `incomeDate` is null for the leading "cash on hand"
 * block before the first paycheck lands.
 */
export interface LedgerPeriod {
  incomeDate: ISODate | null;
  /** Source ids of the income(s) opening this period (for labelling). */
  incomeSourceIds: string[];
  incomeAmountCents: Cents;
  /** Running balance carried in, before this period's income. */
  openingCents: Cents;
  /** openingCents + incomeAmountCents — the period's "Available". */
  availableCents: Cents;
  lines: LedgerLine[];
  /** Running balance at the end of the period. */
  endingCents: Cents;
  /** Lowest running balance reached within the period. */
  lowestCents: Cents;
}

/** Running-balance ledger, grouped by paycheck. Reconciles with the forecast. */
export interface PaycheckLedger {
  periods: LedgerPeriod[];
  safetyBufferCents: Cents;
  /** Lowest running balance across the whole horizon. */
  lowestCents: Cents;
}

// ---- Paycheck ledger advice -------------------------------------------------

export type PeriodHealth = 'HEALTHY' | 'TIGHT' | 'NEGATIVE';

/** A discretionary life-cost category with headroom between normal and minimum. */
export interface PeriodTrim {
  lifeCostId: string;
  category: string;
  /** normalCents - minimumCents, summed across this period's occurrences. */
  potentialSavingsCents: Cents;
}

/**
 * Money-management guidance for one ledger period. `suggestedSavingsCents` is
 * bounded by every period from here through the end of the horizon, not just
 * this one — money "free" now but needed by a later period is never suggested
 * (the same principle behind Safe to Spend).
 */
export interface PeriodAdvice {
  health: PeriodHealth;
  suggestedSavingsCents: Cents;
  /** The goal this period's surplus is suggested toward; null if none apply. */
  suggestedGoalId: string | null;
  /** Discretionary categories worth trimming toward their minimum, largest first. */
  trims: PeriodTrim[];
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

// ---- Freedom plan & business scenarios (spec §33) --------------------------

export interface FreedomResult {
  /** The monthly net income needed to replace employment. */
  freedomNumberCents: Cents;
  currentBusinessIncomeCents: Cents;
  /** freedomNumber - currentBusinessIncome, floored at 0. */
  freedomGapCents: Cents;
}

export interface BusinessScenarioInput {
  id: string;
  label: string | null;
  /** Exactly one price is normally set; monthly wins, then weekly, then annual. */
  weeklyPriceCents: Cents | null;
  monthlyPriceCents: Cents | null;
  annualPriceCents: Cents | null;
  payingUsers: number;
  variableCostPerUserCents: Cents;
  fixedMonthlyCents: Cents;
}

export interface BusinessScenarioResult {
  id: string;
  label: string | null;
  /** Effective monthly price per user (non-monthly plans normalized). */
  monthlyPricePerUserCents: Cents;
  mrrCents: Cents;
  arrCents: Cents;
  /** MRR minus total variable cost. */
  grossProfitCents: Cents;
  /** Gross profit minus fixed monthly expenses. */
  netOperatingProfitCents: Cents;
  /** Paying users needed for net operating profit to cover the Freedom Number; null if unit economics can't. */
  customersToFreedom: number | null;
  /** Net operating profit as a percent of the Freedom Number (>=0). */
  freedomCoveragePercent: number;
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
