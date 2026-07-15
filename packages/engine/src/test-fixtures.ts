/**
 * Shared builders for engine tests. Excluded from coverage (see vitest.config).
 * Every builder returns a fully-populated object; overrides via spread keep the
 * builders branch-free.
 */

import type {
  CashEvent,
  Clock,
  EngineInput,
  FundingEvent,
  GoalInput,
  LifeCostInput,
  ObligationInput,
} from '@fb/types';

export const TODAY = '2026-07-15';
export const CLOCK: Clock = { today: TODAY, timezone: 'America/Denver' };

export function makeInput(over: Partial<EngineInput> = {}): EngineInput {
  return {
    clock: CLOCK,
    horizonDays: 90,
    liquidCashCents: 0,
    events: [],
    lifeCosts: [],
    obligations: [],
    goals: [],
    fundingEvents: [],
    bufferOverrideCents: null,
    ...over,
  };
}

export function evt(over: Partial<CashEvent> = {}): CashEvent {
  return {
    date: TODAY,
    amountCents: 0,
    kind: 'OBLIGATION',
    sourceId: 'e',
    confidence: 'CONFIRMED',
    isEssential: false,
    ...over,
  };
}

export function ob(over: Partial<ObligationInput> = {}): ObligationInput {
  return {
    id: 'ob',
    name: 'Obligation',
    category: 'Other',
    amountDueCents: null,
    minimumRequiredCents: null,
    dueDate: null,
    frequency: 'MONTHLY',
    status: 'CURRENT',
    priorityClass: 'PROTECT',
    isEssential: false,
    isNegotiable: true,
    nextExpectedPaymentDate: null,
    daysOverdue: null,
    totalPastDueCents: null,
    consequenceType: null,
    consequenceAlreadyOccurring: null,
    consequenceDate: null,
    interestRate: null,
    lateFeeCents: null,
    penaltyCents: null,
    goalAlignmentKey: 'LIFESTYLE',
    businessMonthlyRevenueCents: null,
    resolved: false,
    ...over,
  };
}

export function goal(over: Partial<GoalInput> = {}): GoalInput {
  return {
    id: 'g',
    name: 'Goal',
    category: 'Other',
    targetCents: 100000,
    savedCents: 0,
    targetDate: null,
    personalPriority: 'IMPORTANT',
    committedPerPaycheckCents: 0,
    ...over,
  };
}

export function lifeCost(over: Partial<LifeCostInput> = {}): LifeCostInput {
  return {
    id: 'lc',
    category: 'Groceries',
    frequency: 'WEEKLY',
    minimumCents: 10000,
    normalCents: 17500,
    planningMode: 'STAGE_DEFAULT',
    customCents: null,
    isEssential: true,
    nextDate: null,
    ...over,
  };
}

export function funding(date: string, amountCents: number): FundingEvent {
  return { date, amountCents };
}
