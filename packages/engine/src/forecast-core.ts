/**
 * The low-level cash-flow walk. Pure and buffer-aware.
 *
 * Same-day ordering rule (locked): outflows are applied before inflows, so the
 * "intraday low" is the worst point that day. This is deliberately conservative
 * — a bill autopaying the morning your paycheck lands must not be assumed safe.
 * The recorded end-of-day balance still nets both.
 */

import type { CashEvent, Cents, ForecastResult, ISODate } from '@fb/types';
import { dateRange } from './dateutil.js';

export function walkForecast(
  liquidCashCents: Cents,
  events: CashEvent[],
  start: ISODate,
  horizonDays: number,
  bufferCents: Cents,
): ForecastResult {
  // Bucket signed amounts by date into outflow/inflow sums.
  const outflowByDate = new Map<ISODate, Cents>();
  const inflowByDate = new Map<ISODate, Cents>();
  for (const e of events) {
    if (e.amountCents < 0) {
      outflowByDate.set(e.date, (outflowByDate.get(e.date) ?? 0) + e.amountCents);
    } else {
      inflowByDate.set(e.date, (inflowByDate.get(e.date) ?? 0) + e.amountCents);
    }
  }

  const days: ForecastResult['days'] = [];
  const negativeDates: ISODate[] = [];
  const belowBufferDates: ISODate[] = [];

  let running = liquidCashCents;
  let lowest = Number.POSITIVE_INFINITY;
  let lowestDate: ISODate = start;

  for (const date of dateRange(start, horizonDays)) {
    const outflow = outflowByDate.get(date) ?? 0; // <= 0
    const inflow = inflowByDate.get(date) ?? 0; // >= 0
    const intradayLow = running + outflow; // outflows first
    const endOfDay = running + outflow + inflow;

    if (intradayLow < lowest) {
      lowest = intradayLow;
      lowestDate = date;
    }
    if (intradayLow < 0) negativeDates.push(date);
    if (intradayLow < bufferCents) belowBufferDates.push(date);

    days.push({ date, projectedCashCents: endOfDay });
    running = endOfDay;
  }

  return {
    days,
    lowestProjectedCashCents: lowest,
    lowestCashDate: lowestDate,
    negativeDates,
    belowBufferDates,
  };
}
