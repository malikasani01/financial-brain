import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSupabase, type MockSupabase, type Resolver } from '@/test/supabase-mock';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const getSessionContext = vi.fn();
vi.mock('@/lib/session', () => ({ getSessionContext: () => getSessionContext() }));
const recalculateFinancials = vi.fn();
vi.mock('@fb/data', () => ({
  recalculateFinancials: (...a: unknown[]) => recalculateFinancials(...a),
}));

import {
  addTransaction,
  archiveAndRecalc,
  deleteTransaction,
  markBillPaid,
  markIncomeReceived,
  recordObligationPayment,
  setAccountBalance,
  setSubscriptionPaused,
  toggleTransactionCleared,
} from './manage';

const CLOCK = { today: '2026-07-15', timezone: 'America/Denver' };

/** Accounts read returns a $2,000 starting balance so balance math is checkable. */
const balanceResolver: Resolver = (table, method) => {
  if (table === 'accounts' && method === 'maybeSingle') {
    return { data: { balance_cents: 200000 }, error: null };
  }
  if (method === 'single') return { data: { id: `${table}-id` }, error: null };
  if (method === 'maybeSingle') return { data: null, error: null };
  return { data: [], error: null };
};

function use(mock: MockSupabase) {
  getSessionContext.mockResolvedValue({ supabase: mock.supabase, userId: 'u1', clock: CLOCK });
}

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe('markIncomeReceived', () => {
  it('logs a cash event and raises the deposited account balance', async () => {
    const m = makeSupabase(balanceResolver);
    use(m);
    await markIncomeReceived(
      form({
        income_source_id: 'src1',
        amount: '500',
        account_id: 'a1',
        received_date: '2026-07-16',
      }),
    );

    const event = m.calls.inserts.find((c) => c.table === 'income_events')!.values!;
    expect(event).toMatchObject({
      amount_cents: 50000,
      deposited_account_id: 'a1',
      received_date: '2026-07-16',
    });

    const acct = m.calls.updates.find((u) => u.table === 'accounts')!.values!;
    expect(acct.balance_cents).toBe(250000); // 200000 + 50000
    expect(recalculateFinancials).toHaveBeenCalledOnce();
  });
});

describe('recordObligationPayment', () => {
  it('logs the payment, lowers the account balance, and resolves when YES', async () => {
    const m = makeSupabase(balanceResolver);
    use(m);
    await recordObligationPayment(
      form({ obligation_id: 'ob1', amount: '740', account_id: 'a1', resolved: 'YES' }),
    );

    const pay = m.calls.inserts.find((c) => c.table === 'obligation_payments')!.values!;
    expect(pay).toMatchObject({
      obligation_id: 'ob1',
      amount_cents: 74000,
      resolved_immediate: 'YES',
    });

    const acct = m.calls.updates.find((u) => u.table === 'accounts')!.values!;
    expect(acct.balance_cents).toBe(126000); // 200000 - 74000

    const ob = m.calls.updates.find((u) => u.table === 'obligations')!.values!;
    expect(ob).toMatchObject({ resolved: true, status: 'CURRENT' });
    expect(recalculateFinancials).toHaveBeenCalledOnce();
  });

  it('does not resolve the obligation when the payment was partial', async () => {
    const m = makeSupabase(balanceResolver);
    use(m);
    await recordObligationPayment(
      form({ obligation_id: 'ob1', amount: '100', account_id: 'a1', resolved: 'PARTIAL' }),
    );
    expect(m.calls.updates.some((u) => u.table === 'obligations')).toBe(false);
  });
});

describe('setSubscriptionPaused', () => {
  it('updates the paused flag and recalculates', async () => {
    const m = makeSupabase();
    use(m);
    await setSubscriptionPaused('sub1', true);
    expect(m.calls.updates.find((u) => u.table === 'subscriptions')!.values).toMatchObject({
      paused: true,
    });
    expect(recalculateFinancials).toHaveBeenCalledOnce();
  });
});

describe('archiveAndRecalc', () => {
  it('soft-deletes via archived_at and recalculates', async () => {
    const m = makeSupabase();
    use(m);
    await archiveAndRecalc('subscriptions', 'sub1', '/subscriptions');
    const upd = m.calls.updates.find((u) => u.table === 'subscriptions')!.values!;
    expect(typeof upd.archived_at).toBe('string');
    expect(recalculateFinancials).toHaveBeenCalledOnce();
  });
});

// $2,000 starting balance; a transactions read returns `txn` when provided.
const txnResolver =
  (txn: Record<string, unknown> | null): Resolver =>
  (table, method) => {
    if (table === 'accounts' && method === 'maybeSingle') return { data: { balance_cents: 200000 }, error: null };
    if (table === 'transactions' && method === 'maybeSingle') return { data: txn, error: null };
    if (method === 'single') return { data: { id: `${table}-id` }, error: null };
    if (method === 'maybeSingle') return { data: null, error: null };
    return { data: [], error: null };
  };

const acctUpdates = (m: MockSupabase) =>
  m.calls.updates.filter((u) => u.table === 'accounts').map((u) => u.values!.balance_cents);

describe('addTransaction', () => {
  it('records a cleared expense and lowers the account once', async () => {
    const m = makeSupabase(balanceResolver);
    use(m);
    await addTransaction(
      form({ direction: 'expense', amount: '40', status: 'cleared', account_id: 'a1', txn_date: '2026-07-20' }),
    );
    const txn = m.calls.inserts.find((c) => c.table === 'transactions')!.values!;
    expect(txn).toMatchObject({ direction: 'expense', amount_cents: 4000, status: 'cleared' });
    expect(acctUpdates(m)).toEqual([196000]); // 200,000 - 4,000, applied exactly once
    expect(recalculateFinancials).toHaveBeenCalledOnce();
  });

  it('records an UNCLEARED expense without touching the balance', async () => {
    const m = makeSupabase(balanceResolver);
    use(m);
    await addTransaction(
      form({ direction: 'expense', amount: '40', status: 'uncleared', account_id: 'a1', txn_date: '2026-07-20' }),
    );
    expect(m.calls.inserts.find((c) => c.table === 'transactions')!.values!.status).toBe('uncleared');
    expect(acctUpdates(m)).toEqual([]); // money hasn't moved yet
  });

  it('moves money between accounts on a cleared transfer, netting to zero', async () => {
    const m = makeSupabase(balanceResolver);
    use(m);
    await addTransaction(
      form({ direction: 'transfer', amount: '30', status: 'cleared', account_id: 'a1', transfer_account_id: 'a2' }),
    );
    // a1 -3,000 => 197,000 ; a2 +3,000 => 203,000 (both read 200,000)
    expect(acctUpdates(m).sort()).toEqual([197000, 203000]);
  });
});

describe('toggleTransactionCleared', () => {
  it('applies the balance when clearing, and reverses it when un-clearing', async () => {
    const clearing = makeSupabase(
      txnResolver({ direction: 'expense', amount_cents: 5000, account_id: 'a1', transfer_account_id: null, status: 'uncleared' }),
    );
    use(clearing);
    await toggleTransactionCleared('t1');
    expect(acctUpdates(clearing)).toEqual([195000]); // 200,000 - 5,000
    expect(clearing.calls.updates.find((u) => u.table === 'transactions')!.values!.status).toBe('cleared');

    const unclearing = makeSupabase(
      txnResolver({ direction: 'expense', amount_cents: 5000, account_id: 'a1', transfer_account_id: null, status: 'cleared' }),
    );
    use(unclearing);
    await toggleTransactionCleared('t1');
    expect(acctUpdates(unclearing)).toEqual([205000]); // 200,000 + 5,000 (reversed)
    expect(unclearing.calls.updates.find((u) => u.table === 'transactions')!.values!.status).toBe('uncleared');
  });
});

describe('deleteTransaction', () => {
  it('reverses a cleared expense and archives it', async () => {
    const m = makeSupabase(
      txnResolver({ direction: 'expense', amount_cents: 4000, account_id: 'a1', transfer_account_id: null, status: 'cleared', archived_at: null }),
    );
    use(m);
    await deleteTransaction('t1');
    expect(acctUpdates(m)).toEqual([204000]); // refunded
    expect(typeof m.calls.updates.find((u) => u.table === 'transactions')!.values!.archived_at).toBe('string');
  });
});

const obResolver =
  (ob: Record<string, unknown>): Resolver =>
  (table, method) => {
    if (table === 'accounts' && method === 'maybeSingle') return { data: { balance_cents: 200000 }, error: null };
    if (table === 'obligations' && method === 'maybeSingle') return { data: ob, error: null };
    if (method === 'single') return { data: { id: `${table}-id` }, error: null };
    if (method === 'maybeSingle') return { data: null, error: null };
    return { data: [], error: null };
  };

describe('markBillPaid', () => {
  it('lowers the balance and advances a recurring bill to its next occurrence (no double-count)', async () => {
    const m = makeSupabase(
      obResolver({ amount_due_cents: 50000, minimum_required_cents: null, status: 'CURRENT', frequency: 'MONTHLY', next_expected_payment_date: '2026-08-01', due_date: null }),
    );
    use(m);
    await markBillPaid('ob1', form({ account_id: 'a1' }));
    expect(acctUpdates(m)).toEqual([150000]); // 200,000 - 50,000
    const ob = m.calls.updates.find((u) => u.table === 'obligations')!.values!;
    expect(ob.next_expected_payment_date).toBe('2026-09-01'); // advanced one month
    expect(ob.resolved).toBeUndefined(); // recurring bill is NOT resolved
    expect(m.calls.inserts.some((c) => c.table === 'obligation_payments')).toBe(true);
  });

  it('resolves a one-time bill instead of advancing it', async () => {
    const m = makeSupabase(
      obResolver({ amount_due_cents: 20000, minimum_required_cents: null, status: 'CURRENT', frequency: 'ONE_TIME', next_expected_payment_date: null, due_date: '2026-08-01' }),
    );
    use(m);
    await markBillPaid('ob1', form({ account_id: 'a1' }));
    expect(acctUpdates(m)).toEqual([180000]);
    expect(m.calls.updates.find((u) => u.table === 'obligations')!.values).toMatchObject({ resolved: true, status: 'CURRENT' });
  });
});

describe('setAccountBalance', () => {
  it('sets the balance outright and recalculates', async () => {
    const m = makeSupabase(balanceResolver);
    use(m);
    await setAccountBalance(form({ account_id: 'a1', balance: '250' }));
    expect(m.calls.updates.find((u) => u.table === 'accounts')!.values!.balance_cents).toBe(25000);
    expect(recalculateFinancials).toHaveBeenCalledOnce();
  });
});
