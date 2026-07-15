'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { recalculateFinancials } from '@fb/data';
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
