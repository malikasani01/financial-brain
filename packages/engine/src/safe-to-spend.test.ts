import { describe, expect, it } from 'vitest';
import { calculateSafeToSpend } from './safe-to-spend.js';
import { evt, funding, makeInput } from './test-fixtures.js';

/**
 * GOLDEN FIXTURE — the spec's headline example.
 * $2,847 available; $2,164 needed by Aug 12; $500 buffer => $183 safe to spend.
 */
describe('Safe to Spend — golden $183 fixture', () => {
  const input = makeInput({
    liquidCashCents: 284700,
    bufferOverrideCents: 50000,
    events: [
      evt({ date: '2026-08-12', amountCents: -216400, kind: 'OBLIGATION', isEssential: true }),
    ],
    fundingEvents: [funding('2026-07-29', 273000)],
  });
  const r = calculateSafeToSpend(input);

  it('computes $183 safe to spend', () => {
    expect(r.safeToSpendCents).toBe(18300);
  });
  it('finds the $683 low on Aug 12', () => {
    expect(r.lowestProjectedCashCents).toBe(68300);
    expect(r.lowestCashDate).toBe('2026-08-12');
  });
  it('reports the buffer and breakdown', () => {
    expect(r.safetyBufferCents).toBe(50000);
    expect(r.rawHeadroomCents).toBe(18300);
    expect(r.currentLiquidCashCents).toBe(284700);
    expect(r.totalRequiredObligationsCents).toBe(216400);
  });
  it('spreads daily flexibility across days until the next paycheck', () => {
    expect(r.daysUntilNextFundingEvent).toBe(14);
    expect(r.dailyFlexibilityCents).toBe(Math.floor(18300 / 14));
  });
});

describe('Safe to Spend — edge cases', () => {
  it('floors at zero when underwater, but raw headroom stays negative', () => {
    const r = calculateSafeToSpend(
      makeInput({ liquidCashCents: 10000, bufferOverrideCents: 50000 }),
    );
    expect(r.safeToSpendCents).toBe(0);
    expect(r.rawHeadroomCents).toBe(-40000);
  });

  it('has null daily flexibility when there is no upcoming funding event', () => {
    const r = calculateSafeToSpend(makeInput({ liquidCashCents: 100000, bufferOverrideCents: 0 }));
    expect(r.dailyFlexibilityCents).toBeNull();
    expect(r.daysUntilNextFundingEvent).toBeNull();
  });

  it('ignores non-confirmed income in the conservative number', () => {
    const withSpeculative = calculateSafeToSpend(
      makeInput({
        liquidCashCents: 100000,
        bufferOverrideCents: 0,
        events: [
          evt({
            kind: 'INCOME',
            amountCents: 500000,
            confidence: 'SPECULATIVE',
            date: '2026-07-20',
          }),
        ],
      }),
    );
    expect(withSpeculative.safeToSpendCents).toBe(100000); // speculative income excluded
    expect(withSpeculative.totalConfirmedIncomeCents).toBe(0);
  });
});
