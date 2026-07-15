/**
 * Money Allocation Tool (PRD §29): given a lump sum, recommend where it should
 * go. Deterministic and exact-summing (integer cents in, integer cents out).
 *
 * Order of claims:
 *   1. Urgent obligations (urgency >= 70), highest urgency first, up to cure.
 *   2. Protect the safety buffer.
 *   3. Lower-priority obligations, from whatever remains.
 *   4. Any leftover is protected as cash.
 *
 * This is why the engine never allocates 100% to debt: the buffer is claimed
 * before non-urgent obligations, and near-term essentials are already reflected
 * in the buffer/forecast the urgency scores are built on.
 */

import type { AllocationLine, AllocationResult, Cents, EngineInput } from '@fb/types';
import { DECISION } from './constants.js';
import { runPipelineCore } from './core.js';
import { calculateUrgencyScore } from './urgency.js';

interface Candidate {
  id: string;
  name: string;
  urgency: number;
  cure: Cents;
}

export function allocateAvailableCash(availableCents: Cents, input: EngineInput): AllocationResult {
  const buffer = runPipelineCore(input).safetyBufferCents;

  const candidates: Candidate[] = input.obligations
    .filter((o) => !o.resolved)
    .map((o) => ({
      id: o.id,
      name: o.name,
      urgency: calculateUrgencyScore(o, input).score,
      cure: o.minimumRequiredCents ?? o.amountDueCents ?? 0,
    }))
    .filter((c) => c.cure > 0)
    .sort((a, b) => b.urgency - a.urgency || b.cure - a.cure || a.id.localeCompare(b.id));

  const urgent = candidates.filter((c) => c.urgency >= DECISION.PRIORITY_CONFLICT_URGENCY);
  const rest = candidates.filter((c) => c.urgency < DECISION.PRIORITY_CONFLICT_URGENCY);

  const lines: AllocationLine[] = [];
  let remaining = Math.max(0, availableCents);

  const pay = (c: Candidate, reason: string) => {
    const amount = Math.min(remaining, c.cure);
    if (amount <= 0) return;
    lines.push({
      obligationId: c.id,
      label: c.name,
      amountCents: amount,
      reason,
      urgencyScore: c.urgency,
    });
    remaining -= amount;
  };

  for (const c of urgent) pay(c, 'Urgent obligation — funded before protecting the buffer.');

  let protectedAsBufferCents = Math.min(remaining, buffer);
  remaining -= protectedAsBufferCents;

  for (const c of rest) pay(c, 'Lower-priority obligation, funded from remaining cash.');

  // Anything still left is protected as cash.
  protectedAsBufferCents += remaining;
  remaining = 0;

  if (protectedAsBufferCents > 0) {
    lines.push({
      obligationId: null,
      label: 'Protect as cash',
      amountCents: protectedAsBufferCents,
      reason: 'Held back to protect your safety buffer.',
      urgencyScore: null,
    });
  }

  const totalAllocatedCents = lines.reduce((s, l) => s + l.amountCents, 0);
  return { lines, totalAllocatedCents, protectedAsBufferCents };
}
