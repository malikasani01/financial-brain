import { describe, expect, it } from 'vitest';
import type { EngineInput } from '@fb/types';
import { BRAIN_TOOLS, runBrainTool } from './tools.js';

/** Minimal engine input: $1,000 cash, no buffer, no obligations → Safe to Spend $1,000. */
function makeInput(over: Partial<EngineInput> = {}): EngineInput {
  return {
    clock: { today: '2026-07-15', timezone: 'America/Denver' },
    horizonDays: 90,
    liquidCashCents: 100000,
    events: [],
    lifeCosts: [],
    obligations: [],
    goals: [],
    fundingEvents: [],
    bufferOverrideCents: 0,
    ...over,
  };
}

describe('BRAIN_TOOLS', () => {
  it('exposes exactly the four engine-backed tools', () => {
    expect(BRAIN_TOOLS.map((t) => t.name)).toEqual([
      'check_purchase',
      'max_affordable',
      'allocate_money',
      'ledger_advice',
    ]);
  });
});

describe('runBrainTool — check_purchase', () => {
  it('GREEN for a small buy, with dollar-formatted before/after', () => {
    const out = runBrainTool('check_purchase', { amount_dollars: 10 }, makeInput());
    expect(out.isError).toBe(false);
    const r = JSON.parse(out.text);
    expect(r.decision).toBe('GREEN');
    expect(r.purchase).toBe('$10');
    expect(r.safeToSpendBefore).toBe('$1,000');
    expect(r.safeToSpendAfter).toBe('$990');
    expect(Array.isArray(r.reasons)).toBe(true);
  });

  it('treats recurring=true as a subscription (uses monthly payment)', () => {
    const out = runBrainTool(
      'check_purchase',
      { amount_dollars: 20, recurring: true, purpose: 'FUN' },
      makeInput(),
    );
    expect(out.isError).toBe(false);
    const r = JSON.parse(out.text);
    expect(r.purchase).toBe('$20');
    expect(typeof r.decision).toBe('string');
  });

  it('defaults a missing amount to $0', () => {
    const out = runBrainTool('check_purchase', {}, makeInput());
    const r = JSON.parse(out.text);
    expect(r.purchase).toBe('$0');
  });
});

describe('runBrainTool — max_affordable', () => {
  it('returns a one-time cap by default', () => {
    const out = runBrainTool('max_affordable', {}, makeInput());
    expect(out.isError).toBe(false);
    const r = JSON.parse(out.text);
    expect(r.kind).toBe('ONE_TIME');
    expect(r.category).toBe('Other');
    expect(r.note).toBe('one-time');
    expect(typeof r.maxAffordable).toBe('string');
  });

  it('returns a per-month cap when recurring', () => {
    const out = runBrainTool('max_affordable', { recurring: true, category: 'Business' }, makeInput());
    const r = JSON.parse(out.text);
    expect(r.kind).toBe('RECURRING');
    expect(r.category).toBe('Business');
    expect(r.note).toBe('per month');
  });
});

describe('runBrainTool — allocate_money', () => {
  it('protects a lump sum as cash when there is nothing to pay', () => {
    const out = runBrainTool('allocate_money', { amount_dollars: 500 }, makeInput());
    expect(out.isError).toBe(false);
    const r = JSON.parse(out.text);
    expect(r.available).toBe('$500');
    expect(Array.isArray(r.lines)).toBe(true);
    expect(typeof r.protectedAsCash).toBe('string');
  });
});

describe('runBrainTool — ledger_advice', () => {
  it('returns an empty periods list when nothing is scheduled', () => {
    const out = runBrainTool('ledger_advice', {}, makeInput());
    expect(out.isError).toBe(false);
    const r = JSON.parse(out.text);
    expect(r.safetyBuffer).toBe('$0');
    expect(r.periods).toEqual([]);
  });

  it('reports health, available, ending balance, and safe-to-save per period', () => {
    const input = makeInput({
      liquidCashCents: 100000,
      bufferOverrideCents: 20000,
      events: [
        {
          date: '2026-07-20',
          amountCents: 300000,
          kind: 'INCOME',
          sourceId: 'pay',
          confidence: 'CONFIRMED',
          isEssential: false,
        },
        {
          date: '2026-07-25',
          amountCents: -50000,
          kind: 'OBLIGATION',
          sourceId: 'rent',
          confidence: 'CONFIRMED',
          isEssential: true,
        },
      ],
    });
    const out = runBrainTool('ledger_advice', {}, input);
    expect(out.isError).toBe(false);
    const r = JSON.parse(out.text);
    expect(r.periods).toHaveLength(1);
    const p = r.periods[0];
    expect(p.period).toBe('Paycheck on 2026-07-20');
    expect(p.available).toBe('$4,000');
    expect(p.endingBalance).toBe('$3,500');
    expect(p.health).toBe('HEALTHY');
    expect(p.suggestedSavings).toBe('$3,300');
    expect(p.suggestedGoal).toBeNull(); // no goals to suggest
    expect(p.trimSuggestions).toEqual([]);
  });

  it('names the suggested goal when an off-track goal applies', () => {
    const input = makeInput({
      liquidCashCents: 100000,
      bufferOverrideCents: 20000,
      events: [
        {
          date: '2026-07-20',
          amountCents: 300000,
          kind: 'INCOME',
          sourceId: 'pay',
          confidence: 'CONFIRMED',
          isEssential: false,
        },
      ],
      goals: [
        {
          id: 'g1',
          name: 'Emergency fund',
          category: 'Emergency savings',
          targetCents: 500000,
          savedCents: 0,
          targetDate: null,
          personalPriority: 'IMPORTANT',
          committedPerPaycheckCents: 0,
        },
      ],
    });
    const out = runBrainTool('ledger_advice', {}, input);
    const r = JSON.parse(out.text);
    expect(r.periods[0].suggestedGoal).toBe('Emergency fund');
  });
});

describe('runBrainTool — errors', () => {
  it('flags an unknown tool name as an error', () => {
    const out = runBrainTool('does_not_exist', {}, makeInput());
    expect(out.isError).toBe(true);
    expect(out.text).toMatch(/Unknown tool/);
  });

  it('tolerates null raw input', () => {
    const out = runBrainTool('max_affordable', null, makeInput());
    expect(out.isError).toBe(false);
  });
});
