/**
 * Builds the minimal, whitelisted, ALREADY-COMPUTED context the Financial Brain
 * is allowed to see. Money is pre-formatted to dollar strings so the model never
 * performs arithmetic — it only quotes and explains numbers the engine decided.
 *
 * This is the privacy boundary (PRD §57): only relevant structured values leave
 * the app, never the raw database.
 */

import type { EngineInput, EngineOutput } from '@fb/types';
import { usd } from './money.js';

export interface BrainContext {
  today: string;
  financialStage: string;
  stageReason: string;
  safeToSpend: string;
  safetyBuffer: string;
  currentCash: string;
  lowestProjectedCash: string;
  lowestCashDate: string;
  dailyFlexibility: string | null;
  daysUntilNextPaycheck: number | null;
  nextPaycheck: { amount: string; date: string } | null;
  urgentObligations: { name: string; urgencyScore: number; amountNeeded: string }[];
  goals: {
    name: string;
    status: string;
    remaining: string;
    neededPerPaycheck: string;
    estimatedCompletion: string | null;
    onTrack: boolean;
  }[];
}

export function buildBrainContext(input: EngineInput, output: EngineOutput): BrainContext {
  const s = output.safeToSpend;
  const nameById = new Map(input.obligations.map((o) => [o.id, o]));
  const goalById = new Map(input.goals.map((g) => [g.id, g]));

  const urgentObligations = output.urgency
    .map((u) => ({ u, o: nameById.get(u.obligationId) }))
    .filter((x) => x.o != null && !x.o.resolved && x.u.score >= 70)
    .sort((a, b) => b.u.score - a.u.score)
    .slice(0, 5)
    .map(({ u, o }) => ({
      name: o!.name,
      urgencyScore: u.score,
      amountNeeded: usd(o!.minimumRequiredCents ?? o!.amountDueCents ?? 0),
    }));

  const goals = output.goalFeasibility.map((f) => {
    const g = goalById.get(f.goalId);
    return {
      name: g?.name ?? 'Goal',
      status: f.status,
      remaining: usd(f.remainingCents),
      neededPerPaycheck: usd(f.requiredPerPaycheckCents),
      estimatedCompletion: f.estimatedCompletionDate,
      onTrack: f.feasible,
    };
  });

  const next = input.fundingEvents.find((fe) => fe.date > input.clock.today);

  return {
    today: input.clock.today,
    financialStage: output.stage.stage,
    stageReason: output.stage.reasons[0] ?? '',
    safeToSpend: usd(s.safeToSpendCents),
    safetyBuffer: usd(s.safetyBufferCents),
    currentCash: usd(s.currentLiquidCashCents),
    lowestProjectedCash: usd(s.lowestProjectedCashCents),
    lowestCashDate: s.lowestCashDate,
    dailyFlexibility: s.dailyFlexibilityCents != null ? usd(s.dailyFlexibilityCents) : null,
    daysUntilNextPaycheck: s.daysUntilNextFundingEvent,
    nextPaycheck: next ? { amount: usd(next.amountCents), date: next.date } : null,
    urgentObligations,
    goals,
  };
}
