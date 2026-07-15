import { describe, expect, it } from 'vitest';
import { maxAffordable } from './max-affordable.js';
import { simulatePurchaseDecision } from './purchase.js';
import { makeInput, ob } from './test-fixtures.js';

describe('maxAffordable', () => {
  it('is zero when nothing is safe to spend', () => {
    const input = makeInput({ liquidCashCents: 0, bufferOverrideCents: 50000 });
    expect(maxAffordable('ONE_TIME', 'Other', input)).toBe(0);
  });

  it('returns the largest one-time amount that stays GREEN', () => {
    const input = makeInput({ liquidCashCents: 100000, bufferOverrideCents: 0 });
    const max = maxAffordable('ONE_TIME', 'Other', input);
    expect(max).toBeGreaterThan(0);
    // The boundary is genuinely GREEN, and one cent more is not.
    expect(
      simulatePurchaseDecision(
        { name: 'p', amountCents: max, type: 'ONE_TIME', purpose: 'OTHER' },
        input,
      ).state,
    ).toBe('GREEN');
    expect(
      simulatePurchaseDecision(
        { name: 'p', amountCents: max + 1, type: 'ONE_TIME', purpose: 'OTHER' },
        input,
      ).state,
    ).not.toBe('GREEN');
  });

  it('returns zero when a standing priority conflict makes any spend non-GREEN', () => {
    const input = makeInput({
      liquidCashCents: 100000,
      bufferOverrideCents: 0,
      obligations: [
        ob({
          category: 'Insurance',
          status: 'SEVERELY_OVERDUE',
          consequenceType: 'INSURANCE_LAPSE',
          consequenceAlreadyOccurring: true,
          isEssential: true,
          interestRate: 0,
          goalAlignmentKey: 'PROTECTS_STABILITY',
        }),
      ],
    });
    // A discretionary probe is blocked entirely by the urgent obligation.
    expect(maxAffordable('ONE_TIME', 'Other', input)).toBe(0);
  });

  it('supports recurring probes', () => {
    const input = makeInput({ liquidCashCents: 200000, bufferOverrideCents: 0 });
    expect(maxAffordable('RECURRING', 'Other', input)).toBeGreaterThanOrEqual(0);
  });

  it('maps the Business category to a business probe', () => {
    const input = makeInput({ liquidCashCents: 100000, bufferOverrideCents: 0 });
    expect(maxAffordable('ONE_TIME', 'Business', input)).toBeGreaterThan(0);
  });
});
