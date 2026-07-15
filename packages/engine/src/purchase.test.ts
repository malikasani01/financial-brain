import { describe, expect, it } from 'vitest';
import { purchaseToEvents, simulatePurchaseDecision } from './purchase.js';
import { evt, funding, makeInput, ob } from './test-fixtures.js';

const golden183 = makeInput({
  liquidCashCents: 284700,
  bufferOverrideCents: 50000,
  events: [
    evt({ date: '2026-08-12', amountCents: -216400, kind: 'OBLIGATION', isEssential: true }),
  ],
  fundingEvents: [funding('2026-07-29', 273000)],
});

describe('simulatePurchaseDecision — decision table', () => {
  it('GOLDEN: a $629 buy against $183 Safe to Spend is RED', () => {
    const r = simulatePurchaseDecision(
      { name: 'Camera', amountCents: 62900, type: 'ONE_TIME', purpose: 'OTHER' },
      golden183,
    );
    expect(r.state).toBe('RED');
    expect(r.safeToSpendBeforeCents).toBe(18300);
    expect(r.tests.safeToSpend.passed).toBe(false);
  });

  it('GREEN: a small buy that fits comfortably', () => {
    const input = makeInput({ liquidCashCents: 100000, bufferOverrideCents: 0 });
    const r = simulatePurchaseDecision(
      { name: 'Book', amountCents: 1000, type: 'ONE_TIME', purpose: 'FUN' },
      input,
    );
    expect(r.state).toBe('GREEN');
    expect(r.safeToSpendAfterCents).toBe(99000);
  });

  it('YELLOW: uses a significant portion of Safe to Spend', () => {
    const input = makeInput({ liquidCashCents: 100000, bufferOverrideCents: 0 });
    const r = simulatePurchaseDecision(
      { name: 'Gadget', amountCents: 60000, type: 'ONE_TIME', purpose: 'OTHER' },
      input,
    );
    expect(r.state).toBe('YELLOW');
    expect(r.reasons.join(' ')).toMatch(/significant portion/);
  });

  it('RED: discretionary buy while an urgent obligation is unresolved', () => {
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
    const r = simulatePurchaseDecision(
      { name: 'Concert', amountCents: 1000, type: 'ONE_TIME', purpose: 'FUN' },
      input,
    );
    expect(r.state).toBe('RED');
    expect(r.tests.priorityConflict.passed).toBe(false);
  });

  it('RED (below buffer) vs RED (below zero) messaging', () => {
    const belowBuffer = simulatePurchaseDecision(
      { name: 'x', amountCents: 60000, type: 'ONE_TIME', purpose: 'OTHER' },
      makeInput({ liquidCashCents: 100000, bufferOverrideCents: 50000 }),
    );
    expect(belowBuffer.state).toBe('RED');
    expect(belowBuffer.reasons.join(' ')).toMatch(/safety buffer/);

    const belowZero = simulatePurchaseDecision(
      { name: 'y', amountCents: 50000, type: 'ONE_TIME', purpose: 'OTHER' },
      makeInput({ liquidCashCents: 30000, bufferOverrideCents: 0 }),
    );
    expect(belowZero.reasons.join(' ')).toMatch(/below zero/);
  });

  it('YELLOW: business purchase with an owned/cheaper alternative', () => {
    const input = makeInput({ liquidCashCents: 100000, bufferOverrideCents: 0 });
    const r = simulatePurchaseDecision(
      {
        name: 'Camera',
        amountCents: 1000,
        type: 'ONE_TIME',
        purpose: 'BUSINESS',
        businessContext: {
          ownsAlternative: true,
          requiredToLaunch: false,
          requiredToOperate: false,
          lowerCostOptionExists: false,
          businessHasRevenue: false,
        },
      },
      input,
    );
    expect(r.state).toBe('YELLOW');
    expect(r.tests.businessRoi!.passed).toBe(false);
  });

  it('GREEN: business purchase with no cheaper alternative flagged', () => {
    const input = makeInput({ liquidCashCents: 100000, bufferOverrideCents: 0 });
    const r = simulatePurchaseDecision(
      {
        name: 'Domain',
        amountCents: 1000,
        type: 'ONE_TIME',
        purpose: 'BUSINESS',
        businessContext: {
          ownsAlternative: false,
          requiredToLaunch: true,
          requiredToOperate: true,
          lowerCostOptionExists: false,
          businessHasRevenue: true,
        },
      },
      input,
    );
    expect(r.tests.businessRoi!.passed).toBe(true);
    expect(r.state).toBe('GREEN');
  });

  it('YELLOW: financed purchase that is a heavy share of monthly income', () => {
    const input = makeInput({
      liquidCashCents: 500000,
      bufferOverrideCents: 0,
      events: [
        evt({ kind: 'INCOME', amountCents: 300000, confidence: 'CONFIRMED', date: '2026-07-29' }),
      ],
    });
    const r = simulatePurchaseDecision(
      {
        name: 'Loan',
        amountCents: 5000,
        type: 'LOAN',
        purpose: 'OTHER',
        monthlyPaymentCents: 50000,
        termMonths: 24,
      },
      input,
    );
    expect(r.tests.longHorizonLoad!.passed).toBe(false);
    expect(['YELLOW', 'RED']).toContain(r.state);
  });
});

describe('purchaseToEvents', () => {
  it('one-time purchase becomes a single outflow', () => {
    const events = purchaseToEvents(
      {
        name: 'x',
        amountCents: 5000,
        type: 'ONE_TIME',
        purpose: 'OTHER',
        plannedDate: '2026-08-01',
      },
      makeInput(),
    );
    expect(events).toEqual([
      {
        date: '2026-08-01',
        amountCents: -5000,
        kind: 'PLANNED_PURCHASE',
        sourceId: 'proposed',
        confidence: 'CONFIRMED',
        isEssential: false,
      },
    ]);
  });

  it('recurring purchase without a monthly payment or term uses the amount for the whole horizon', () => {
    const events = purchaseToEvents(
      { name: 'sub', amountCents: 8000, type: 'SUBSCRIPTION', purpose: 'OTHER' },
      makeInput({ horizonDays: 90 }),
    );
    expect(events.length).toBeGreaterThan(1); // not sliced by a term
    expect(events.every((e) => e.amountCents === -8000)).toBe(true);
  });

  it('financed purchase becomes monthly outflows limited by term', () => {
    const events = purchaseToEvents(
      {
        name: 'loan',
        amountCents: 0,
        type: 'PAYMENT_PLAN',
        purpose: 'OTHER',
        monthlyPaymentCents: 10000,
        termMonths: 2,
      },
      makeInput({ horizonDays: 200 }),
    );
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.amountCents === -10000)).toBe(true);
  });
});
