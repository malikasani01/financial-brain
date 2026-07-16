import { describe, expect, it } from 'vitest';
import { buildPaycheckLedger } from './ledger.js';
import { evt, makeInput } from './test-fixtures.js';

describe('buildPaycheckLedger', () => {
  it('groups outflows under the income that precedes them, carrying a running balance', () => {
    const ledger = buildPaycheckLedger(
      makeInput({
        liquidCashCents: 100000, // $1,000 on hand
        bufferOverrideCents: 20000, // $200 buffer
        events: [
          // A bill before the first paycheck draws down cash on hand.
          evt({ date: '2026-07-16', amountCents: -10000, kind: 'OBLIGATION', sourceId: 'early' }),
          // Paycheck + child support land the same day -> one "Available".
          evt({
            date: '2026-07-20',
            amountCents: 300000,
            kind: 'INCOME',
            sourceId: 'pay',
            confidence: 'CONFIRMED',
          }),
          evt({
            date: '2026-07-20',
            amountCents: 24000,
            kind: 'INCOME',
            sourceId: 'cs',
            confidence: 'CONFIRMED',
          }),
          // A big bill dips below buffer but stays positive...
          evt({ date: '2026-07-25', amountCents: -400000, kind: 'OBLIGATION', sourceId: 'big' }),
          // ...then the next bill pushes it negative.
          evt({ date: '2026-07-28', amountCents: -30000, kind: 'OBLIGATION', sourceId: 'small' }),
        ],
      }),
    );

    expect(ledger.safetyBufferCents).toBe(20000);
    expect(ledger.periods).toHaveLength(2);

    const [onHand, paycheck] = ledger.periods;

    // Leading "cash on hand" block.
    expect(onHand!.incomeDate).toBeNull();
    expect(onHand!.openingCents).toBe(100000);
    expect(onHand!.availableCents).toBe(100000);
    expect(onHand!.lines).toHaveLength(1);
    expect(onHand!.lines[0]).toMatchObject({
      sourceId: 'early',
      runningCents: 90000,
      belowBuffer: false,
      negative: false,
    });
    expect(onHand!.endingCents).toBe(90000);

    // Paycheck period: same-day incomes merged into Available.
    expect(paycheck!.incomeDate).toBe('2026-07-20');
    expect(paycheck!.incomeSourceIds).toEqual(['pay', 'cs']);
    expect(paycheck!.incomeAmountCents).toBe(324000);
    expect(paycheck!.openingCents).toBe(90000);
    expect(paycheck!.availableCents).toBe(414000); // 90,000 + 324,000

    expect(paycheck!.lines[0]).toMatchObject({
      sourceId: 'big',
      runningCents: 14000, // below the $200 buffer, still positive
      belowBuffer: true,
      negative: false,
    });
    expect(paycheck!.lines[1]).toMatchObject({
      sourceId: 'small',
      runningCents: -16000,
      belowBuffer: true,
      negative: true,
    });
    expect(paycheck!.endingCents).toBe(-16000);
    expect(paycheck!.lowestCents).toBe(-16000);
    expect(ledger.lowestCents).toBe(-16000);
  });

  it('drops the empty leading block when income lands before any expense', () => {
    const ledger = buildPaycheckLedger(
      makeInput({
        liquidCashCents: 50000,
        bufferOverrideCents: 0,
        events: [
          evt({
            date: '2026-07-15',
            amountCents: 200000,
            kind: 'INCOME',
            sourceId: 'pay',
            confidence: 'CONFIRMED',
          }),
          evt({ date: '2026-07-16', amountCents: -30000, kind: 'OBLIGATION', sourceId: 'rent' }),
        ],
      }),
    );

    expect(ledger.periods).toHaveLength(1);
    const p = ledger.periods[0]!;
    expect(p.incomeDate).toBe('2026-07-15');
    expect(p.openingCents).toBe(50000); // cash on hand carried in
    expect(p.availableCents).toBe(250000);
    expect(p.lines).toHaveLength(1);
    expect(p.lines[0]).toMatchObject({ sourceId: 'rent', runningCents: 220000 });
  });

  it('handles a horizon with no income as a single on-hand block', () => {
    const ledger = buildPaycheckLedger(
      makeInput({
        liquidCashCents: 40000,
        bufferOverrideCents: 10000,
        events: [
          evt({ date: '2026-07-18', amountCents: -15000, kind: 'OBLIGATION', sourceId: 'a' }),
        ],
      }),
    );

    expect(ledger.periods).toHaveLength(1);
    expect(ledger.periods[0]!.incomeDate).toBeNull();
    expect(ledger.periods[0]!.lines[0]!.runningCents).toBe(25000);
    expect(ledger.lowestCents).toBe(25000);
  });
});
