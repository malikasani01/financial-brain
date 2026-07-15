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
  archiveAndRecalc,
  markIncomeReceived,
  recordObligationPayment,
  setSubscriptionPaused,
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
