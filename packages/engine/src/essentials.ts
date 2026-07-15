/**
 * Essential monthly cost = sum of essential obligations + essential life costs,
 * each normalized to a monthly equivalent. Stage-independent (life costs use
 * their NORMAL amount here) so it can feed both stage detection and the buffer
 * without creating a cycle. Used for the STABLE / BUILDING_FREEDOM buffers.
 */

import type { Cents, EngineInput } from '@fb/types';
import { monthlyEquivalentRaw } from './constants.js';

export function essentialMonthlyCostCents(input: EngineInput): Cents {
  let total = 0;
  for (const o of input.obligations) {
    if (!o.isEssential) continue;
    const amount = o.amountDueCents ?? o.minimumRequiredCents ?? 0;
    total += monthlyEquivalentRaw(amount, o.frequency);
  }
  for (const lc of input.lifeCosts) {
    if (!lc.isEssential) continue;
    total += monthlyEquivalentRaw(lc.normalCents, lc.frequency);
  }
  return Math.round(total);
}
