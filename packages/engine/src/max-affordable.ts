/**
 * Inverts the purchase engine to answer the Brain's "how much can I afford"
 * questions: the largest amount (one-time or recurring monthly) for a category
 * that still comes back GREEN. Binary search over simulatePurchaseDecision.
 *
 * CODE decides the number; the AI only explains it.
 */

import type { Cents, EngineInput, Purpose } from '@fb/types';
import { calculateSafeToSpend } from './safe-to-spend.js';
import { simulatePurchaseDecision } from './purchase.js';

function purposeForCategory(category: string): Purpose {
  return category === 'Business' ? 'BUSINESS' : 'OTHER';
}

export function maxAffordable(
  kind: 'ONE_TIME' | 'RECURRING',
  category: string,
  input: EngineInput,
): Cents {
  const purpose = purposeForCategory(category);
  const hi0 = Math.max(0, calculateSafeToSpend(input).safeToSpendCents);
  if (hi0 === 0) return 0;

  const isGreen = (amount: Cents): boolean =>
    simulatePurchaseDecision(
      kind === 'ONE_TIME'
        ? { name: 'probe', amountCents: amount, type: 'ONE_TIME', purpose }
        : {
            name: 'probe',
            amountCents: amount,
            type: 'SUBSCRIPTION',
            purpose,
            monthlyPaymentCents: amount,
          },
      input,
    ).state === 'GREEN';

  // Zero must be GREEN for a meaningful answer; if not (e.g. a standing priority
  // conflict), nothing is affordable.
  if (!isGreen(0)) return 0;

  let lo = 0;
  let hi = hi0;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (isGreen(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
