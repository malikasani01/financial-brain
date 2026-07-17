'use server';

import { revalidatePath } from 'next/cache';
import { addDays, addMonths } from '@fb/engine';
import { recalculateFinancials } from '@fb/data';
import { getSessionContext } from '@/lib/session';
import { dollarsToCents, dollarsToCentsOrNull, textOrNull } from '@/lib/money';

/** The next occurrence date after `anchor` for a recurring frequency. */
function nextOccurrence(anchor: string, frequency: string): string {
  switch (frequency) {
    case 'WEEKLY':
      return addDays(anchor, 7);
    case 'BIWEEKLY':
      return addDays(anchor, 14);
    case 'SEMIMONTHLY':
      return addDays(anchor, 15);
    case 'QUARTERLY':
      return addMonths(anchor, 3);
    case 'ANNUAL':
      return addMonths(anchor, 12);
    default:
      return addMonths(anchor, 1); // MONTHLY
  }
}

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

/**
 * Record a day-to-day expense the user already incurred. The money is gone, so
 * we lower the chosen account's balance immediately — that is what flows into
 * the engine (Safe to Spend derives from account balances). We also log the
 * expense so it can be listed and undone; that log is best-effort so the
 * feature still lowers cash even before the spending_entries migration is run.
 */
export async function addExpense(fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const amountCents = dollarsToCents(fd.get('amount'));
  if (amountCents <= 0) return;
  const accountId = String(fd.get('account_id') ?? '');
  const spentDate = textOrNull(fd.get('spent_date')) ?? clock.today;

  await adjustAccountBalance(supabase, userId, accountId, -amountCents);
  // Best-effort log: if the table isn't there yet, Supabase returns an error
  // rather than throwing, so the cash adjustment above still stands.
  await supabase.from('spending_entries').insert({
    user_id: userId,
    amount_cents: amountCents,
    description: textOrNull(fd.get('description')),
    spent_date: spentDate,
    account_id: accountId || null,
  });
  await recalculateFinancials(supabase, userId, clock);
  refresh('/home');
}

/** Undo a logged expense: restore the money to its account and archive it. */
export async function removeExpense(id: string): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const { data } = await supabase
    .from('spending_entries')
    .select('amount_cents,account_id,archived_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  const row = data as
    | { amount_cents: number; account_id: string | null; archived_at: string | null }
    | null;
  // Only reverse an entry that is still active, so a double-tap can't refund twice.
  if (!row || row.archived_at) return;

  if (row.account_id) {
    await adjustAccountBalance(supabase, userId, row.account_id, row.amount_cents);
  }
  await supabase
    .from('spending_entries')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  await recalculateFinancials(supabase, userId, clock);
  refresh('/home');
}

// ---- Transactions ----------------------------------------------------------

interface TxnMoney {
  direction: string;
  amount_cents: number;
  account_id: string | null;
  transfer_account_id: string | null;
}

/**
 * Apply (sign +1) or reverse (sign -1) a transaction's effect on balances.
 * Only called for CLEARED transactions — uncleared ones don't move money yet.
 * Expense lowers the account; income raises it; a transfer moves between the
 * two named accounts (net zero across total cash).
 */
async function moveBalance(
  supabase: Supa,
  userId: string,
  t: TxnMoney,
  sign: 1 | -1,
): Promise<void> {
  const amt = t.amount_cents * sign;
  if (t.direction === 'income') {
    await adjustAccountBalance(supabase, userId, t.account_id ?? '', amt);
  } else if (t.direction === 'transfer') {
    await adjustAccountBalance(supabase, userId, t.account_id ?? '', -amt);
    await adjustAccountBalance(supabase, userId, t.transfer_account_id ?? '', amt);
  } else {
    await adjustAccountBalance(supabase, userId, t.account_id ?? '', -amt);
  }
}

/** Record a transaction. Cleared ones adjust the balance immediately. */
export async function addTransaction(fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const amountCents = dollarsToCents(fd.get('amount'));
  if (amountCents <= 0) return;

  const direction = String(fd.get('direction') ?? 'expense');
  const status = String(fd.get('status') ?? 'cleared');
  const accountId = String(fd.get('account_id') ?? '') || null;
  const transferAccountId =
    direction === 'transfer' ? String(fd.get('transfer_account_id') ?? '') || null : null;
  const txnDate = textOrNull(fd.get('txn_date')) ?? clock.today;

  const { error } = await supabase.from('transactions').insert({
    user_id: userId,
    name: textOrNull(fd.get('name')),
    amount_cents: amountCents,
    direction,
    category: textOrNull(fd.get('category')),
    account_id: accountId,
    transfer_account_id: transferAccountId,
    txn_date: txnDate,
    status,
    cleared_date: status === 'cleared' ? txnDate : null,
    note: textOrNull(fd.get('note')),
  });
  if (error) return; // table not migrated yet — don't touch balances

  if (status === 'cleared') {
    await moveBalance(
      supabase,
      userId,
      { direction, amount_cents: amountCents, account_id: accountId, transfer_account_id: transferAccountId },
      1,
    );
  }
  await recalculateFinancials(supabase, userId, clock);
  refresh('/home');
}

/** Flip a transaction between cleared and uncleared, moving the balance to match. */
export async function toggleTransactionCleared(id: string): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const { data } = await supabase
    .from('transactions')
    .select('direction,amount_cents,account_id,transfer_account_id,status')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  const row = data as (TxnMoney & { status: string }) | null;
  if (!row) return;

  const nowCleared = row.status !== 'cleared';
  await moveBalance(supabase, userId, row, nowCleared ? 1 : -1);
  await supabase
    .from('transactions')
    .update({
      status: nowCleared ? 'cleared' : 'uncleared',
      cleared_date: nowCleared ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq('id', id)
    .eq('user_id', userId);
  await recalculateFinancials(supabase, userId, clock);
  refresh('/home');
}

/** Edit a transaction, reconciling any balance change (reverse old, apply new). */
export async function editTransaction(id: string, fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const { data } = await supabase
    .from('transactions')
    .select('direction,amount_cents,account_id,transfer_account_id,status,txn_date')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  const old = data as (TxnMoney & { status: string }) | null;
  if (!old) return;

  const amountCents = dollarsToCents(fd.get('amount'));
  if (amountCents <= 0) return;
  const direction = String(fd.get('direction') ?? old.direction);
  const status = String(fd.get('status') ?? old.status);
  const accountId = String(fd.get('account_id') ?? '') || null;
  const transferAccountId =
    direction === 'transfer' ? String(fd.get('transfer_account_id') ?? '') || null : null;
  const txnDate = textOrNull(fd.get('txn_date')) ?? clock.today;

  if (old.status === 'cleared') await moveBalance(supabase, userId, old, -1);

  await supabase
    .from('transactions')
    .update({
      name: textOrNull(fd.get('name')),
      amount_cents: amountCents,
      direction,
      category: textOrNull(fd.get('category')),
      account_id: accountId,
      transfer_account_id: transferAccountId,
      txn_date: txnDate,
      status,
      cleared_date: status === 'cleared' ? txnDate : null,
      note: textOrNull(fd.get('note')),
    })
    .eq('id', id)
    .eq('user_id', userId);

  if (status === 'cleared') {
    await moveBalance(
      supabase,
      userId,
      { direction, amount_cents: amountCents, account_id: accountId, transfer_account_id: transferAccountId },
      1,
    );
  }
  await recalculateFinancials(supabase, userId, clock);
  refresh('/home');
}

/** Delete a transaction, reversing its balance effect if it was cleared. */
export async function deleteTransaction(id: string): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const { data } = await supabase
    .from('transactions')
    .select('direction,amount_cents,account_id,transfer_account_id,status,archived_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  const row = data as (TxnMoney & { status: string; archived_at: string | null }) | null;
  if (!row || row.archived_at) return;

  if (row.status === 'cleared') await moveBalance(supabase, userId, row, -1);
  await supabase
    .from('transactions')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  await recalculateFinancials(supabase, userId, clock);
  refresh('/home');
}

/**
 * Log money actually moved to savings toward a goal. It counts toward the goal
 * (raises saved, lowering how much is still needed) and leaves the chosen
 * account (lowering available cash), so the next savings recommendation is
 * reduced accordingly. Also records a contribution for history.
 */
export async function saveToGoal(fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const goalId = String(fd.get('goal_id') ?? '');
  const amountCents = dollarsToCents(fd.get('amount'));
  if (!goalId || amountCents <= 0) return;
  const accountId = String(fd.get('account_id') ?? '');

  const { data } = await supabase
    .from('goals')
    .select('saved_cents')
    .eq('id', goalId)
    .eq('user_id', userId)
    .maybeSingle();
  const saved = (data?.saved_cents as number | undefined) ?? 0;
  await supabase
    .from('goals')
    .update({ saved_cents: saved + amountCents })
    .eq('id', goalId)
    .eq('user_id', userId);

  if (accountId) await adjustAccountBalance(supabase, userId, accountId, -amountCents);

  await supabase.from('goal_contributions').insert({
    user_id: userId,
    goal_id: goalId,
    amount_cents: amountCents,
    contribution_date: clock.today,
  });
  await recalculateFinancials(supabase, userId, clock);
  refresh('/home');
}

/** Set an account's balance outright (Quick Add → Update bank balance). */
export async function setAccountBalance(fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const accountId = String(fd.get('account_id') ?? '');
  if (!accountId) return;
  await supabase
    .from('accounts')
    .update({ balance_cents: dollarsToCents(fd.get('balance')), balance_updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .eq('user_id', userId);
  await recalculateFinancials(supabase, userId, clock);
  refresh('/home');
}

// ---- Editing & clearing bills straight from the ledger ---------------------

/** Quick-edit a bill's amount and due date (leaves its other settings alone). */
export async function updateBillAmountDate(id: string, fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const date = textOrNull(fd.get('date'));
  await supabase
    .from('obligations')
    .update({
      amount_due_cents: dollarsToCentsOrNull(fd.get('amount')),
      due_date: date,
      // Make the edited date authoritative for where it lands in the forecast.
      next_expected_payment_date: date,
    })
    .eq('id', id)
    .eq('user_id', userId);
  await recalculateFinancials(supabase, userId, clock);
  refresh('/home');
}

/**
 * Mark a bill occurrence paid: lower the account, log the payment, and move the
 * bill past this occurrence — advance a recurring bill to its next date, or
 * resolve a one-time/overdue one — so the forecast never counts it twice.
 */
export async function markBillPaid(id: string, fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const { data } = await supabase
    .from('obligations')
    .select('amount_due_cents,minimum_required_cents,status,frequency,next_expected_payment_date,due_date')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  const ob = data as
    | {
        amount_due_cents: number | null;
        minimum_required_cents: number | null;
        status: string;
        frequency: string;
        next_expected_payment_date: string | null;
        due_date: string | null;
      }
    | null;
  if (!ob) return;

  const overdue = ob.status === 'OVERDUE' || ob.status === 'SEVERELY_OVERDUE';
  const amount = overdue
    ? (ob.minimum_required_cents ?? ob.amount_due_cents ?? 0)
    : (ob.amount_due_cents ?? ob.minimum_required_cents ?? 0);
  const accountId = String(fd.get('account_id') ?? '');

  if (accountId) await adjustAccountBalance(supabase, userId, accountId, -amount);
  await supabase.from('obligation_payments').insert({
    user_id: userId,
    obligation_id: id,
    amount_cents: amount,
    payment_date: clock.today,
    account_id: accountId || null,
    resolved_immediate: 'YES',
  });

  if (ob.frequency === 'ONE_TIME' || overdue) {
    await supabase.from('obligations').update({ resolved: true, status: 'CURRENT' }).eq('id', id).eq('user_id', userId);
  } else {
    const anchor = ob.next_expected_payment_date ?? ob.due_date ?? clock.today;
    await supabase
      .from('obligations')
      .update({ next_expected_payment_date: nextOccurrence(anchor, ob.frequency) })
      .eq('id', id)
      .eq('user_id', userId);
  }
  await recalculateFinancials(supabase, userId, clock);
  refresh('/home');
}

/** Quick-edit a subscription's amount and next charge date. */
export async function updateSubscriptionAmountDate(id: string, fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  await supabase
    .from('subscriptions')
    .update({
      amount_cents: dollarsToCents(fd.get('amount')),
      next_charge_date: textOrNull(fd.get('date')),
    })
    .eq('id', id)
    .eq('user_id', userId);
  await recalculateFinancials(supabase, userId, clock);
  refresh('/home');
}

/** Mark a subscription charge as cleared: lower the account, advance the schedule. */
export async function markSubscriptionPaid(id: string, fd: FormData): Promise<void> {
  const { supabase, userId, clock } = await getSessionContext();
  const { data } = await supabase
    .from('subscriptions')
    .select('amount_cents,frequency,next_charge_date')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  const sub = data as { amount_cents: number; frequency: string; next_charge_date: string | null } | null;
  if (!sub) return;

  const accountId = String(fd.get('account_id') ?? '');
  if (accountId) await adjustAccountBalance(supabase, userId, accountId, -sub.amount_cents);
  const anchor = sub.next_charge_date ?? clock.today;
  await supabase
    .from('subscriptions')
    .update({ next_charge_date: nextOccurrence(anchor, sub.frequency) })
    .eq('id', id)
    .eq('user_id', userId);
  await recalculateFinancials(supabase, userId, clock);
  refresh('/home');
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
