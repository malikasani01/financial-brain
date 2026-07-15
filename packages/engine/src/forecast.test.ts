import { describe, expect, it } from 'vitest';
import { walkForecast } from './forecast-core.js';
import { generate90DayForecast } from './forecast.js';
import { buildLifeCostEvents, filterConservative, selectLifeCostAmount } from './events.js';
import { CLOCK, evt, lifeCost, makeInput, TODAY } from './test-fixtures.js';

describe('walkForecast', () => {
  it('with no events, the low point is the starting cash', () => {
    const r = walkForecast(50000, [], TODAY, 90, 0);
    expect(r.lowestProjectedCashCents).toBe(50000);
    expect(r.lowestCashDate).toBe(TODAY);
    expect(r.days).toHaveLength(90);
    expect(r.negativeDates).toEqual([]);
  });

  it('applies outflows before inflows on the same day (conservative low)', () => {
    // $100 start; on day+1 a -$150 bill and +$200 paycheck land together.
    const events = [
      evt({ date: '2026-07-16', amountCents: -15000, kind: 'OBLIGATION' }),
      evt({ date: '2026-07-16', amountCents: 20000, kind: 'INCOME' }),
    ];
    const r = walkForecast(10000, events, TODAY, 5, 0);
    // Intraday low that day = 10000 - 15000 = -5000 (bill hits first).
    expect(r.lowestProjectedCashCents).toBe(-5000);
    expect(r.lowestCashDate).toBe('2026-07-16');
    expect(r.negativeDates).toEqual(['2026-07-16']);
    // End-of-day still nets to +5000.
    expect(r.days[1]!.projectedCashCents).toBe(15000);
  });

  it('flags dates below the buffer', () => {
    const events = [evt({ date: '2026-07-17', amountCents: -60000 })];
    const r = walkForecast(100000, events, TODAY, 5, 50000);
    expect(r.belowBufferDates).toEqual(['2026-07-17', '2026-07-18', '2026-07-19']);
  });
});

describe('events helpers', () => {
  it('filterConservative keeps all outflows but only CONFIRMED income', () => {
    const events = [
      evt({ kind: 'INCOME', amountCents: 100, confidence: 'CONFIRMED' }),
      evt({ kind: 'INCOME', amountCents: 200, confidence: 'HIGHLY_LIKELY' }),
      evt({ kind: 'OBLIGATION', amountCents: -50, confidence: 'CONFIRMED' }),
    ];
    const kept = filterConservative(events);
    expect(kept).toHaveLength(2);
    expect(kept.some((e) => e.confidence === 'HIGHLY_LIKELY')).toBe(false);
  });

  it('selectLifeCostAmount honors explicit modes and stage defaults', () => {
    expect(selectLifeCostAmount(lifeCost({ planningMode: 'MIN' }), 'STABLE')).toBe(10000);
    expect(selectLifeCostAmount(lifeCost({ planningMode: 'NORMAL' }), 'CRITICAL')).toBe(17500);
    expect(
      selectLifeCostAmount(lifeCost({ planningMode: 'CUSTOM', customCents: 12345 }), 'STABLE'),
    ).toBe(12345);
    expect(
      selectLifeCostAmount(lifeCost({ planningMode: 'CUSTOM', customCents: null }), 'STABLE'),
    ).toBe(10000);
    expect(selectLifeCostAmount(lifeCost({ planningMode: 'STAGE_DEFAULT' }), 'CRITICAL')).toBe(
      10000,
    );
    expect(selectLifeCostAmount(lifeCost({ planningMode: 'STAGE_DEFAULT' }), 'STABLE')).toBe(17500);
  });

  it('buildLifeCostEvents skips zero-amount categories and signs outflows negative', () => {
    const input = makeInput({
      lifeCosts: [lifeCost({ frequency: 'MONTHLY', planningMode: 'MIN', minimumCents: 20000 })],
    });
    const events = buildLifeCostEvents(input, 'CRITICAL');
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.amountCents === -20000 && e.kind === 'LIFE_COST')).toBe(true);

    const zero = buildLifeCostEvents(
      makeInput({ lifeCosts: [lifeCost({ planningMode: 'MIN', minimumCents: 0 })] }),
      'CRITICAL',
    );
    expect(zero).toEqual([]);
  });

  it('buildLifeCostEvents anchors to nextDate when provided', () => {
    const input = makeInput({
      lifeCosts: [lifeCost({ frequency: 'MONTHLY', planningMode: 'MIN', nextDate: '2026-08-01' })],
    });
    const events = buildLifeCostEvents(input, 'CRITICAL');
    expect(events[0]!.date).toBe('2026-08-01');
  });
});

describe('generate90DayForecast', () => {
  it('honors the horizon length', () => {
    const r = generate90DayForecast(makeInput({ liquidCashCents: 1000, horizonDays: 30 }));
    expect(r.days).toHaveLength(30);
    expect(r.days[0]!.date).toBe(TODAY);
    expect(CLOCK.today).toBe(TODAY);
  });
});
