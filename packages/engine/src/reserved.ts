/**
 * Reserved for Bills — money already committed to required future outflows,
 * summed over time windows and itemized.
 *
 * CODE DECIDES: built from the SAME stage-selected, conservative event stream
 * the forecast walks (via runPipelineCore), so the totals reconcile with Safe
 * to Spend. Only outflows dated today or later count; income and the safety
 * buffer are handled elsewhere and are deliberately excluded here.
 */

import type { EngineInput, ReservedForBills, ReservedItem } from '@fb/types';
import { runPipelineCore } from './core.js';
import { addDays, compareDate } from './dateutil.js';

export function reservedForBills(input: EngineInput): ReservedForBills {
  const { finalEvents } = runPipelineCore(input);
  const today = input.clock.today;

  const items: ReservedItem[] = finalEvents
    .filter((e) => e.amountCents < 0 && compareDate(e.date, today) >= 0)
    .map((e) => ({ sourceId: e.sourceId, kind: e.kind, date: e.date, amountCents: -e.amountCents }))
    .sort((a, b) => compareDate(a.date, b.date));

  const sumThrough = (end: string): number =>
    items.reduce((t, i) => (compareDate(i.date, end) <= 0 ? t + i.amountCents : t), 0);

  const nextFunding = input.fundingEvents.find((f) => compareDate(f.date, today) > 0);
  const horizonEnd = addDays(today, input.horizonDays);

  return {
    thisWeekCents: sumThrough(addDays(today, 7)),
    untilPaydayCents: sumThrough(nextFunding ? nextFunding.date : horizonEnd),
    thisMonthCents: sumThrough(addDays(today, 30)),
    horizonCents: sumThrough(horizonEnd),
    hasPayday: nextFunding !== undefined,
    items,
  };
}
