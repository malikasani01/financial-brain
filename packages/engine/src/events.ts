/**
 * Turns EngineInput into the concrete CashEvent stream the forecast walks.
 *
 * Two responsibilities:
 *  - Expand life-cost categories into dated outflow events, choosing the
 *    minimum or normal amount according to the financial stage.
 *  - Filter the official ("conservative") forecast to CONFIRMED income only.
 */

import type { CashEvent, EngineInput, FinancialStage, LifeCostInput } from '@fb/types';
import { expandOccurrences } from './recurrence.js';
import { addDays, addMonths, daysInMonth } from './dateutil.js';

/** The amount a life-cost category contributes, given the stage. */
export function selectLifeCostAmount(lc: LifeCostInput, stage: FinancialStage): number {
  switch (lc.planningMode) {
    case 'MIN':
      return lc.minimumCents;
    case 'NORMAL':
      return lc.normalCents;
    case 'CUSTOM':
      return lc.customCents ?? lc.minimumCents;
    case 'STAGE_DEFAULT':
      // Tighter stages live on the minimum; healthier stages use the normal amount.
      return stage === 'CRITICAL' || stage === 'STABILIZING' ? lc.minimumCents : lc.normalCents;
  }
}

/**
 * Budget-mode reservations: instead of per-occurrence amounts, reserve one
 * lump per month at month-end — the REMAINING budget for the current month
 * (budget − already-spent, so money already out of the account isn't reserved
 * again) and the full budget for each later month in the horizon.
 */
function buildBudgetEvents(lc: LifeCostInput, today: string, horizonDays: number): CashEvent[] {
  const budget = lc.monthlyBudgetCents ?? 0;
  if (budget <= 0) return [];
  const spent = lc.spentThisMonthCents ?? 0;
  const end = addDays(today, horizonDays - 1);
  const currentMonth = today.slice(0, 7);
  const out: CashEvent[] = [];
  let cursor = `${currentMonth}-01`;
  while (cursor <= end) {
    const year = Number(cursor.slice(0, 4));
    const month = Number(cursor.slice(5, 7));
    const monthEnd = `${cursor.slice(0, 7)}-${String(daysInMonth(year, month)).padStart(2, '0')}`;
    const amount = cursor.slice(0, 7) === currentMonth ? Math.max(0, budget - spent) : budget;
    if (amount > 0 && monthEnd >= today && monthEnd <= end) {
      out.push({
        date: monthEnd,
        amountCents: -amount,
        kind: 'LIFE_COST',
        sourceId: lc.id,
        confidence: 'CONFIRMED',
        isEssential: lc.isEssential,
      });
    }
    cursor = addMonths(cursor, 1);
  }
  return out;
}

/** Expand every life cost into dated outflow events for the given stage. */
export function buildLifeCostEvents(input: EngineInput, stage: FinancialStage): CashEvent[] {
  const { clock, horizonDays } = input;
  const out: CashEvent[] = [];
  for (const lc of input.lifeCosts) {
    if (lc.budgetMode) {
      out.push(...buildBudgetEvents(lc, clock.today, horizonDays));
      continue;
    }
    const base = selectLifeCostAmount(lc, stage);
    // One-off "just this week" tweaks replace the planned amount on their date.
    const overrides = new Map((lc.overrides ?? []).map((o) => [o.date, o.amountCents]));
    // Nothing to emit at all: no planned amount and no overrides.
    if (base <= 0 && overrides.size === 0) continue;
    const anchor = lc.nextDate ?? clock.today;
    for (const date of expandOccurrences(anchor, lc.frequency, clock.today, horizonDays)) {
      const amount = overrides.has(date) ? overrides.get(date)! : base;
      if (amount <= 0) continue;
      out.push({
        date,
        amountCents: -amount,
        kind: 'LIFE_COST',
        sourceId: lc.id,
        confidence: 'CONFIRMED',
        isEssential: lc.isEssential,
      });
    }
  }
  return out;
}

/**
 * The conservative forecast counts ALL outflows but only CONFIRMED income.
 * VARIABLE / HIGHLY_LIKELY / SPECULATIVE income never increases Safe to Spend.
 */
export function filterConservative(events: CashEvent[]): CashEvent[] {
  return events.filter((e) => e.kind !== 'INCOME' || e.confidence === 'CONFIRMED');
}

/** All forecast events for a stage: stage-independent events + life costs. */
export function buildForecastEvents(input: EngineInput, stage: FinancialStage): CashEvent[] {
  return [...filterConservative(input.events), ...buildLifeCostEvents(input, stage)];
}
