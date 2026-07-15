import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { calculateUrgencyScore } from './urgency.js';
import { makeInput, ob } from './test-fixtures.js';

const input = makeInput();

function score(over: Parameters<typeof ob>[0]): number {
  return calculateUrgencyScore(ob(over), input).score;
}

describe('calculateUrgencyScore — components', () => {
  it('a current, low-stakes obligation scores low', () => {
    expect(
      score({ category: 'Subscriptions', status: 'CURRENT', goalAlignmentKey: 'LIFESTYLE' }),
    ).toBeLessThan(30);
  });

  it('a severely overdue housing obligation scores very high', () => {
    const s = score({
      category: 'Housing',
      status: 'SEVERELY_OVERDUE',
      consequenceType: 'HOUSING_RISK',
      consequenceAlreadyOccurring: true,
      goalAlignmentKey: 'PROTECTS_STABILITY',
      interestRate: 0.3, // high interest => real cost of delay
    });
    expect(s).toBeGreaterThan(90);
  });

  it('effective payment status takes the more severe of user vs date', () => {
    // User says CURRENT, but the due date is 3 days out => DUE_WITHIN_7 dominates.
    const soon = calculateUrgencyScore(
      ob({
        status: 'CURRENT',
        dueDate: '2026-07-18',
        consequenceType: 'LATE_FEE_OR_CREDIT',
        interestRate: 0,
      }),
      input,
    );
    const current = calculateUrgencyScore(
      ob({
        status: 'CURRENT',
        dueDate: null,
        consequenceType: 'LATE_FEE_OR_CREDIT',
        interestRate: 0,
      }),
      input,
    );
    expect(soon.score).toBeGreaterThan(current.score);
  });

  it('applies the days-overdue boost, capped at +20', () => {
    const comp = (days: number) =>
      calculateUrgencyScore(
        ob({
          status: 'OVERDUE',
          daysOverdue: days,
          consequenceType: 'LATE_FEE_OR_CREDIT',
          interestRate: 0,
        }),
        input,
      ).components.find((c) => c.key === 'paymentStatus')!.scoreOrNull;
    expect(comp(0)).toBe(85);
    expect(comp(10)).toBe(90); // +5
    expect(comp(1000)).toBe(100); // capped (85 + 20 = 105 -> clamp 100)
  });

  it('a paused obligation has payment status 0', () => {
    const c = calculateUrgencyScore(ob({ status: 'PAUSED' }), input).components.find(
      (x) => x.key === 'paymentStatus',
    )!;
    expect(c.scoreOrNull).toBe(0);
  });

  it('marks cost-of-delay UNKNOWN when no rate/fee/penalty is known', () => {
    const r = calculateUrgencyScore(
      ob({ status: 'OVERDUE', consequenceType: 'LATE_FEE_OR_CREDIT' }),
      input,
    );
    const cod = r.components.find((c) => c.key === 'costOfDelay')!;
    expect(cod.scoreOrNull).toBeNull();
    expect(r.unknownFactors).toContain('interest, fees, or penalties');
  });

  it('marks consequence UNKNOWN only for overdue items missing a consequence', () => {
    const overdue = calculateUrgencyScore(ob({ status: 'OVERDUE', consequenceType: null }), input);
    expect(overdue.components.find((c) => c.key === 'consequenceSeverity')!.scoreOrNull).toBeNull();

    const current = calculateUrgencyScore(ob({ status: 'CURRENT', consequenceType: null }), input);
    expect(current.components.find((c) => c.key === 'consequenceSeverity')!.scoreOrNull).toBe(0);
  });

  it('buckets cost of delay by interest, penalty, and late fee', () => {
    const cod = (over: Parameters<typeof ob>[0]) =>
      calculateUrgencyScore(ob(over), input).components.find((c) => c.key === 'costOfDelay')!
        .scoreOrNull;
    expect(cod({ interestRate: 0.3 })).toBe(80); // high
    expect(cod({ interestRate: 0.15 })).toBe(60); // moderate
    expect(cod({ interestRate: 0.02 })).toBe(40); // small positive
    expect(cod({ interestRate: 0 })).toBe(0);
    expect(cod({ penaltyCents: 5000 })).toBe(90);
    expect(cod({ lateFeeCents: 500 })).toBe(40);
    expect(cod({ lateFeeCents: 0 })).toBe(0);
  });

  it('interpolates business essentiality by revenue', () => {
    const ess = (rev: number | null) =>
      calculateUrgencyScore(
        ob({ category: 'Business', businessMonthlyRevenueCents: rev }),
        input,
      ).components.find((c) => c.key === 'essentiality')!.scoreOrNull;
    expect(ess(null)).toBe(50); // pre-revenue midpoint
    expect(ess(0)).toBe(50);
    expect(ess(200000)).toBe(90); // saturated
    expect(ess(100000)).toBeCloseTo(77.5, 5); // halfway 65..90
  });

  it('time urgency reflects an already-occurring consequence', () => {
    const t = calculateUrgencyScore(
      ob({ consequenceAlreadyOccurring: true }),
      input,
    ).components.find((c) => c.key === 'timeUrgency')!;
    expect(t.scoreOrNull).toBe(100);
  });

  it('time urgency covers every deadline bucket', () => {
    const tu = (consequenceDate: string | null) =>
      calculateUrgencyScore(ob({ consequenceDate }), input).components.find(
        (c) => c.key === 'timeUrgency',
      )!.scoreOrNull;
    expect(tu('2026-07-13')).toBe(100); // in the past => already occurring
    expect(tu('2026-07-17')).toBe(90); // <=3
    expect(tu('2026-07-21')).toBe(75); // <=7
    expect(tu('2026-07-27')).toBe(60); // <=14
    expect(tu('2026-08-10')).toBe(40); // <=30
    expect(tu('2026-09-15')).toBe(20); // <=90
    expect(tu('2026-12-01')).toBe(0); // >90
    expect(tu(null)).toBe(0); // no deadline
  });

  it('date-derived payment status covers due-within-14 and future', () => {
    const ps = (dueDate: string) =>
      calculateUrgencyScore(ob({ status: 'CURRENT', dueDate }), input).components.find(
        (c) => c.key === 'paymentStatus',
      )!.scoreOrNull;
    expect(ps('2026-07-27')).toBe(40); // 12 days => DUE_WITHIN_14
    expect(ps('2026-09-01')).toBe(20); // >14 => FUTURE (10) but max with CURRENT(20)
  });

  it('derives the overdue boost from the due date when daysOverdue is absent', () => {
    const c = calculateUrgencyScore(
      ob({ status: 'CURRENT', dueDate: '2026-07-05', daysOverdue: null, interestRate: 0 }),
      input,
    ).components.find((x) => x.key === 'paymentStatus')!;
    // 10 days overdue by date => 85 + min(10*0.5,20)=5 => 90.
    expect(c.scoreOrNull).toBe(90);
  });

  it('unknown consequence keys score zero rather than throwing', () => {
    const c = calculateUrgencyScore(ob({ consequenceType: 'MADE_UP_KEY' }), input).components.find(
      (x) => x.key === 'consequenceSeverity',
    )!;
    expect(c.scoreOrNull).toBe(0);
  });

  it('unknown categories fall back to the Other essentiality', () => {
    const c = calculateUrgencyScore(ob({ category: 'Nonexistent' }), input).components.find(
      (x) => x.key === 'essentiality',
    )!;
    expect(c.scoreOrNull).toBe(20); // ESSENTIALITY.Other
  });

  it('a due date of today reads as DUE', () => {
    const c = calculateUrgencyScore(
      ob({ status: 'CURRENT', dueDate: '2026-07-15' }),
      input,
    ).components.find((x) => x.key === 'paymentStatus')!;
    expect(c.scoreOrNull).toBe(75); // DUE
  });

  it('a zero penalty contributes no cost of delay', () => {
    const c = calculateUrgencyScore(ob({ penaltyCents: 0 }), input).components.find(
      (x) => x.key === 'costOfDelay',
    )!;
    expect(c.scoreOrNull).toBe(0);
  });

  it('PROPERTY: score is always an integer in 0..100', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('CURRENT', 'OVERDUE', 'SEVERELY_OVERDUE', 'PAUSED', 'DUE'),
        fc.integer({ min: 0, max: 3000 }),
        fc.option(fc.double({ min: 0, max: 2, noNaN: true }), { nil: null }),
        (status, daysOverdue, interestRate) => {
          const s = calculateUrgencyScore(
            ob({ status: status as never, daysOverdue, interestRate }),
            input,
          ).score;
          expect(Number.isInteger(s)).toBe(true);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(100);
        },
      ),
    );
  });
});
