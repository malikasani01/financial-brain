import { describe, expect, it } from 'vitest';
import { reservedForBills } from './reserved.js';
import { evt, funding, makeInput, ob } from './test-fixtures.js';

// today = 2026-07-15 (fixtures CLOCK)
describe('reservedForBills', () => {
  it('sums committed outflows across windows and itemizes them', () => {
    const ledger = reservedForBills(
      makeInput({
        liquidCashCents: 500000,
        events: [
          evt({ date: '2026-07-18', amountCents: -10000, kind: 'OBLIGATION', sourceId: 'a' }), // this week
          evt({ date: '2026-07-28', amountCents: -20000, kind: 'SUBSCRIPTION', sourceId: 'b' }), // before payday
          evt({ date: '2026-08-10', amountCents: -30000, kind: 'OBLIGATION', sourceId: 'c' }), // this month
          evt({ date: '2026-09-20', amountCents: -40000, kind: 'OBLIGATION', sourceId: 'd' }), // horizon only
          // An inflow and a past outflow must both be ignored.
          evt({ date: '2026-07-29', amountCents: 273000, kind: 'INCOME', confidence: 'CONFIRMED', sourceId: 'pay' }),
          evt({ date: '2026-07-01', amountCents: -99900, kind: 'OBLIGATION', sourceId: 'past' }),
        ],
        fundingEvents: [funding('2026-07-29', 273000)],
      }),
    );

    expect(ledger.hasPayday).toBe(true);
    expect(ledger.thisWeekCents).toBe(10000); // only 07-18
    expect(ledger.untilPaydayCents).toBe(30000); // 07-18 + 07-28 (before 07-29)
    expect(ledger.thisMonthCents).toBe(60000); // + 08-10 (within 30 days)
    expect(ledger.horizonCents).toBe(100000); // all four future outflows
    expect(ledger.items.map((i) => i.sourceId)).toEqual(['a', 'b', 'c', 'd']); // sorted, no inflow/past
    expect(ledger.items[0]!.amountCents).toBe(10000); // stored positive
  });

  it('falls back to the horizon window when there is no upcoming paycheck', () => {
    const ledger = reservedForBills(
      makeInput({
        liquidCashCents: 100000,
        events: [evt({ date: '2026-08-01', amountCents: -25000, kind: 'OBLIGATION', sourceId: 'x' })],
        obligations: [ob({ id: 'x' })],
      }),
    );
    expect(ledger.hasPayday).toBe(false);
    expect(ledger.untilPaydayCents).toBe(25000); // no payday => full horizon
    expect(ledger.horizonCents).toBe(25000);
  });
});
