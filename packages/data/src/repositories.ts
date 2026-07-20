/**
 * The ONLY place that reads financial rows from Supabase. Returns raw rows for
 * the pure normalizer to consume. RLS ensures a user sees only their own rows,
 * so every query is implicitly scoped by the authenticated session.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LifeCostOverrideRow, RawFinancialData, TransactionRow } from './rows.js';

/** Columns we select per table (kept explicit so the row types stay honest). */
const SELECTS = {
  accounts: 'id,balance_cents,type,archived_at',
  reservations: 'id,amount_cents,linked_obligation_id,archived_at',
  income: 'id,name,net_amount_cents,frequency,next_expected_date,confidence,paused,archived_at',
  obligations:
    'id,name,category,amount_due_cents,minimum_required_cents,due_date,frequency,status,priority_class,is_essential,is_negotiable,next_expected_payment_date,days_overdue,total_past_due_cents,consequence_type,consequence_already_occurring,consequence_date,interest_rate,late_fee_cents,penalty_cents,resolved,archived_at',
  subscriptions: 'id,name,amount_cents,frequency,next_charge_date,purpose,paused,archived_at',
  lifeCosts:
    'id,category,frequency,minimum_cents,normal_cents,planning_mode,custom_cents,is_essential,archived_at',
  // Fetched separately + resiliently: these columns exist only after migration
  // 0007, so selecting them in the core query would break the whole load first.
  lifeCostBudgets: 'id,budget_mode,monthly_budget_cents',
  goals:
    'id,name,category,target_cents,saved_cents,target_date,personal_priority,committed_per_paycheck_cents,archived_at',
  planned: 'id,amount_cents,planned_date,frequency,term_months,archived_at',
  businesses: 'id,monthly_revenue_cents',
  transactions: 'id,amount_cents,direction,category,txn_date,status,archived_at',
  lifeCostOverrides: 'life_cost_id,override_date,amount_cents',
} as const;

export async function fetchUserFinancialData(
  supabase: SupabaseClient,
  userId: string,
): Promise<RawFinancialData> {
  const q = (table: string, select: string) =>
    supabase.from(table).select(select).eq('user_id', userId);

  const [
    accounts,
    reservations,
    incomeSources,
    obligations,
    subscriptions,
    lifeCosts,
    goals,
    plannedPurchases,
    businesses,
    preferences,
    transactions,
    lifeCostOverrides,
    lifeCostBudgets,
  ] = await Promise.all([
    q('accounts', SELECTS.accounts),
    q('cash_reservations', SELECTS.reservations),
    q('income_sources', SELECTS.income),
    q('obligations', SELECTS.obligations),
    q('subscriptions', SELECTS.subscriptions),
    q('life_cost_categories', SELECTS.lifeCosts),
    q('goals', SELECTS.goals),
    q('planned_purchases', SELECTS.planned),
    q('businesses', SELECTS.businesses),
    supabase
      .from('user_preferences')
      .select('safety_buffer_override_cents')
      .eq('user_id', userId)
      .maybeSingle(),
    // Resilient: absent until migration 0004. A missing table returns an error
    // rather than throwing, and we deliberately do NOT fold it into `err`, so
    // the whole engine view keeps working before transactions exist.
    q('transactions', SELECTS.transactions),
    // Resilient: absent until migration 0006 (one-off life-cost overrides).
    q('life_cost_overrides', SELECTS.lifeCostOverrides),
    // Resilient: budget columns exist only after migration 0007.
    q('life_cost_categories', SELECTS.lifeCostBudgets),
  ]);

  const err =
    accounts.error ??
    reservations.error ??
    incomeSources.error ??
    obligations.error ??
    subscriptions.error ??
    lifeCosts.error ??
    goals.error ??
    plannedPurchases.error ??
    businesses.error ??
    preferences.error;
  if (err) throw new Error(`Failed to load financial data: ${err.message}`);

  // The untyped client returns loose row shapes; cast through unknown. Column
  // selection above keeps these casts honest against the real schema.
  const rows = <K extends keyof RawFinancialData>(data: unknown): RawFinancialData[K] =>
    (data ?? []) as RawFinancialData[K];

  // Merge the resiliently-fetched budget columns into the life-cost rows (empty
  // before migration 0007, so budget mode is simply off).
  const budgetById = new Map(
    (lifeCostBudgets.error ? [] : (lifeCostBudgets.data ?? [])).map((b: unknown) => {
      const r = b as { id: string; budget_mode: boolean | null; monthly_budget_cents: number | null };
      return [r.id, r];
    }),
  );
  const lifeCostRows = rows<'lifeCosts'>(lifeCosts.data).map((r) => {
    const b = budgetById.get(r.id);
    return { ...r, budget_mode: b?.budget_mode ?? false, monthly_budget_cents: b?.monthly_budget_cents ?? null };
  });

  return {
    accounts: rows<'accounts'>(accounts.data),
    reservations: rows<'reservations'>(reservations.data),
    incomeSources: rows<'incomeSources'>(incomeSources.data),
    obligations: rows<'obligations'>(obligations.data),
    subscriptions: rows<'subscriptions'>(subscriptions.data),
    lifeCosts: lifeCostRows,
    goals: rows<'goals'>(goals.data),
    plannedPurchases: rows<'plannedPurchases'>(plannedPurchases.data),
    businesses: rows<'businesses'>(businesses.data),
    preferences: (preferences.data ?? null) as unknown as RawFinancialData['preferences'],
    // If the table isn't there yet (error) or is empty, fall back to [].
    transactions: (transactions.error ? [] : (transactions.data ?? [])) as unknown as TransactionRow[],
    lifeCostOverrides: (lifeCostOverrides.error
      ? []
      : (lifeCostOverrides.data ?? [])) as unknown as LifeCostOverrideRow[],
  };
}
