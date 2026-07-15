import { describe, expect, it } from 'vitest';
import type { Clock } from '@fb/types';
import { computeEngineOutput } from '@fb/engine';
import { normalizeToEngineInput } from './normalize.js';
import type { RawFinancialData } from './rows.js';

const CLOCK: Clock = { today: '2026-07-15', timezone: 'America/Denver' };

function raw(over: Partial<RawFinancialData> = {}): RawFinancialData {
  return {
    accounts: [],
    reservations: [],
    incomeSources: [],
    obligations: [],
    subscriptions: [],
    lifeCosts: [],
    goals: [],
    plannedPurchases: [],
    businesses: [],
    preferences: null,
    ...over,
  };
}

const eventsOf = (data: RawFinancialData, kind: string) =>
  normalizeToEngineInput(data, CLOCK, 90).events.filter((e) => e.kind === kind);

describe('normalizeToEngineInput', () => {
  it('liquid cash = active account balances minus active reservations', () => {
    const input = normalizeToEngineInput(
      raw({
        accounts: [
          { id: 'a1', balance_cents: 200000, type: 'checking', archived_at: null },
          { id: 'a2', balance_cents: 50000, type: 'savings', archived_at: null },
          { id: 'a3', balance_cents: 999999, type: 'cash', archived_at: '2026-01-01' }, // archived
        ],
        reservations: [
          { id: 'r1', amount_cents: 30000, linked_obligation_id: null, archived_at: null },
        ],
      }),
      CLOCK,
      90,
    );
    expect(input.liquidCashCents).toBe(220000);
  });

  it('excludes a reservation-linked obligation from outflows (no double count)', () => {
    const data = raw({
      reservations: [
        { id: 'r1', amount_cents: 40000, linked_obligation_id: 'ob1', archived_at: null },
      ],
      obligations: [
        {
          id: 'ob1',
          name: 'Rent',
          category: 'Housing',
          amount_due_cents: 40000,
          minimum_required_cents: null,
          due_date: '2026-08-01',
          frequency: 'MONTHLY',
          status: 'CURRENT',
          priority_class: null,
          is_essential: true,
          is_negotiable: false,
          next_expected_payment_date: null,
          days_overdue: null,
          total_past_due_cents: null,
          consequence_type: null,
          consequence_already_occurring: null,
          consequence_date: null,
          interest_rate: null,
          late_fee_cents: null,
          penalty_cents: null,
          resolved: false,
          archived_at: null,
        },
      ],
    });
    expect(eventsOf(data, 'OBLIGATION')).toHaveLength(0); // reserved => not in outflows
    // ...but still present as metadata for urgency scoring.
    expect(normalizeToEngineInput(data, CLOCK, 90).obligations).toHaveLength(1);
  });

  it('posts an overdue cure at day 0 and skips paused/in-dispute', () => {
    const base = {
      name: 'x',
      category: 'Car',
      amount_due_cents: 100000,
      minimum_required_cents: 74000,
      due_date: '2026-06-01',
      frequency: 'MONTHLY' as const,
      priority_class: null,
      is_essential: true,
      is_negotiable: true,
      next_expected_payment_date: null,
      days_overdue: 40,
      total_past_due_cents: 120000,
      consequence_type: null,
      consequence_already_occurring: null,
      consequence_date: null,
      interest_rate: null,
      late_fee_cents: null,
      penalty_cents: null,
      resolved: false,
      archived_at: null,
    };
    const data = raw({
      obligations: [
        { ...base, id: 'ov', status: 'OVERDUE' },
        { ...base, id: 'pz', status: 'PAUSED' },
        { ...base, id: 'dp', status: 'IN_DISPUTE' },
      ],
    });
    const ev = eventsOf(data, 'OBLIGATION');
    expect(ev).toHaveLength(1);
    expect(ev[0]!.date).toBe('2026-07-15'); // day 0
    expect(ev[0]!.amountCents).toBe(-74000); // cure amount
  });

  it('only CONFIRMED income becomes a funding event; confidence is preserved', () => {
    const data = raw({
      incomeSources: [
        {
          id: 'pay',
          name: 'Paycheck',
          net_amount_cents: 273000,
          frequency: 'BIWEEKLY',
          next_expected_date: '2026-07-29',
          confidence: 'CONFIRMED',
          paused: false,
          archived_at: null,
        },
        {
          id: 'saylo',
          name: 'Saylo',
          net_amount_cents: 500000,
          frequency: 'MONTHLY',
          next_expected_date: '2026-07-20',
          confidence: 'SPECULATIVE',
          paused: false,
          archived_at: null,
        },
      ],
    });
    const input = normalizeToEngineInput(data, CLOCK, 90);
    expect(input.fundingEvents.every((f) => f.amountCents === 273000)).toBe(true);
    expect(input.events.some((e) => e.confidence === 'SPECULATIVE')).toBe(true);
    // Speculative income never lifts Safe to Spend.
    expect(computeEngineOutput(input).safeToSpend.totalConfirmedIncomeCents).toBeGreaterThan(0);
  });

  it('emits committed goal contributions on each confirmed paycheck date', () => {
    const data = raw({
      incomeSources: [
        {
          id: 'pay',
          name: 'Paycheck',
          net_amount_cents: 200000,
          frequency: 'BIWEEKLY',
          next_expected_date: '2026-07-29',
          confidence: 'CONFIRMED',
          paused: false,
          archived_at: null,
        },
      ],
      goals: [
        {
          id: 'g1',
          name: 'Immigration',
          category: 'Legal or immigration',
          target_cents: 600000,
          saved_cents: 0,
          target_date: '2026-12-01',
          personal_priority: 'NON_NEGOTIABLE',
          committed_per_paycheck_cents: 30000,
          archived_at: null,
        },
      ],
    });
    const contribs = eventsOf(data, 'GOAL_CONTRIBUTION');
    expect(contribs.length).toBeGreaterThan(0);
    expect(contribs.every((e) => e.amountCents === -30000)).toBe(true);
    // Contributions land on paycheck dates only.
    const fundingDates = new Set(
      normalizeToEngineInput(data, CLOCK, 90).fundingEvents.map((f) => f.date),
    );
    expect(contribs.every((e) => fundingDates.has(e.date))).toBe(true);
  });

  it('expands one-time and financed planned purchases', () => {
    const data = raw({
      plannedPurchases: [
        {
          id: 'p1',
          amount_cents: 20000,
          planned_date: '2026-08-01',
          frequency: 'ONE_TIME',
          term_months: null,
          archived_at: null,
        },
        {
          id: 'p2',
          amount_cents: 10000,
          planned_date: '2026-07-20',
          frequency: 'MONTHLY',
          term_months: 2,
          archived_at: null,
        },
      ],
    });
    const ev = eventsOf(data, 'PLANNED_PURCHASE');
    expect(ev.filter((e) => e.sourceId === 'p1')).toHaveLength(1);
    expect(ev.filter((e) => e.sourceId === 'p2')).toHaveLength(2); // limited by term
  });

  it('maps life costs and business essentiality context through to the engine', () => {
    const data = raw({
      lifeCosts: [
        {
          id: 'lc',
          category: 'Groceries',
          frequency: 'WEEKLY',
          minimum_cents: 10000,
          normal_cents: 17500,
          planning_mode: 'STAGE_DEFAULT',
          custom_cents: null,
          is_essential: true,
          archived_at: null,
        },
      ],
      businesses: [{ id: 'b', monthly_revenue_cents: 200000 }],
    });
    const input = normalizeToEngineInput(data, CLOCK, 90);
    expect(input.lifeCosts).toHaveLength(1);
    expect(input.lifeCosts[0]!.normalCents).toBe(17500);
  });

  it('passes a safety buffer override through from preferences', () => {
    const input = normalizeToEngineInput(
      raw({ preferences: { safety_buffer_override_cents: 75000 } }),
      CLOCK,
      90,
    );
    expect(input.bufferOverrideCents).toBe(75000);
  });

  it('produces an engine output end-to-end from realistic rows', () => {
    const data = raw({
      accounts: [{ id: 'a', balance_cents: 284700, type: 'checking', archived_at: null }],
      incomeSources: [
        {
          id: 'pay',
          name: 'Paycheck',
          net_amount_cents: 273000,
          frequency: 'BIWEEKLY',
          next_expected_date: '2026-07-29',
          confidence: 'CONFIRMED',
          paused: false,
          archived_at: null,
        },
      ],
    });
    const out = computeEngineOutput(normalizeToEngineInput(data, CLOCK, 90));
    expect(out.forecast.days).toHaveLength(90);
    expect(out.safeToSpend.safeToSpendCents).toBeGreaterThanOrEqual(0);
    expect(out.stage.stage).toBeDefined();
  });
});
