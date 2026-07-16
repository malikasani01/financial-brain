'use server';

import { revalidatePath } from 'next/cache';
import { recalculateFinancials } from '@fb/data';
import { getSessionContext } from '@/lib/session';
import { dollarsToCents, textOrNull } from '@/lib/money';

type Supa = Awaited<ReturnType<typeof getSessionContext>>['supabase'];

async function adjustAccountBalance(
  supabase: Supa,
  userId: string,
  accountId: string,
  deltaCents: number,
): Promise<void> {
  if (!accountId) return;
  const { data } = await supabase
    .from('accounts')
    .select('balance_cents')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();
  const current = (data?.balance_cents as number | undefined) ?? 0;
  await supabase
    .from('accounts')
    .update({ balance_cents: current + deltaCents, balance_updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .eq('user_id', userId);
}

function refresh(path: string): void {
  revalidatePath(path);
  // '/home' shares (app)/layout.tsx with every real screen (Plan, Obligations,
  // Accounts, ...) — '/' does not, it's a bare redirect page under the root
  // layout only, so revalidating it invalidated nothing those screens read.
  revalidatePath('/home', 'layout');
}

/** Soft-delete an item, then recalculate (used by management screens). */
export async function archiveAndRecalc(table: string, id: string, path: string): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  await supabase
    .from(table)
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  await recalculateFinancials(supabase, userId, clock);
  refresh(path);
}

/** Record actual received income: creates a cash event and raises the account balance (§35). */
export async function markIncomeReceived(fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const amountCents = dollarsToCents(fd.get('amount'));
  const accountId = String(fd.get('account_id') ?? '');
  const sourceId = textOrNull(fd.get('income_source_id'));

  await supabase.from('income_events').insert({
    user_id: userId,
    income_source_id: sourceId,
    amount_cents: amountCents,
    received_date: textOrNull(fd.get('received_date')) ?? clock.today,
    deposited_account_id: accountId || null,
  });
  await adjustAccountBalance(supabase, userId, accountId, amountCents);
  await recalculateFinancials(supabase, userId, clock);
  refresh('/income');
}

/** Record an obligation payment: logs it, lowers the account balance, updates status (§36). */
export async function recordObligationPayment(fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const obligationId = String(fd.get('obligation_id') ?? '');
  const amountCents = dollarsToCents(fd.get('amount'));
  const accountId = String(fd.get('account_id') ?? '');
  const resolved = String(fd.get('resolved') ?? 'NO'); // YES | PARTIAL | NO

  await supabase.from('obligation_payments').insert({
    user_id: userId,
    obligation_id: obligationId,
    amount_cents: amountCents,
    payment_date: textOrNull(fd.get('payment_date')) ?? clock.today,
    account_id: accountId || null,
    resolved_immediate: resolved,
  });
  await adjustAccountBalance(supabase, userId, accountId, -amountCents);
  if (resolved === 'YES') {
    await supabase
      .from('obligations')
      .update({ resolved: true, status: 'CURRENT' })
      .eq('id', obligationId)
      .eq('user_id', userId);
  }
  await recalculateFinancials(supabase, userId, clock);
  refresh('/obligations');
}

export async function markObligationResolved(id: string): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  await supabase
    .from('obligations')
    .update({ resolved: true, status: 'CURRENT' })
    .eq('id', id)
    .eq('user_id', userId);
  await recalculateFinancials(supabase, userId, clock);
  refresh('/obligations');
}

export async function setSubscriptionPaused(id: string, paused: boolean): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  await supabase.from('subscriptions').update({ paused }).eq('id', id).eq('user_id', userId);
  await recalculateFinancials(supabase, userId, clock);
  refresh('/subscriptions');
}

/** Choose which planning amount a life cost uses in the forecast (§38). */
export async function setLifeCostPlanning(fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const id = String(fd.get('id') ?? '');
  const mode = String(fd.get('planning_mode') ?? 'STAGE_DEFAULT');
  await supabase
    .from('life_cost_categories')
    .update({
      planning_mode: mode,
      custom_cents: mode === 'CUSTOM' ? dollarsToCents(fd.get('custom')) : null,
    })
    .eq('id', id)
    .eq('user_id', userId);
  await recalculateFinancials(supabase, userId, clock);
  refresh('/life-costs');
}
