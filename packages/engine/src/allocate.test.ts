import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { allocateAvailableCash } from './allocate.js';
import { makeInput, ob } from './test-fixtures.js';

const urgentObligation = ob({
  id: 'urgent',
  name: 'Auto insurance',
  category: 'Insurance',
  status: 'SEVERELY_OVERDUE',
  consequenceType: 'INSURANCE_LAPSE',
  consequenceAlreadyOccurring: true,
  isEssential: true,
  minimumRequiredCents: 40000,
  interestRate: 0,
  goalAlignmentKey: 'PROTECTS_STABILITY',
});

const minorObligation = ob({
  id: 'minor',
  name: 'Streaming',
  category: 'Subscriptions',
  status: 'CURRENT',
  minimumRequiredCents: 30000,
  goalAlignmentKey: 'LIFESTYLE',
});

describe('allocateAvailableCash', () => {
  it('funds urgent obligations before protecting the buffer', () => {
    const input = makeInput({
      bufferOverrideCents: 50000,
      obligations: [urgentObligation, minorObligation],
    });
    const r = allocateAvailableCash(150000, input);

    const urgent = r.lines.find((l) => l.obligationId === 'urgent')!;
    const minor = r.lines.find((l) => l.obligationId === 'minor')!;
    const protect = r.lines.find((l) => l.obligationId === null)!;

    expect(urgent.amountCents).toBe(40000);
    expect(minor.amountCents).toBe(30000);
    expect(protect.amountCents).toBe(80000); // 50000 buffer + 30000 leftover
    expect(r.totalAllocatedCents).toBe(150000);
    expect(r.protectedAsBufferCents).toBe(80000);
  });

  it('returns nothing to allocate when no cash is available', () => {
    const r = allocateAvailableCash(0, makeInput({ obligations: [urgentObligation] }));
    expect(r.lines).toEqual([]);
    expect(r.totalAllocatedCents).toBe(0);
    expect(r.protectedAsBufferCents).toBe(0);
  });

  it('treats negative available cash as zero', () => {
    const r = allocateAvailableCash(-500, makeInput({ obligations: [urgentObligation] }));
    expect(r.lines).toEqual([]);
    expect(r.totalAllocatedCents).toBe(0);
  });

  it('skips a lower-priority obligation when the buffer consumes the remainder', () => {
    // available = urgent cure (40000) + buffer (50000); nothing left for the minor one.
    const input = makeInput({
      bufferOverrideCents: 50000,
      obligations: [urgentObligation, minorObligation],
    });
    const r = allocateAvailableCash(90000, input);
    expect(r.lines.find((l) => l.obligationId === 'minor')).toBeUndefined();
    expect(r.protectedAsBufferCents).toBe(50000);
    expect(r.totalAllocatedCents).toBe(90000);
  });

  it('caps each obligation at its cure amount', () => {
    const input = makeInput({ bufferOverrideCents: 0, obligations: [urgentObligation] });
    const r = allocateAvailableCash(1000000, input);
    expect(r.lines.find((l) => l.obligationId === 'urgent')!.amountCents).toBe(40000);
  });

  it('derives cure from amountDue, drops zero-cure items, and breaks ties by id', () => {
    const input = makeInput({
      bufferOverrideCents: 0,
      obligations: [
        // cure via amountDue fallback (no minimumRequired)
        ob({
          id: 'a',
          name: 'A',
          minimumRequiredCents: null,
          amountDueCents: 10000,
          status: 'CURRENT',
        }),
        // both null => cure 0 => filtered out entirely
        ob({ id: 'z', name: 'Z', minimumRequiredCents: null, amountDueCents: null }),
        // identical config => identical urgency & cure => tie broken by id
        ob({
          id: 'c2',
          name: 'C2',
          minimumRequiredCents: 5000,
          status: 'CURRENT',
          category: 'Other',
        }),
        ob({
          id: 'c1',
          name: 'C1',
          minimumRequiredCents: 5000,
          status: 'CURRENT',
          category: 'Other',
        }),
      ],
    });
    const r = allocateAvailableCash(100000, input);
    expect(r.lines.find((l) => l.obligationId === 'z')).toBeUndefined();
    expect(r.lines.find((l) => l.obligationId === 'a')!.amountCents).toBe(10000);
    // c1 before c2 (id tie-break), both funded.
    const ids = r.lines.filter((l) => l.obligationId?.startsWith('c')).map((l) => l.obligationId);
    expect(ids).toEqual(['c1', 'c2']);
  });

  it('PROPERTY: allocated lines always sum to the available amount (>=0)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5_000_000 }), (available) => {
        const input = makeInput({
          bufferOverrideCents: 50000,
          obligations: [urgentObligation, minorObligation],
        });
        const r = allocateAvailableCash(available, input);
        const sum = r.lines.reduce((s, l) => s + l.amountCents, 0);
        expect(sum).toBe(available);
      }),
    );
  });
});
