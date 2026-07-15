/**
 * Single source of truth for every tunable number in the engine.
 *
 * Two categories live here:
 *  1. Score tables transcribed verbatim from the Financial Engine Specification.
 *  2. DECISION thresholds — the numbers that replace the spec's prose words
 *     "significant" / "material". These were confirmed with the product owner
 *     (see memory: financial-brain-locked-decisions).
 *
 * Nothing here is computed. All logic lives in the engine functions.
 */

import type { Cents, Frequency, GoalAlignmentKey } from '@fb/types';

/** Rolling forecast horizon for Safe to Spend. */
export const FORECAST_HORIZON_DAYS = 90;

// ---------------------------------------------------------------------------
// Decision thresholds (locked defaults; replace the spec's qualitative words)
// ---------------------------------------------------------------------------
export const DECISION = {
  /** Using more than this fraction of Safe to Spend => at least YELLOW. */
  SIGNIFICANT_STS_FRACTION: 0.5,
  /** Goal delay beyond this many days => YELLOW. */
  MATERIAL_GOAL_DELAY_DAYS: 14,
  /** Delay beyond this on a NON_NEGOTIABLE goal => RED. */
  SEVERE_GOAL_DELAY_DAYS: 30,
  /** An unresolved obligation at/above this urgency is a "conflict". */
  PRIORITY_CONFLICT_URGENCY: 70,
  /** Purchase purposes treated as discretionary for the conflict test. */
  DISCRETIONARY_PRIORITY_CLASSES: ['ENJOY', 'OPTIONAL_GROWTH'] as const,
  /** New recurring load above this fraction of monthly confirmed income => YELLOW. */
  LONG_HORIZON_LOAD_FRACTION: 0.1,
} as const;

// ---------------------------------------------------------------------------
// Safety buffer defaults by stage (spec §41)
// ---------------------------------------------------------------------------
export const SAFETY_BUFFER = {
  CRITICAL_CENTS: 50_000, // $500
  STABILIZING_CENTS: 100_000, // $1,000
  // STABLE => 1x essentialMonthlyCost (computed)
  // BUILDING_FREEDOM => target 3x essentialMonthlyCost (computed)
  BUILDING_FREEDOM_MONTHS: 3,
} as const;

// ---------------------------------------------------------------------------
// Urgency score component weights (spec §6 / §43). Must sum to 1.
// When a component is UNKNOWN, weights are renormalized over the known set.
// ---------------------------------------------------------------------------
export const URGENCY_WEIGHTS = {
  consequenceSeverity: 0.3,
  essentiality: 0.2,
  paymentStatus: 0.2,
  timeUrgency: 0.15,
  costOfDelay: 0.1,
  goalAlignment: 0.05,
} as const;

// ---------------------------------------------------------------------------
// Consequence severity (spec §7). Keyed by canonical consequence type.
// ---------------------------------------------------------------------------
export const CONSEQUENCE_SEVERITY: Record<string, number> = {
  HOUSING_RISK: 100,
  LEGAL_SEVERE: 100,
  INSURANCE_LAPSE: 95,
  TRANSPORTATION_LOSS: 90,
  UTILITY_SHUTOFF: 90,
  LEGAL_SERIOUS: 90,
  ACCOUNT_DEFAULT: 75,
  VEHICLE_REPOSSESSION: 75,
  LATE_FEE_OR_CREDIT: 60,
  SERVICE_CANCELLATION: 40,
  OPTIONAL_ACCESS_LOSS: 10,
  NONE: 0,
};

// ---------------------------------------------------------------------------
// Essentiality base scores by obligation category (spec §8 / §45).
// Business categories use a revenue-interpolated range; see BUSINESS_ESSENTIALITY.
// ---------------------------------------------------------------------------
export const ESSENTIALITY: Record<string, number> = {
  Housing: 100,
  Food: 100,
  Insurance: 95,
  Car: 95, // transportation required for employment
  Kids: 95,
  Utilities: 90,
  Legal: 85,
  Health: 85,
  Debt: 70,
  Goal: 50,
  Personal: 20,
  Subscriptions: 20,
  Other: 20,
};

/** Business essentiality is interpolated on revenue (resolves the "65–90" range). */
export const BUSINESS_ESSENTIALITY = {
  PRE_REVENUE_MIN: 40,
  PRE_REVENUE_MAX: 60,
  WITH_REVENUE_MIN: 65,
  WITH_REVENUE_MAX: 90,
  /** Monthly revenue (cents) at which essentiality saturates at WITH_REVENUE_MAX. */
  REVENUE_SATURATION_CENTS: 200_000, // $2,000/mo
} as const;

// ---------------------------------------------------------------------------
// Payment status base scores (spec §9 / §46) + days-overdue boost.
// Keys include both user-entered and date-derived statuses; the engine takes
// the max-severity of the two before scoring.
// ---------------------------------------------------------------------------
export const PAYMENT_STATUS: Record<string, number> = {
  SEVERELY_OVERDUE: 100,
  OVERDUE: 85,
  DUE: 75,
  DUE_WITHIN_7_DAYS: 60,
  DUE_WITHIN_14_DAYS: 40,
  CURRENT: 20,
  FUTURE: 10,
  PAUSED: 0,
  IN_DISPUTE: 40,
  PAYMENT_PLAN: 40,
  DUE_SOON: 60,
};

export const DAYS_OVERDUE_BOOST = {
  PER_DAY: 0.5,
  MAX: 20,
} as const;

// ---------------------------------------------------------------------------
// Time urgency by days-until-consequence bucket (spec §10 / §47)
// ---------------------------------------------------------------------------
export const TIME_URGENCY = {
  ALREADY_OCCURRING: 100,
  WITHIN_3: 90,
  WITHIN_7: 75,
  WITHIN_14: 60,
  WITHIN_30: 40,
  WITHIN_90: 20,
  NONE: 0,
} as const;

// ---------------------------------------------------------------------------
// Financial cost of delay (spec §11 / §48). null input => UNKNOWN (excluded).
// ---------------------------------------------------------------------------
export const COST_OF_DELAY = {
  RAPID_COMPOUNDING: 100,
  MAJOR_PENALTIES: 90,
  HIGH_INTEREST: 80,
  MODERATE_INTEREST: 60,
  SMALL_LATE_FEE: 40,
  NONE: 0,
} as const;

/** Interest-rate cutoffs (annual %) used to bucket cost of delay. */
export const INTEREST_RATE_BANDS = {
  HIGH: 0.25,
  MODERATE: 0.1,
} as const;

// ---------------------------------------------------------------------------
// Goal alignment (spec §12 / §49), keyed by derived GoalAlignmentKey.
// ---------------------------------------------------------------------------
export const GOAL_ALIGNMENT: Record<GoalAlignmentKey, number> = {
  PROTECTS_STABILITY: 100,
  INCREASES_PROVEN_INCOME: 90,
  LEGAL_OR_IMMIGRATION: 85,
  BUILDS_EMERGENCY_SAVINGS: 80,
  MONETIZABLE_PRE_REVENUE: 60,
  SELF_DEVELOPMENT: 40,
  LIFESTYLE: 10,
};

// ---------------------------------------------------------------------------
// Category -> GoalAlignmentKey lookup (derives the urgency Goal Alignment
// component from category, so it is never asked during onboarding).
// ---------------------------------------------------------------------------
export const CATEGORY_TO_GOAL_ALIGNMENT: Record<string, GoalAlignmentKey> = {
  Housing: 'PROTECTS_STABILITY',
  Utilities: 'PROTECTS_STABILITY',
  Insurance: 'PROTECTS_STABILITY',
  Car: 'PROTECTS_STABILITY',
  Food: 'PROTECTS_STABILITY',
  Kids: 'PROTECTS_STABILITY',
  Health: 'PROTECTS_STABILITY',
  Legal: 'LEGAL_OR_IMMIGRATION',
  Debt: 'BUILDS_EMERGENCY_SAVINGS',
  Business: 'MONETIZABLE_PRE_REVENUE',
  Personal: 'SELF_DEVELOPMENT',
  Subscriptions: 'LIFESTYLE',
  Other: 'LIFESTYLE',
};

// ---------------------------------------------------------------------------
// Frequency -> occurrences per year, for normalizing amounts to monthly.
// SEMIMONTHLY = 24, BIWEEKLY = 26. ONE_TIME / CUSTOM are handled explicitly.
// ---------------------------------------------------------------------------
export const OCCURRENCES_PER_YEAR: Record<Frequency, number | null> = {
  ONE_TIME: null,
  WEEKLY: 52,
  BIWEEKLY: 26,
  SEMIMONTHLY: 24,
  MONTHLY: 12,
  QUARTERLY: 4,
  ANNUAL: 1,
  CUSTOM: null,
};

/** Helper: monthly-equivalent of an amount at a frequency (cents, unrounded). */
export function monthlyEquivalentRaw(amountCents: Cents, frequency: Frequency): number {
  const perYear = OCCURRENCES_PER_YEAR[frequency];
  if (perYear === null) return 0;
  return (amountCents * perYear) / 12;
}
