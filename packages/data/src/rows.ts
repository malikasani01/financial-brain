/**
 * Database row shapes (snake_case, mirroring the Supabase schema). These are
 * the raw inputs the normalization layer consumes. Kept hand-written rather
 * than generated so the pure normalizer can be unit-tested without a database.
 */

import type {
  AccountType,
  Frequency,
  IncomeConfidence,
  ObligationStatus,
  PersonalPriority,
  PriorityClass,
} from '@fb/types';

export interface AccountRow {
  id: string;
  balance_cents: number;
  type: AccountType;
  archived_at: string | null;
}

export interface ReservationRow {
  id: string;
  amount_cents: number;
  linked_obligation_id: string | null;
  archived_at: string | null;
}

export interface IncomeSourceRow {
  id: string;
  name: string;
  net_amount_cents: number;
  frequency: Frequency;
  next_expected_date: string | null;
  confidence: IncomeConfidence;
  paused: boolean;
  archived_at: string | null;
}

export interface ObligationRow {
  id: string;
  name: string;
  category: string;
  amount_due_cents: number | null;
  minimum_required_cents: number | null;
  due_date: string | null;
  frequency: Frequency;
  status: ObligationStatus;
  priority_class: PriorityClass | null;
  is_essential: boolean | null;
  is_negotiable: boolean | null;
  next_expected_payment_date: string | null;
  days_overdue: number | null;
  total_past_due_cents: number | null;
  consequence_type: string | null;
  consequence_already_occurring: boolean | null;
  consequence_date: string | null;
  interest_rate: number | null;
  late_fee_cents: number | null;
  penalty_cents: number | null;
  resolved: boolean;
  archived_at: string | null;
}

export interface SubscriptionRow {
  id: string;
  name: string;
  amount_cents: number;
  frequency: Frequency;
  next_charge_date: string | null;
  purpose: string | null;
  paused: boolean;
  archived_at: string | null;
}

export interface LifeCostRow {
  id: string;
  category: string;
  frequency: Frequency;
  minimum_cents: number;
  normal_cents: number;
  planning_mode: 'MIN' | 'NORMAL' | 'CUSTOM' | 'STAGE_DEFAULT';
  custom_cents: number | null;
  is_essential: boolean;
  /** Optional: budget columns exist only after migration 0007. */
  budget_mode?: boolean | null;
  monthly_budget_cents?: number | null;
  archived_at: string | null;
}

export interface GoalRow {
  id: string;
  name: string;
  category: string;
  target_cents: number;
  saved_cents: number;
  target_date: string | null;
  personal_priority: PersonalPriority | null;
  committed_per_paycheck_cents: number;
  archived_at: string | null;
}

export interface PlannedPurchaseRow {
  id: string;
  amount_cents: number;
  planned_date: string;
  frequency: Frequency;
  term_months: number | null;
  archived_at: string | null;
}

export interface BusinessRow {
  id: string;
  monthly_revenue_cents: number;
}

export interface TransactionRow {
  id: string;
  amount_cents: number;
  direction: 'income' | 'expense' | 'transfer';
  category?: string | null;
  txn_date: string;
  status: 'cleared' | 'uncleared' | 'pending' | 'scheduled';
  archived_at: string | null;
}

export interface LifeCostOverrideRow {
  life_cost_id: string;
  override_date: string;
  amount_cents: number;
}

export interface UserPreferencesRow {
  safety_buffer_override_cents: number | null;
}

/** Everything the engine needs, fetched for one user. */
export interface RawFinancialData {
  accounts: AccountRow[];
  reservations: ReservationRow[];
  incomeSources: IncomeSourceRow[];
  obligations: ObligationRow[];
  subscriptions: SubscriptionRow[];
  lifeCosts: LifeCostRow[];
  goals: GoalRow[];
  plannedPurchases: PlannedPurchaseRow[];
  businesses: BusinessRow[];
  preferences: UserPreferencesRow | null;
  /** Optional: absent until migration 0004 is applied (older callers omit it). */
  transactions?: TransactionRow[];
  /** Optional: absent until migration 0006 is applied. One-off life-cost tweaks. */
  lifeCostOverrides?: LifeCostOverrideRow[];
}
