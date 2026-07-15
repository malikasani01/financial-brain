/**
 * Normalized domain inputs consumed by the engine. These are NOT raw Supabase
 * rows — the data layer maps rows into these materialized shapes, expanding
 * recurrences and de-duplicating, so the engine never touches the database.
 */

import type { Cents, ISODate } from './money.js';
import type {
  Frequency,
  GoalAlignmentKey,
  IncomeConfidence,
  ObligationStatus,
  PersonalPriority,
  PriorityClass,
} from './enums.js';

export type CashEventKind =
  'INCOME' | 'OBLIGATION' | 'LIFE_COST' | 'SUBSCRIPTION' | 'GOAL_CONTRIBUTION' | 'PLANNED_PURCHASE';

/**
 * A single dated cash movement in the forecast. `+` = inflow, `-` = outflow.
 * This is the ONLY thing the forecast walks — every source (income,
 * obligations, life costs, subscriptions, committed goal contributions,
 * planned purchases) is normalized into this stream exactly once.
 */
export interface CashEvent {
  date: ISODate;
  amountCents: Cents;
  kind: CashEventKind;
  /** Id of the originating record, for tracing/labelling. */
  sourceId: string;
  /** For income: its confidence. For outflows: treated as CONFIRMED. */
  confidence: IncomeConfidence;
  isEssential: boolean;
}

/** Engine view of an obligation, carrying everything the urgency score needs. */
export interface ObligationInput {
  id: string;
  name: string;
  category: string;
  amountDueCents: Cents | null;
  /** The "cure amount" — minimum to avoid the immediate consequence. */
  minimumRequiredCents: Cents | null;
  dueDate: ISODate | null;
  frequency: Frequency;
  status: ObligationStatus;
  priorityClass: PriorityClass;
  isEssential: boolean;
  isNegotiable: boolean;
  nextExpectedPaymentDate: ISODate | null;

  // "I'm behind" context
  daysOverdue: number | null;
  totalPastDueCents: Cents | null;
  /** User-selected consequence, e.g. 'HOUSING_RISK'. Null when unknown. */
  consequenceType: string | null;
  consequenceAlreadyOccurring: boolean | null;
  consequenceDate: ISODate | null;

  // Financial-cost-of-delay inputs. null => factor is UNKNOWN (never fabricated).
  interestRate: number | null;
  lateFeeCents: Cents | null;
  penaltyCents: Cents | null;

  /** Derived from category via fixed lookup; feeds Goal Alignment component. */
  goalAlignmentKey: GoalAlignmentKey;

  /**
   * For category 'Business' only: the linked business's monthly revenue, used
   * to interpolate essentiality (a revenue-generating tool ranks far higher
   * than the same tool for a pre-revenue project). Null when not applicable.
   */
  businessMonthlyRevenueCents: Cents | null;

  /** Whether the immediate issue is resolved (used to filter "unresolved"). */
  resolved: boolean;
}

/** Engine view of a financial goal. */
export interface GoalInput {
  id: string;
  name: string;
  category: string;
  targetCents: Cents;
  savedCents: Cents;
  targetDate: ISODate | null;
  personalPriority: PersonalPriority;
  /** ONLY committed contributions reduce Safe to Spend (locked decision). */
  committedPerPaycheckCents: Cents;
}

/**
 * Engine view of a normal-life-cost category. NOT pre-expanded into events:
 * the engine expands it over the horizon AFTER the financial stage is known,
 * because the stage decides whether the minimum or normal amount is used.
 */
export interface LifeCostInput {
  id: string;
  category: string;
  frequency: Frequency;
  minimumCents: Cents;
  normalCents: Cents;
  /** MIN | NORMAL | CUSTOM => explicit; STAGE_DEFAULT => decided by stage. */
  planningMode: 'MIN' | 'NORMAL' | 'CUSTOM' | 'STAGE_DEFAULT';
  customCents: Cents | null;
  isEssential: boolean;
  /** First occurrence used to anchor recurrence; defaults to clock.today. */
  nextDate: ISODate | null;
}

/** A confirmed future funding event (paycheck, confirmed rent, confirmed refund). */
export interface FundingEvent {
  date: ISODate;
  amountCents: Cents;
}
