'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { DecisionType, PurchaseInput, Purpose } from '@fb/types';
import { buildEngineInput, recalculateFinancials } from '@fb/data';
import { FORECAST_HORIZON_DAYS, simulatePurchaseDecision } from '@fb/engine';
import { getSessionContext } from '@/lib/session';
import { dollarsToCents, dollarsToCentsOrNull, textOrNull } from '@/lib/money';
import { STEPS } from '@/lib/onboarding';

/** Re-run the deterministic engine and persist a fresh snapshot. */
export async function recalcNow(): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  await recalculateFinancials(supabase, userId, clock);
}

async function insert(table: string, values: Record<string, unknown>): Promise<void> {
  const { supabase, userId } = await getSessionContext();
  const { error } = await supabase.from(table).insert({ ...values, user_id: userId });
  if (error) throw new Error(error.message);
  revalidatePath('/onboarding', 'layout');
  revalidatePath('/', 'layout');
}

/** Soft-delete: archive rather than destroy (financial history is preserved). */
export async function archiveRow(table: string, id: string): Promise<void> {
  const { supabase, userId } = await getSessionContext();
  const { error } = await supabase
    .from(table)
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  revalidatePath('/onboarding', 'layout');
  revalidatePath('/', 'layout');
}

// ---- Onboarding entity adds ------------------------------------------------

export async function addAccount(fd: FormData): Promise<void> {
  await insert('accounts', {
    name: fd.get('name'),
    type: fd.get('type') ?? 'checking',
    balance_cents: dollarsToCents(fd.get('balance')),
  });
}

export async function addIncome(fd: FormData): Promise<void> {
  await insert('income_sources', {
    name: fd.get('name'),
    source_type: fd.get('source_type') ?? 'Employment paycheck',
    net_amount_cents: dollarsToCents(fd.get('amount')),
    frequency: fd.get('frequency') ?? 'BIWEEKLY',
    next_expected_date: textOrNull(fd.get('next_expected_date')),
    confidence: fd.get('confidence') ?? 'CONFIRMED',
  });
}

export async function addObligation(fd: FormData): Promise<void> {
  const status = (fd.get('status') as string) ?? 'CURRENT';
  const behind = status === 'OVERDUE' || status === 'SEVERELY_OVERDUE';
  await insert('obligations', {
    name: fd.get('name'),
    category: fd.get('category') ?? 'Other',
    amount_due_cents: dollarsToCentsOrNull(fd.get('amount_due')),
    minimum_required_cents: dollarsToCentsOrNull(fd.get('minimum_required')),
    due_date: textOrNull(fd.get('due_date')),
    frequency: fd.get('frequency') ?? 'MONTHLY',
    status,
    is_essential: fd.get('is_essential') === 'on',
    is_negotiable: fd.get('is_negotiable') === 'on',
    // "I'm behind" context (only meaningful when behind)
    days_overdue: behind ? Number(fd.get('days_overdue') ?? 0) || null : null,
    total_past_due_cents: behind ? dollarsToCentsOrNull(fd.get('total_past_due')) : null,
    consequence_type: behind ? textOrNull(fd.get('consequence_type')) : null,
    consequence_already_occurring: behind ? fd.get('consequence_occurring') === 'on' : null,
    interest_rate: behind ? Number(fd.get('interest_rate')) || null : null,
  });
}

export async function addLifeCost(fd: FormData): Promise<void> {
  await insert('life_cost_categories', {
    category: fd.get('category') ?? 'Groceries',
    frequency: fd.get('frequency') ?? 'WEEKLY',
    minimum_cents: dollarsToCents(fd.get('minimum')),
    normal_cents: dollarsToCents(fd.get('normal')),
    is_essential: fd.get('is_essential') !== 'off',
  });
}

export async function addSubscription(fd: FormData): Promise<void> {
  await insert('subscriptions', {
    name: fd.get('name'),
    amount_cents: dollarsToCents(fd.get('amount')),
    frequency: fd.get('frequency') ?? 'MONTHLY',
    next_charge_date: textOrNull(fd.get('next_charge_date')),
    purpose: textOrNull(fd.get('purpose')),
    pause_preference: textOrNull(fd.get('pause_preference')),
  });
}

export async function addGoal(fd: FormData): Promise<void> {
  await insert('goals', {
    name: fd.get('name'),
    category: fd.get('category') ?? 'Other',
    target_cents: dollarsToCents(fd.get('target')),
    saved_cents: dollarsToCents(fd.get('saved')),
    target_date: textOrNull(fd.get('target_date')),
    personal_priority: fd.get('personal_priority') ?? 'IMPORTANT',
    committed_per_paycheck_cents: dollarsToCents(fd.get('committed_per_paycheck')),
  });
}

export async function saveFreedom(fd: FormData): Promise<void> {
  const { supabase, userId } = await getSessionContext();
  const { error } = await supabase.from('freedom_plans').upsert({
    user_id: userId,
    monthly_employment_net_cents: dollarsToCentsOrNull(fd.get('employment_net')),
    desired_replacement_cents: dollarsToCentsOrNull(fd.get('desired_replacement')),
    target_date: textOrNull(fd.get('target_date')),
  });
  if (error) throw new Error(error.message);
  const businessRevenue = dollarsToCentsOrNull(fd.get('business_revenue'));
  if (businessRevenue != null && textOrNull(fd.get('business_name'))) {
    await supabase.from('businesses').insert({
      user_id: userId,
      name: fd.get('business_name'),
      monthly_revenue_cents: businessRevenue,
      monthly_opex_cents: dollarsToCents(fd.get('business_opex')),
    });
  }
  revalidatePath('/', 'layout');
}

// ---- Freedom Plan & business scenarios -------------------------------------

/** Upsert the freedom plan and (optionally) the current business income. */
export async function saveFreedomPlan(fd: FormData): Promise<void> {
  const { supabase, userId } = await getSessionContext();
  const { error } = await supabase.from('freedom_plans').upsert({
    user_id: userId,
    monthly_employment_net_cents: dollarsToCentsOrNull(fd.get('employment_net')),
    desired_replacement_cents: dollarsToCentsOrNull(fd.get('desired_replacement')),
    target_date: textOrNull(fd.get('target_date')),
  });
  if (error) throw new Error(error.message);

  const businessRevenue = dollarsToCentsOrNull(fd.get('business_revenue'));
  if (businessRevenue != null) {
    const businessId = await ensureBusiness(supabase, userId);
    await supabase
      .from('businesses')
      .update({ monthly_revenue_cents: businessRevenue })
      .eq('id', businessId)
      .eq('user_id', userId);
  }
  revalidatePath('/freedom');
}

async function ensureBusiness(
  supabase: Awaited<ReturnType<typeof getSessionContext>>['supabase'],
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from('businesses')
    .insert({ user_id: userId, name: 'Saylo', monthly_revenue_cents: 0, monthly_opex_cents: 0 })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/** Add a what-if business scenario (one billing period per scenario). */
export async function addBusinessScenario(fd: FormData): Promise<void> {
  const { supabase, userId } = await getSessionContext();
  const businessId = await ensureBusiness(supabase, userId);

  const period = String(fd.get('price_period') ?? 'monthly');
  const priceCents = dollarsToCentsOrNull(fd.get('price'));

  const { error } = await supabase.from('business_scenarios').insert({
    user_id: userId,
    business_id: businessId,
    label: textOrNull(fd.get('label')),
    weekly_price_cents: period === 'weekly' ? priceCents : null,
    monthly_price_cents: period === 'monthly' ? priceCents : null,
    annual_price_cents: period === 'annual' ? priceCents : null,
    paying_users: Number(fd.get('paying_users')) || 0,
    variable_cost_per_user_cents: dollarsToCents(fd.get('variable_cost')),
    fixed_monthly_cents: dollarsToCents(fd.get('fixed_monthly')),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/freedom');
}

/** Scenarios are speculative models, not financial records — hard delete is fine. */
export async function deleteScenario(id: string): Promise<void> {
  const { supabase, userId } = await getSessionContext();
  await supabase.from('business_scenarios').delete().eq('id', id).eq('user_id', userId);
  revalidatePath('/freedom');
}

// ---- Balances & onboarding progress ---------------------------------------

/** Quick multi-account balance update (§34), then recalc immediately. */
export async function quickUpdateBalances(fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const now = new Date().toISOString();
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith('balance_')) continue;
    const id = key.slice('balance_'.length);
    await supabase
      .from('accounts')
      .update({ balance_cents: dollarsToCents(value), balance_updated_at: now })
      .eq('id', id)
      .eq('user_id', userId);
  }
  await recalculateFinancials(supabase, userId, clock);
  revalidatePath('/', 'layout');
}

// ---- Ask Before I Spend ----------------------------------------------------

/** Run the deterministic decision engine on a proposed purchase, persist it, show the result. */
export async function checkPurchase(fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const input = await buildEngineInput(supabase, userId, clock, FORECAST_HORIZON_DAYS);

  const monthly = dollarsToCentsOrNull(fd.get('monthly_payment'));
  const termRaw = fd.get('term_months');
  const term = termRaw && String(termRaw).trim() !== '' ? Number(termRaw) : null;

  const purchase: PurchaseInput = {
    name: String(fd.get('name') || 'Purchase'),
    amountCents: dollarsToCents(fd.get('amount')),
    type: String(fd.get('decision_type') || 'ONE_TIME') as DecisionType,
    purpose: String(fd.get('purpose') || 'OTHER') as Purpose,
    ...(monthly != null ? { monthlyPaymentCents: monthly } : {}),
    ...(term != null ? { termMonths: term } : {}),
  };

  const result = simulatePurchaseDecision(purchase, input);

  const { data, error } = await supabase
    .from('purchase_decisions')
    .insert({
      user_id: userId,
      name: purchase.name,
      amount_cents: purchase.amountCents,
      decision_type: purchase.type,
      purpose: purchase.purpose,
      monthly_payment_cents: purchase.monthlyPaymentCents ?? null,
      term_months: purchase.termMonths ?? null,
      note: textOrNull(fd.get('note')),
      link: textOrNull(fd.get('link')),
      result_state: result.state,
      result_json: result,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  redirect(`/ask/${(data as { id: string }).id}/result`);
}

/** "Add to my plan" from a decision result: create a planned purchase, recalc. */
export async function addPurchaseToPlan(decisionId: string, buyAnyway: boolean): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const { data: d, error } = await supabase
    .from('purchase_decisions')
    .select('amount_cents,decision_type,monthly_payment_cents,term_months')
    .eq('id', decisionId)
    .eq('user_id', userId)
    .single();
  if (error) throw new Error(error.message);

  const dec = d as {
    amount_cents: number;
    decision_type: string;
    monthly_payment_cents: number | null;
    term_months: number | null;
  };
  const recurring = dec.decision_type !== 'ONE_TIME' && dec.decision_type !== 'OTHER';

  await supabase.from('planned_purchases').insert({
    user_id: userId,
    purchase_decision_id: decisionId,
    amount_cents: recurring ? (dec.monthly_payment_cents ?? dec.amount_cents) : dec.amount_cents,
    planned_date: clock.today,
    frequency: recurring ? 'MONTHLY' : 'ONE_TIME',
    term_months: dec.term_months,
  });
  if (buyAnyway) {
    await supabase
      .from('purchase_decisions')
      .update({ chose_buy_anyway: true })
      .eq('id', decisionId);
  }
  await recalculateFinancials(supabase, userId, clock);
  redirect('/home');
}

export async function setOnboardingStep(step: number): Promise<void> {
  const { supabase, userId } = await getSessionContext();
  await supabase.from('user_preferences').update({ onboarding_step: step }).eq('user_id', userId);
}

/** Mark onboarding finished; the analyzing screen runs the first calculation. */
export async function finishOnboarding(): Promise<void> {
  const { supabase, userId } = await getSessionContext();
  await supabase
    .from('user_preferences')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('user_id', userId);
}

/**
 * Advance the wizard: record progress, then navigate to the next step — or, at
 * the end, mark onboarding complete and hand off to the analyzing screen.
 */
export async function advanceOnboarding(nextIndex: number): Promise<void> {
  const { supabase, userId } = await getSessionContext();
  await supabase
    .from('user_preferences')
    .update({ onboarding_step: nextIndex })
    .eq('user_id', userId);

  if (nextIndex >= STEPS.length) {
    await supabase
      .from('user_preferences')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('user_id', userId);
    redirect('/onboarding/analyzing');
  }
  redirect(`/onboarding/${STEPS[nextIndex]!.slug}`);
}
