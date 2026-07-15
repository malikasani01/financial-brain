/**
 * Financial Urgency Score (spec §6/§43): a 0–100 weighted blend of six factors.
 *
 * Two subtleties, both faithful to the spec:
 *  - Effective payment status = the more severe of the user-entered status and
 *    the status implied by the due date.
 *  - When a factor's data is genuinely unknown, we do NOT invent a value. The
 *    factor is dropped and the remaining weights are renormalized, and the
 *    missing factor is surfaced to the UI.
 */

import type { EngineInput, ObligationInput, UrgencyComponent, UrgencyResult } from '@fb/types';
import {
  BUSINESS_ESSENTIALITY,
  CONSEQUENCE_SEVERITY,
  COST_OF_DELAY,
  DAYS_OVERDUE_BOOST,
  ESSENTIALITY,
  GOAL_ALIGNMENT,
  INTEREST_RATE_BANDS,
  PAYMENT_STATUS,
  TIME_URGENCY,
  URGENCY_WEIGHTS,
} from './constants.js';
import { daysBetween } from './dateutil.js';
import { clamp } from './money-util.js';

const UNKNOWN_LABELS: Record<keyof typeof URGENCY_WEIGHTS, string> = {
  consequenceSeverity: 'the consequence of not paying',
  costOfDelay: 'interest, fees, or penalties',
  essentiality: 'how essential this is',
  paymentStatus: 'the payment status',
  timeUrgency: 'the deadline',
  goalAlignment: 'goal alignment',
};

function businessEssentiality(revenueCents: number | null): number {
  const rev = revenueCents ?? 0;
  if (rev <= 0) {
    // Pre-revenue: midpoint of the pre-revenue band.
    return (BUSINESS_ESSENTIALITY.PRE_REVENUE_MIN + BUSINESS_ESSENTIALITY.PRE_REVENUE_MAX) / 2;
  }
  const frac = clamp(rev / BUSINESS_ESSENTIALITY.REVENUE_SATURATION_CENTS, 0, 1);
  const { WITH_REVENUE_MIN, WITH_REVENUE_MAX } = BUSINESS_ESSENTIALITY;
  return WITH_REVENUE_MIN + frac * (WITH_REVENUE_MAX - WITH_REVENUE_MIN);
}

function essentialityScore(o: ObligationInput): number {
  if (o.category === 'Business') return businessEssentiality(o.businessMonthlyRevenueCents);
  return ESSENTIALITY[o.category] ?? ESSENTIALITY.Other!;
}

/** Status implied purely by the due date, or null when there is no date. */
function dateDerivedStatusScore(o: ObligationInput, today: string): number | null {
  if (!o.dueDate) return null;
  const days = daysBetween(today, o.dueDate);
  if (days < 0) return PAYMENT_STATUS.OVERDUE!;
  if (days === 0) return PAYMENT_STATUS.DUE!;
  if (days <= 7) return PAYMENT_STATUS.DUE_WITHIN_7_DAYS!;
  if (days <= 14) return PAYMENT_STATUS.DUE_WITHIN_14_DAYS!;
  return PAYMENT_STATUS.FUTURE!;
}

function paymentStatusScore(o: ObligationInput, today: string): number {
  const userScore = PAYMENT_STATUS[o.status]!;
  // A paused item is intentionally not being paid; that intent dominates.
  if (o.status === 'PAUSED') return 0;

  const dateScore = dateDerivedStatusScore(o, today) ?? 0;
  let base = Math.max(userScore, dateScore);

  const isOverdue = base >= PAYMENT_STATUS.OVERDUE!;
  if (isOverdue) {
    const impliedOverdueDays =
      o.daysOverdue ??
      (o.dueDate && daysBetween(today, o.dueDate) < 0 ? -daysBetween(today, o.dueDate) : 0);
    const boost = Math.min(impliedOverdueDays * DAYS_OVERDUE_BOOST.PER_DAY, DAYS_OVERDUE_BOOST.MAX);
    base += boost;
  }
  return clamp(base, 0, 100);
}

function timeUrgencyScore(o: ObligationInput, today: string): number {
  if (o.consequenceAlreadyOccurring === true) return TIME_URGENCY.ALREADY_OCCURRING;
  const target = o.consequenceDate ?? o.dueDate;
  if (!target) return TIME_URGENCY.NONE;
  const days = daysBetween(today, target);
  if (days <= 0) return TIME_URGENCY.ALREADY_OCCURRING;
  if (days <= 3) return TIME_URGENCY.WITHIN_3;
  if (days <= 7) return TIME_URGENCY.WITHIN_7;
  if (days <= 14) return TIME_URGENCY.WITHIN_14;
  if (days <= 30) return TIME_URGENCY.WITHIN_30;
  if (days <= 90) return TIME_URGENCY.WITHIN_90;
  return TIME_URGENCY.NONE;
}

function interestBand(rate: number): number {
  if (rate >= INTEREST_RATE_BANDS.HIGH) return COST_OF_DELAY.HIGH_INTEREST;
  if (rate >= INTEREST_RATE_BANDS.MODERATE) return COST_OF_DELAY.MODERATE_INTEREST;
  if (rate > 0) return COST_OF_DELAY.SMALL_LATE_FEE;
  return COST_OF_DELAY.NONE;
}

/** null => genuinely unknown (renormalize); never fabricated. */
function costOfDelayScore(o: ObligationInput): number | null {
  const candidates: number[] = [];
  if (o.interestRate != null) candidates.push(interestBand(o.interestRate));
  if (o.penaltyCents != null)
    candidates.push(o.penaltyCents > 0 ? COST_OF_DELAY.MAJOR_PENALTIES : 0);
  if (o.lateFeeCents != null)
    candidates.push(o.lateFeeCents > 0 ? COST_OF_DELAY.SMALL_LATE_FEE : 0);
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

/** null => unknown; only meaningful for overdue items missing a consequence. */
function consequenceSeverityScore(o: ObligationInput): number | null {
  if (o.consequenceType != null) return CONSEQUENCE_SEVERITY[o.consequenceType] ?? 0;
  const overdue = o.status === 'OVERDUE' || o.status === 'SEVERELY_OVERDUE';
  return overdue ? null : CONSEQUENCE_SEVERITY.NONE!;
}

export function calculateUrgencyScore(
  obligation: ObligationInput,
  input: EngineInput,
): UrgencyResult {
  const today = input.clock.today;

  const raw: { key: keyof typeof URGENCY_WEIGHTS; score: number | null }[] = [
    { key: 'consequenceSeverity', score: consequenceSeverityScore(obligation) },
    { key: 'essentiality', score: essentialityScore(obligation) },
    { key: 'paymentStatus', score: paymentStatusScore(obligation, today) },
    { key: 'timeUrgency', score: timeUrgencyScore(obligation, today) },
    { key: 'costOfDelay', score: costOfDelayScore(obligation) },
    { key: 'goalAlignment', score: GOAL_ALIGNMENT[obligation.goalAlignmentKey] },
  ];

  const components: UrgencyComponent[] = raw.map((r) => ({
    key: r.key,
    scoreOrNull: r.score,
    weight: URGENCY_WEIGHTS[r.key],
  }));

  // essentiality and goalAlignment are never unknown, so weightSum is always > 0.
  const known = components.filter((c) => c.scoreOrNull !== null);
  const weightSum = known.reduce((s, c) => s + c.weight, 0);
  const weighted = known.reduce((s, c) => s + (c.scoreOrNull as number) * c.weight, 0);
  const score = clamp(Math.round(weighted / weightSum), 0, 100);

  const unknownFactors = components
    .filter((c) => c.scoreOrNull === null)
    .map((c) => UNKNOWN_LABELS[c.key as keyof typeof URGENCY_WEIGHTS]);

  return { obligationId: obligation.id, score, components, unknownFactors };
}
