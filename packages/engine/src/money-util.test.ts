import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  assertInteger,
  clamp,
  distributeByWeight,
  splitEvenFloor,
  sumCents,
} from './money-util.js';

describe('assertInteger', () => {
  it('throws on non-integer cents', () => {
    expect(() => assertInteger(10.5)).toThrow();
    expect(() => assertInteger(10)).not.toThrow();
  });
});

describe('clamp', () => {
  it('bounds values', () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

describe('splitEvenFloor', () => {
  it('floors the quotient', () => {
    expect(splitEvenFloor(1000, 3)).toBe(333);
  });
  it('rejects non-positive parts', () => {
    expect(() => splitEvenFloor(1000, 0)).toThrow();
  });
});

describe('distributeByWeight', () => {
  it('splits proportionally and sums exactly to the total', () => {
    const out = distributeByWeight(1000, [1, 1, 1]);
    expect(sumCents(out)).toBe(1000);
    expect(out).toEqual([334, 333, 333]); // largest-remainder gives extra cent to first
  });

  it('handles zero-weight (degenerate) by spreading evenly', () => {
    const out = distributeByWeight(100, [0, 0, 0]);
    expect(sumCents(out)).toBe(100);
  });

  it('returns empty for no weights', () => {
    expect(distributeByWeight(100, [])).toEqual([]);
  });

  it('PROPERTY: distribution always sums exactly to the total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 12 }),
        (total, weights) => {
          const out = distributeByWeight(total, weights);
          expect(sumCents(out)).toBe(total);
          expect(out.every((c) => Number.isInteger(c))).toBe(true);
        },
      ),
    );
  });
});
