import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineInput } from '@fb/types';
import { makeSupabase, type MockSupabase } from '@/test/supabase-mock';

// ---- Mocks (hoisted) -------------------------------------------------------
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));

const getSessionContext = vi.fn();
vi.mock('@/lib/session', () => ({ getSessionContext: () => getSessionContext() }));

const buildEngineInput = vi.fn();
const recalculateFinancials = vi.fn();
vi.mock('@fb/data', () => ({
  buildEngineInput: (...a: unknown[]) => buildEngineInput(...a),
  recalculateFinancials: (...a: unknown[]) => recalculateFinancials(...a),
}));

import {
  addAccount,
  addObligation,
  addBusinessScenario,
  checkPurchase,
  quickUpdateBalances,
  updateIncome,
  updateObligation,
} from './financial';

const CLOCK = { today: '2026-07-15', timezone: 'America/Denver' };

function useSupabase(mock: MockSupabase) {
  getSessionContext.mockResolvedValue({ supabase: mock.supabase, userId: 'u1', clock: CLOCK });
}

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe('addAccount', () => {
  it('inserts an account with dollars converted to cents and the user id', async () => {
    const m = makeSupabase();
    useSupabase(m);
    await addAccount(form({ name: 'Checking', type: 'checking', balance: '2,847.00' }));
    expect(m.calls.inserts).toHaveLength(1);
    expect(m.calls.inserts[0]).toMatchObject({
      table: 'accounts',
      values: { name: 'Checking', type: 'checking', balance_cents: 284700, user_id: 'u1' },
    });
  });
});

describe('addObligation', () => {
  it('maps a current obligation without behind-context fields', async () => {
    const m = makeSupabase();
    useSupabase(m);
    await addObligation(
      form({
        name: 'Rent',
        category: 'Housing',
        amount_due: '1200',
        status: 'CURRENT',
        is_essential: 'on',
      }),
    );
    const v = m.calls.inserts[0]!.values!;
    expect(v).toMatchObject({
      name: 'Rent',
      amount_due_cents: 120000,
      status: 'CURRENT',
      is_essential: true,
    });
    // Not behind => behind context stays null, never fabricated.
    expect(v.days_overdue).toBeNull();
    expect(v.consequence_type).toBeNull();
    expect(v.consequence_already_occurring).toBeNull();
  });

  it('captures behind-context only when overdue', async () => {
    const m = makeSupabase();
    useSupabase(m);
    await addObligation(
      form({
        name: 'Car',
        category: 'Car',
        minimum_required: '740',
        status: 'OVERDUE',
        days_overdue: '40',
        total_past_due: '1200',
        consequence_type: 'VEHICLE_REPOSSESSION',
        consequence_occurring: 'on',
        interest_rate: '0.24',
      }),
    );
    const v = m.calls.inserts[0]!.values!;
    expect(v).toMatchObject({
      status: 'OVERDUE',
      minimum_required_cents: 74000,
      days_overdue: 40,
      total_past_due_cents: 120000,
      consequence_type: 'VEHICLE_REPOSSESSION',
      consequence_already_occurring: true,
      interest_rate: 0.24,
    });
  });
});

describe('addBusinessScenario', () => {
  it('routes the price into the column for the chosen billing period', async () => {
    // No existing business => ensureBusiness inserts one, then the scenario.
    const m = makeSupabase();
    useSupabase(m);
    await addBusinessScenario(
      form({
        label: 'A',
        price: '6.99',
        price_period: 'weekly',
        paying_users: '50',
        variable_cost: '0.50',
        fixed_monthly: '0',
      }),
    );
    const scenario = m.calls.inserts.find((c) => c.table === 'business_scenarios')!.values!;
    expect(scenario).toMatchObject({
      label: 'A',
      weekly_price_cents: 699,
      monthly_price_cents: null,
      annual_price_cents: null,
      paying_users: 50,
      variable_cost_per_user_cents: 50,
    });
    expect(m.calls.inserts.some((c) => c.table === 'businesses')).toBe(true); // ensured a business
  });
});

describe('quickUpdateBalances', () => {
  it('updates each balance_<id> field and recalculates', async () => {
    const m = makeSupabase();
    useSupabase(m);
    await quickUpdateBalances(form({ balance_a1: '100', balance_a2: '250.50', other: 'ignore' }));
    const updated = m.calls.updates.filter((u) => u.table === 'accounts');
    expect(updated).toHaveLength(2);
    expect(updated.map((u) => u.values!.balance_cents).sort()).toEqual([10000, 25050]);
    expect(recalculateFinancials).toHaveBeenCalledOnce();
  });
});

describe('updateObligation', () => {
  it('updates the row (dollars to cents) and recalculates', async () => {
    const m = makeSupabase();
    useSupabase(m);
    await updateObligation(
      'ob1',
      form({ name: 'Rent', category: 'Housing', amount_due: '1300', status: 'CURRENT', is_essential: 'on' }),
    );
    const u = m.calls.updates.find((x) => x.table === 'obligations')!;
    expect(u.values).toMatchObject({
      name: 'Rent',
      amount_due_cents: 130000,
      status: 'CURRENT',
      is_essential: true,
    });
    // Not behind => context stays null, never fabricated on edit either.
    expect(u.values!.days_overdue).toBeNull();
    expect(recalculateFinancials).toHaveBeenCalledOnce();
  });
});

describe('updateIncome', () => {
  it('persists the edited reliability so it flows back into the forecast', async () => {
    const m = makeSupabase();
    useSupabase(m);
    await updateIncome(
      'inc1',
      form({ name: 'Rental', amount: '900', frequency: 'MONTHLY', confidence: 'CONFIRMED' }),
    );
    const u = m.calls.updates.find((x) => x.table === 'income_sources')!;
    expect(u.values).toMatchObject({
      name: 'Rental',
      net_amount_cents: 90000,
      frequency: 'MONTHLY',
      confidence: 'CONFIRMED',
    });
    expect(recalculateFinancials).toHaveBeenCalledOnce();
  });
});

describe('checkPurchase', () => {
  it('builds a PurchaseInput, persists the decision, and redirects to the result', async () => {
    const m = makeSupabase();
    useSupabase(m);
    const input: EngineInput = {
      clock: CLOCK,
      horizonDays: 90,
      liquidCashCents: 100000,
      events: [],
      lifeCosts: [],
      obligations: [],
      goals: [],
      fundingEvents: [],
      bufferOverrideCents: 0,
    };
    buildEngineInput.mockResolvedValue(input);

    await expect(
      checkPurchase(
        form({ name: 'Book', amount: '10', decision_type: 'ONE_TIME', purpose: 'FUN' }),
      ),
    ).rejects.toThrow(/^REDIRECT:\/ask\/purchase_decisions-id\/result$/);

    const decision = m.calls.inserts.find((c) => c.table === 'purchase_decisions')!.values!;
    expect(decision).toMatchObject({
      name: 'Book',
      amount_cents: 1000,
      decision_type: 'ONE_TIME',
      purpose: 'FUN',
      result_state: 'GREEN', // $10 against $100k cash is safe
    });
    // Financed fields omitted for a one-time buy (exactOptionalPropertyTypes).
    expect(decision.monthly_payment_cents).toBeNull();
  });
});
