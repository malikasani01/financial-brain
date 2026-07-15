/**
 * Pure integer-cents helpers. The whole system is integer cents; these are the
 * only sanctioned ways to divide and distribute money so results always stay
 * integer and always sum back to the original total.
 */

import type { Cents } from '@fb/types';

export function assertInteger(cents: Cents, label = 'amount'): void {
  if (!Number.isInteger(cents)) {
    throw new Error(`${label} must be integer cents, got ${cents}`);
  }
}

export function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/** Floor-divide cents into `parts` equal pieces (each piece truncated down). */
export function splitEvenFloor(total: Cents, parts: number): Cents {
  if (parts <= 0) throw new Error('parts must be positive');
  return Math.floor(total / parts);
}

/**
 * Largest-remainder distribution: split `total` cents across `weights` so the
 * pieces are proportional to the weights AND sum EXACTLY to `total` (no lost or
 * phantom cents). Used by allocation and per-paycheck goal math.
 */
export function distributeByWeight(total: Cents, weights: number[]): Cents[] {
  assertInteger(total, 'total');
  const n = weights.length;
  if (n === 0) return [];
  const weightSum = weights.reduce((s, w) => s + w, 0);
  if (weightSum <= 0) {
    // Degenerate: spread as evenly as possible.
    const base = Math.floor(total / n);
    const out = new Array<Cents>(n).fill(base);
    let remainder = total - base * n;
    for (let i = 0; i < n && remainder !== 0; i++) {
      const step = remainder > 0 ? 1 : -1;
      out[i] = (out[i] as number) + step;
      remainder -= step;
    }
    return out;
  }

  const exact = weights.map((w) => (total * w) / weightSum);
  const floors = exact.map((x) => Math.floor(x));
  let allocated = floors.reduce((s, x) => s + x, 0);
  let remainder = total - allocated;

  // Hand out the leftover cents to the largest fractional remainders first.
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);

  const out = floors.slice();
  let k = 0;
  while (remainder > 0 && order.length > 0) {
    const idx = order[k % order.length]!.i;
    out[idx] = (out[idx] as number) + 1;
    remainder -= 1;
    k += 1;
  }
  return out;
}

/** Sum of a cents array. */
export function sumCents(values: Cents[]): Cents {
  return values.reduce((s, v) => s + v, 0);
}
