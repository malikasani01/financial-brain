/**
 * PURE normalization: DB rows -> EngineInput. No I/O. This is the second half
 * of "CODE DECIDES": it decides how stored facts become the cash-event stream
 * the deterministic engine walks. Fully unit-tested (normalize.test.ts).
 *
 * Key rules enforced here:
 *  - Only income sources feed the forecast; already-received income has already
 *    moved account balances, so it is not double-counted.
 *  - A reservation linked to an obligation excludes that obligation from future
 *    outflows (its money is already set aside).
 *  - Overdue cure amounts post at day 0 (locked decision); payment plans post
 *    at their scheduled date; paused / in-dispute items produce no outflow.
 *  - Committed goal contributions post on confirmed paycheck dates and thereby
 *    reduce Safe to Spend (committed-vs-required).
 *  - Every outflow is signed negative; income positive.
 */

import type {
  CashEvent,
  Clock,
  EngineInput,
  FundingEvent,
  GoalAlignmentKey,
  GoalInput,
  LifeCostInput,
  ObligationInput,
  PriorityClass,
} from '@fb/types';
import { CATEGORY_TO_GOAL_ALIGNMENT, compareDate, expandOccurrences } from '@fb/engine';
import type {
  BusinessRow,
  GoalRow,
  IncomeSourceRow,
  LifeCostRow,
  ObligationRow,
  PlannedPurchaseRow,
  RawFinancialData,
  SubscriptionRow,
  TransactionRow,
} from './rows.js';

const active = <T extends { archived_at: string | null }>(rows: T[]): T[] =>
  rows.filter((r) => r.archived_at === null);

function goalAlignmentFor(category: string): GoalAlignmentKey {
  return CATEGORY_TO_GOAL_ALIGNMENT[category] ?? 'LIFESTYLE';
}

function priorityClassFor(row: ObligationRow): PriorityClass {
  if (row.priority_class) return row.priority_class;
  return row.is_essential ? 'PROTECT' : 'ENJOY';
}

function incomeEvents(rows: IncomeSourceRow[], clock: Clock, horizonDays: number): CashEvent[] {
  const out: CashEvent[] = [];
  for (const r of active(rows)) {
    if (r.paused || !r.next_expected_date) continue;
    for (const date of expandOccurrences(
      r.next_expected_date,
      r.frequency,
      clock.today,
      horizonDays,
    )) {
      out.push({
        date,
        amountCents: r.net_amount_cents,
        kind: 'INCOME',
        sourceId: r.id,
        confidence: r.confidence,
        isEssential: false,
      });
    }
  }
  return out;
}

function obligationEvents(
  rows: ObligationRow[],
  reservedObligationIds: Set<string>,
  clock: Clock,
  horizonDays: number,
): CashEvent[] {
  const out: CashEvent[] = [];
  for (const r of active(rows)) {
    if (r.resolved || reservedObligationIds.has(r.id)) continue;
    if (r.status === 'PAUSED' || r.status === 'IN_DISPUTE') continue;

    const cure = r.minimum_required_cents ?? r.amount_due_cents ?? 0;
    const recurring = r.amount_due_cents ?? r.minimum_required_cents ?? 0;
    const isEssential = r.is_essential ?? false;
    const mk = (date: string, amount: number): CashEvent => ({
      date,
      amountCents: -amount,
      kind: 'OBLIGATION',
      sourceId: r.id,
      confidence: 'CONFIRMED',
      isEssential,
    });

    if (r.status === 'OVERDUE' || r.status === 'SEVERELY_OVERDUE') {
      // Cure posts at day 0.
      if (cure > 0) out.push(mk(clock.today, cure));
    } else if (r.status === 'PAYMENT_PLAN') {
      if (cure > 0) out.push(mk(r.next_expected_payment_date ?? clock.today, cure));
    } else {
      const anchor = r.next_expected_payment_date ?? r.due_date ?? clock.today;
      if (recurring > 0) {
        for (const date of expandOccurrences(anchor, r.frequency, clock.today, horizonDays)) {
          out.push(mk(date, recurring));
        }
      }
    }
  }
  return out;
}

function subscriptionEvents(
  rows: SubscriptionRow[],
  clock: Clock,
  horizonDays: number,
): CashEvent[] {
  const out: CashEvent[] = [];
  for (const r of active(rows)) {
    if (r.paused || r.amount_cents <= 0) continue;
    const anchor = r.next_charge_date ?? clock.today;
    for (const date of expandOccurrences(anchor, r.frequency, clock.today, horizonDays)) {
      out.push({
        date,
        amountCents: -r.amount_cents,
        kind: 'SUBSCRIPTION',
        sourceId: r.id,
        confidence: 'CONFIRMED',
        isEssential: r.purpose === 'Essential life',
      });
    }
  }
  return out;
}

function committedGoalEvents(rows: GoalRow[], fundingDates: string[]): CashEvent[] {
  const out: CashEvent[] = [];
  for (const g of active(rows)) {
    if (g.committed_per_paycheck_cents <= 0) continue;
    for (const date of fundingDates) {
      out.push({
        date,
        amountCents: -g.committed_per_paycheck_cents,
        kind: 'GOAL_CONTRIBUTION',
        sourceId: g.id,
        confidence: 'CONFIRMED',
        isEssential: false,
      });
    }
  }
  return out;
}

function plannedPurchaseEvents(
  rows: PlannedPurchaseRow[],
  clock: Clock,
  horizonDays: number,
): CashEvent[] {
  const out: CashEvent[] = [];
  for (const r of active(rows)) {
    if (r.amount_cents <= 0) continue;
    const mk = (date: string): CashEvent => ({
      date,
      amountCents: -r.amount_cents,
      kind: 'PLANNED_PURCHASE',
      sourceId: r.id,
      confidence: 'CONFIRMED',
      isEssential: false,
    });
    if (r.frequency === 'ONE_TIME') {
      out.push(mk(r.planned_date));
    } else {
      let dates = expandOccurrences(r.planned_date, 'MONTHLY', clock.today, horizonDays);
      if (r.term_months != null) dates = dates.slice(0, r.term_months);
      for (const date of dates) out.push(mk(date));
    }
  }
  return out;
}

/**
 * Not-yet-cleared manual expenses become future outflows in the forecast, so a
 * known upcoming spend lowers Safe to Spend. CLEARED transactions are skipped —
 * their money already left the account, so it's already in the balance (double
 * counting would otherwise occur). Income/transfers are skipped too: uncleared
 * income must not inflate the conservative number, and a transfer nets to zero.
 * A past-dated uncleared expense posts today (it still needs covering now).
 */
function transactionEvents(
  rows: TransactionRow[],
  clock: Clock,
): CashEvent[] {
  const out: CashEvent[] = [];
  for (const t of active(rows)) {
    if (t.status === 'cleared') continue;
    if (t.direction !== 'expense') continue;
    if (t.amount_cents <= 0) continue;
    const date = t.txn_date < clock.today ? clock.today : t.txn_date;
    out.push({
      date,
      amountCents: -t.amount_cents,
      kind: 'MANUAL',
      sourceId: t.id,
      confidence: 'CONFIRMED',
      isEssential: false,
    });
  }
  return out;
}

function toLifeCostInput(
  r: LifeCostRow,
  overrides: { date: string; amountCents: number }[],
  spentThisMonthCents: number,
): LifeCostInput {
  return {
    id: r.id,
    category: r.category,
    frequency: r.frequency,
    minimumCents: r.minimum_cents,
    normalCents: r.normal_cents,
    planningMode: r.planning_mode,
    customCents: r.custom_cents,
    isEssential: r.is_essential,
    nextDate: null,
    overrides,
    budgetMode: r.budget_mode ?? false,
    monthlyBudgetCents: r.monthly_budget_cents ?? null,
    spentThisMonthCents,
  };
}

function toObligationInput(r: ObligationRow, businesses: BusinessRow[]): ObligationInput {
  const businessRevenue =
    r.category === 'Business' && businesses.length > 0
      ? businesses[0]!.monthly_revenue_cents
      : null;
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    amountDueCents: r.amount_due_cents,
    minimumRequiredCents: r.minimum_required_cents,
    dueDate: r.due_date,
    frequency: r.frequency,
    status: r.status,
    priorityClass: priorityClassFor(r),
    isEssential: r.is_essential ?? false,
    isNegotiable: r.is_negotiable ?? true,
    nextExpectedPaymentDate: r.next_expected_payment_date,
    daysOverdue: r.days_overdue,
    totalPastDueCents: r.total_past_due_cents,
    consequenceType: r.consequence_type,
    consequenceAlreadyOccurring: r.consequence_already_occurring,
    consequenceDate: r.consequence_date,
    interestRate: r.interest_rate,
    lateFeeCents: r.late_fee_cents,
    penaltyCents: r.penalty_cents,
    goalAlignmentKey: goalAlignmentFor(r.category),
    businessMonthlyRevenueCents: businessRevenue,
    resolved: r.resolved,
  };
}

function toGoalInput(r: GoalRow): GoalInput {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    targetCents: r.target_cents,
    savedCents: r.saved_cents,
    targetDate: r.target_date,
    personalPriority: r.personal_priority ?? 'IMPORTANT',
    committedPerPaycheckCents: r.committed_per_paycheck_cents,
  };
}

export function normalizeToEngineInput(
  raw: RawFinancialData,
  clock: Clock,
  horizonDays: number,
): EngineInput {
  const liquidCashCents =
    active(raw.accounts).reduce((s, a) => s + a.balance_cents, 0) -
    active(raw.reservations).reduce((s, r) => s + r.amount_cents, 0);

  const reservedObligationIds = new Set(
    active(raw.reservations)
      .map((r) => r.linked_obligation_id)
      .filter((id): id is string => id !== null),
  );

  const income = incomeEvents(raw.incomeSources, clock, horizonDays);
  const fundingEvents: FundingEvent[] = income
    .filter((e) => e.confidence === 'CONFIRMED')
    .map((e) => ({ date: e.date, amountCents: e.amountCents }))
    .sort((a, b) => compareDate(a.date, b.date));
  const fundingDates = fundingEvents.map((f) => f.date);

  const events: CashEvent[] = [
    ...income,
    ...obligationEvents(raw.obligations, reservedObligationIds, clock, horizonDays),
    ...subscriptionEvents(raw.subscriptions, clock, horizonDays),
    ...committedGoalEvents(raw.goals, fundingDates),
    ...plannedPurchaseEvents(raw.plannedPurchases, clock, horizonDays),
    ...transactionEvents(raw.transactions ?? [], clock),
  ];

  return {
    clock,
    horizonDays,
    liquidCashCents,
    events,
    lifeCosts: active(raw.lifeCosts).map((r) => {
      const overrides = (raw.lifeCostOverrides ?? [])
        .filter((o) => o.life_cost_id === r.id)
        .map((o) => ({ date: o.override_date, amountCents: o.amount_cents }));
      // Cleared spending in this category this month (budget mode's "spent").
      const month = clock.today.slice(0, 7);
      const spent = (raw.transactions ?? [])
        .filter(
          (t) =>
            !t.archived_at &&
            t.status === 'cleared' &&
            t.direction === 'expense' &&
            t.category === r.category &&
            t.txn_date.slice(0, 7) === month,
        )
        .reduce((sum, t) => sum + t.amount_cents, 0);
      return toLifeCostInput(r, overrides, spent);
    }),
    obligations: active(raw.obligations).map((r) => toObligationInput(r, raw.businesses)),
    goals: active(raw.goals).map(toGoalInput),
    fundingEvents,
    bufferOverrideCents: raw.preferences?.safety_buffer_override_cents ?? null,
  };
}
