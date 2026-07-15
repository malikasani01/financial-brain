/**
 * Freedom Plan & business-scenario math (spec §33). Pure and deterministic.
 * MVP intentionally excludes CAC / LTV / churn / conversion / cohorts.
 */

import type {
  BusinessScenarioInput,
  BusinessScenarioResult,
  Cents,
  FreedomResult,
} from '@fb/types';

export function calculateFreedom(
  desiredReplacementCents: Cents,
  currentBusinessIncomeCents: Cents,
): FreedomResult {
  return {
    freedomNumberCents: desiredReplacementCents,
    currentBusinessIncomeCents,
    freedomGapCents: Math.max(0, desiredReplacementCents - currentBusinessIncomeCents),
  };
}

/** Effective monthly price per user: monthly wins, then weekly (×52/12), then annual (÷12). */
export function effectiveMonthlyPriceCents(scenario: BusinessScenarioInput): Cents {
  if (scenario.monthlyPriceCents != null) return scenario.monthlyPriceCents;
  if (scenario.weeklyPriceCents != null) return Math.round((scenario.weeklyPriceCents * 52) / 12);
  if (scenario.annualPriceCents != null) return Math.round(scenario.annualPriceCents / 12);
  return 0;
}

export function calculateBusinessScenario(
  scenario: BusinessScenarioInput,
  freedomNumberCents: Cents,
): BusinessScenarioResult {
  const monthlyPricePerUserCents = effectiveMonthlyPriceCents(scenario);
  const mrrCents = monthlyPricePerUserCents * scenario.payingUsers;
  const arrCents = mrrCents * 12;
  const variableTotalCents = scenario.variableCostPerUserCents * scenario.payingUsers;
  const grossProfitCents = mrrCents - variableTotalCents;
  const netOperatingProfitCents = grossProfitCents - scenario.fixedMonthlyCents;

  const contributionPerUserCents = monthlyPricePerUserCents - scenario.variableCostPerUserCents;
  const customersToFreedom =
    contributionPerUserCents > 0
      ? Math.ceil((freedomNumberCents + scenario.fixedMonthlyCents) / contributionPerUserCents)
      : null;

  const freedomCoveragePercent =
    freedomNumberCents > 0
      ? Math.max(0, Math.round((netOperatingProfitCents / freedomNumberCents) * 100))
      : 0;

  return {
    id: scenario.id,
    label: scenario.label,
    monthlyPricePerUserCents,
    mrrCents,
    arrCents,
    grossProfitCents,
    netOperatingProfitCents,
    customersToFreedom,
    freedomCoveragePercent,
  };
}
