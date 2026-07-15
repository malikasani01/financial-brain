import { describe, expect, it } from 'vitest';
import { STEPS, stepIndex } from './onboarding';
import { dollarsInput } from './db';

describe('onboarding steps', () => {
  it('has the seven expected steps in order', () => {
    expect(STEPS.map((s) => s.slug)).toEqual([
      'accounts',
      'income',
      'obligations',
      'life-costs',
      'subscriptions',
      'goals',
      'freedom',
    ]);
  });
  it('stepIndex finds a slug and returns -1 for unknown', () => {
    expect(stepIndex('accounts')).toBe(0);
    expect(stepIndex('freedom')).toBe(6);
    expect(stepIndex('nope')).toBe(-1);
  });
});

describe('dollarsInput', () => {
  it('renders cents as a plain dollar string for form defaults, empty for null', () => {
    expect(dollarsInput(284700)).toBe('2847');
    expect(dollarsInput(999)).toBe('9.99');
    expect(dollarsInput(null)).toBe('');
    expect(dollarsInput(undefined)).toBe('');
    expect(dollarsInput(0)).toBe('0');
  });
});
