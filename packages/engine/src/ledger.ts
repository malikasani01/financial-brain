/**
 * The paycheck ledger: a running-balance walk exposed line by line, grouped
 * into paycheck periods — the spreadsheet view of the forecast.
 *
 * It is built from the SAME stage-selected, conservative event stream the
 * forecast uses (via runPipelineCore), so the ledger's ending balance always
 * reconciles with Safe to Spend. CODE DECIDES: every running balance here is
 * computed, never derived in the view.
 *
 * A new period opens on each income event. Income and outflow on the same day
 * are ordered outflow-first (the locked conservative rule), so a bill autopaying
 * the morning a paycheck lands is drawn from the pre-paycheck balance.
 */

import type { EngineInput, LedgerLine, LedgerPeriod, PaycheckLedger } from '@fb/types';
import { runPipelineCore } from './core.js';

export function buildPaycheckLedger(input: EngineInput): PaycheckLedger {
  const { liquidCashCents, clock } = input;
  const { finalEvents, safetyBufferCents } = runPipelineCore(input);

  // Only events inside the forecast window count, so the ledger's ending
  // balance matches Safe to Spend. Date ascending; within a day, outflows
  // before inflows (the locked conservative same-day rule).
  const ordered = [...finalEvents]
    .filter((e) => e.date >= clock.today)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || Number(a.amountCents >= 0) - Number(b.amountCents >= 0),
    );

  const periods: LedgerPeriod[] = [];
  let running = liquidCashCents;
  let lowest = liquidCashCents;

  // Leading "cash on hand" block, before the first income.
  let current: LedgerPeriod = {
    incomeDate: null,
    incomeSourceIds: [],
    incomeAmountCents: 0,
    openingCents: liquidCashCents,
    availableCents: liquidCashCents,
    lines: [],
    endingCents: liquidCashCents,
    lowestCents: liquidCashCents,
  };

  const closeCurrent = () => {
    current.endingCents = running;
    // Drop the leading block if it never held any activity — the first paycheck
    // period simply carries the opening cash in as its "Available".
    if (current.incomeDate !== null || current.lines.length > 0) periods.push(current);
  };

  for (const e of ordered) {
    if (e.amountCents > 0) {
      if (current.incomeDate === e.date) {
        // A second income on the same day — fold it into this period's Available.
        current.incomeSourceIds.push(e.sourceId);
        current.incomeAmountCents += e.amountCents;
        running += e.amountCents;
        current.availableCents = running;
      } else {
        closeCurrent();
        const opening = running;
        running += e.amountCents;
        current = {
          incomeDate: e.date,
          incomeSourceIds: [e.sourceId],
          incomeAmountCents: e.amountCents,
          openingCents: opening,
          availableCents: running,
          lines: [],
          endingCents: running,
          lowestCents: running,
        };
      }
    } else {
      running += e.amountCents;
      const line: LedgerLine = {
        date: e.date,
        sourceId: e.sourceId,
        kind: e.kind,
        amountCents: e.amountCents,
        runningCents: running,
        belowBuffer: running < safetyBufferCents,
        negative: running < 0,
      };
      current.lines.push(line);
      current.lowestCents = Math.min(current.lowestCents, running);
    }
    lowest = Math.min(lowest, running);
  }
  closeCurrent();

  return { periods, safetyBufferCents, lowestCents: lowest };
}
