/**
 * Domain enumerations, expressed as string-literal unions plus a frozen value
 * array. Using `as const` arrays (not TS `enum`) keeps them compatible with
 * `isolatedModules` / `verbatimModuleSyntax` and lets them double as runtime
 * validators. Values match the Postgres enum types 1:1.
 */

export const ACCOUNT_TYPES = [
  'checking',
  'savings',
  'cash',
  'payment_app',
  'other_liquid',
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Ordered least→most certain. Only CONFIRMED increases official Safe to Spend. */
export const INCOME_CONFIDENCE = ['SPECULATIVE', 'VARIABLE', 'HIGHLY_LIKELY', 'CONFIRMED'] as const;
export type IncomeConfidence = (typeof INCOME_CONFIDENCE)[number];

export const FREQUENCIES = [
  'ONE_TIME',
  'WEEKLY',
  'BIWEEKLY',
  'SEMIMONTHLY',
  'MONTHLY',
  'QUARTERLY',
  'ANNUAL',
  'CUSTOM',
] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/**
 * User-entered obligation status. Note: for the Payment Status urgency
 * component, the *effective* status is max-severity of this and the
 * date-derived bucket (see engine). FUTURE / DUE_WITHIN_* are derived, not
 * stored here.
 */
export const OBLIGATION_STATUSES = [
  'CURRENT',
  'DUE_SOON',
  'DUE',
  'OVERDUE',
  'SEVERELY_OVERDUE',
  'PAUSED',
  'IN_DISPUTE',
  'PAYMENT_PLAN',
] as const;
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];

/** Priority buckets used by the Paycheck Plan and priority conflict checks. */
export const PRIORITY_CLASSES = [
  'PROTECT',
  'STABILIZE',
  'BUILD',
  'ENJOY',
  'OPTIONAL_GROWTH',
] as const;
export type PriorityClass = (typeof PRIORITY_CLASSES)[number];

/** Ordered least→most healthy. */
export const FINANCIAL_STAGES = ['CRITICAL', 'STABILIZING', 'STABLE', 'BUILDING_FREEDOM'] as const;
export type FinancialStage = (typeof FINANCIAL_STAGES)[number];

export const DECISION_TYPES = [
  'ONE_TIME',
  'SUBSCRIPTION',
  'PAYMENT_PLAN',
  'LOAN',
  'INCREASE_EXPENSE',
  'RESTART_EXPENSE',
  'OTHER',
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const DECISION_STATES = ['GREEN', 'YELLOW', 'RED'] as const;
export type DecisionState = (typeof DECISION_STATES)[number];

export const GOAL_STATUSES = ['ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'PAUSED', 'COMPLETED'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const PERSONAL_PRIORITIES = [
  'NON_NEGOTIABLE',
  'VERY_IMPORTANT',
  'IMPORTANT',
  'NICE_TO_HAVE',
] as const;
export type PersonalPriority = (typeof PERSONAL_PRIORITIES)[number];

/**
 * Purpose of a proposed purchase (Ask flow) and of subscriptions. Maps to a
 * default PriorityClass for the priority-conflict test.
 */
export const PURPOSES = [
  'ESSENTIAL',
  'FAMILY',
  'BUSINESS',
  'PERSONAL_GROWTH',
  'HEALTH',
  'FUN',
  'OTHER',
] as const;
export type Purpose = (typeof PURPOSES)[number];

/**
 * Fixed keys used to look up an obligation's Goal Alignment urgency component
 * from its category (resolves the "no source field" gap: derived, not asked).
 */
export const GOAL_ALIGNMENT_KEYS = [
  'PROTECTS_STABILITY',
  'INCREASES_PROVEN_INCOME',
  'LEGAL_OR_IMMIGRATION',
  'BUILDS_EMERGENCY_SAVINGS',
  'MONETIZABLE_PRE_REVENUE',
  'SELF_DEVELOPMENT',
  'LIFESTYLE',
] as const;
export type GoalAlignmentKey = (typeof GOAL_ALIGNMENT_KEYS)[number];
