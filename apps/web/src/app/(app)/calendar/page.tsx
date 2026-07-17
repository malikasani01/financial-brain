import Link from 'next/link';
import type { CashEvent } from '@fb/types';
import { addDays } from '@fb/engine';
import { loadEngineView } from '@/lib/engine-view';
import { listOwn } from '@/lib/db';
import { listTransactions } from '@/lib/transactions';
import { centsToDollars, centsToWholeDollars } from '@/lib/money';
import { Card } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { StatusDot } from '@/components/brand';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<CashEvent['kind'], string> = {
  INCOME: 'Income',
  OBLIGATION: 'Bill',
  LIFE_COST: 'Living cost',
  SUBSCRIPTION: 'Subscription',
  GOAL_CONTRIBUTION: 'Goal',
  PLANNED_PURCHASE: 'Planned purchase',
  MANUAL: 'Expense',
};
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => String(n).padStart(2, '0');
/** Weekday index (0=Sun) for a 'YYYY-MM-DD' string, via UTC to avoid drift. */
function weekdayOf(iso: string): number {
  const [y, mo, dd] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, mo! - 1, dd!)).getUTCDay();
}
type Tone = 'pos' | 'neg' | 'violet';
function toneFor(e: { kind: CashEvent['kind']; amountCents: number }): Tone {
  if (e.amountCents > 0) return 'pos';
  if (e.kind === 'GOAL_CONTRIBUTION' || e.kind === 'PLANNED_PURCHASE') return 'violet';
  return 'neg';
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; d?: string }>;
}) {
  // One concurrent wave: search params, the engine view, and the name/txn
  // reads all resolve together.
  const [{ m, d }, { input, output, clock }, subRows, incomeRows, txns] = await Promise.all([
    searchParams,
    loadEngineView(),
    listOwn('subscriptions', 'id,name'),
    listOwn('income_sources', 'id,name'),
    listTransactions({ limit: 300 }),
  ]);
  const today = clock.today;

  const monthStr = /^\d{4}-\d{2}$/.test(m ?? '') ? m! : today.slice(0, 7);
  const [year, month] = monthStr.split('-').map(Number);
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? d! : today;
  const nameById = new Map<string, string>();
  for (const o of input.obligations) nameById.set(o.id, o.name);
  for (const g of input.goals) nameById.set(g.id, g.name);
  for (const r of [...subRows, ...incomeRows]) nameById.set(r.id, String(r.name));
  for (const t of txns) if (t.name) nameById.set(t.id, t.name);

  const eventsByDate = new Map<string, CashEvent[]>();
  for (const e of input.events) {
    const arr = eventsByDate.get(e.date) ?? [];
    arr.push(e);
    eventsByDate.set(e.date, arr);
  }
  const projByDate = new Map(output.forecast.days.map((day) => [day.date, day.projectedCashCents]));
  const clearedByDate = new Map<string, typeof txns>();
  for (const t of txns) {
    if (t.status !== 'cleared') continue;
    const arr = clearedByDate.get(t.txn_date) ?? [];
    arr.push(t);
    clearedByDate.set(t.txn_date, arr);
  }

  // --- Month grid geometry (UTC math to avoid timezone drift) ---
  const firstWeekday = new Date(Date.UTC(year!, month! - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  const prevM = month === 1 ? `${year! - 1}-12` : `${year}-${pad(month! - 1)}`;
  const nextM = month === 12 ? `${year! + 1}-01` : `${year}-${pad(month! + 1)}`;
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(`${year}-${pad(month!)}-${pad(day)}`);

  const nextFunding = input.fundingEvents.find((f) => f.date > today);

  // --- Selected-day details ---
  const selEvents = eventsByDate.get(selected) ?? [];
  const selCleared = clearedByDate.get(selected) ?? [];
  const selIncome = selEvents.filter((e) => e.amountCents > 0).reduce((t, e) => t + e.amountCents, 0);
  const selExpense = selEvents.filter((e) => e.amountCents < 0).reduce((t, e) => t + e.amountCents, 0);
  const selProjected = projByDate.get(selected) ?? null;
  const startBalance = selected === today ? output.safeToSpend.currentLiquidCashCents : (projByDate.get(addDays(selected, -1)) ?? null);
  const projTone =
    selProjected == null ? 'text-ink900' : selProjected < 0 ? 'text-neg' : selProjected < output.safetyBufferCents ? 'text-warn' : 'text-pos';

  // --- 4-day strip (today..+3) ---
  const strip = [0, 1, 2, 3].map((n) => {
    const date = addDays(today, n);
    const evs = eventsByDate.get(date) ?? [];
    const main = [...evs].sort((a, b) => Math.abs(b.amountCents) - Math.abs(a.amountCents))[0];
    return { date, n, projected: projByDate.get(date) ?? null, main };
  });

  return (
    <main className="mx-auto max-w-md px-6 py-8">
      <h1 className="text-2xl font-extrabold text-ink900">Calendar</h1>

      {/* Header summary */}
      <Card className="mt-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-ink600">Available to spend</p>
            <p className="font-num text-xl font-bold text-pos">{centsToDollars(output.safeToSpend.safeToSpendCents)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink600">Next payday</p>
            <p className="font-bold text-ink900">
              {nextFunding ? `${nextFunding.date.slice(5)} · ${output.safeToSpend.daysUntilNextFundingEvent}d` : '—'}
            </p>
          </div>
        </div>
      </Card>

      {/* 4-day strip */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {strip.map((s) => (
          <Link key={s.date} href={`/calendar?m=${s.date.slice(0, 7)}&d=${s.date}`} className="rounded-button bg-white p-2 text-center shadow-card">
            <p className="text-[11px] font-bold text-ink600">{s.n === 0 ? 'Today' : WEEKDAYS[weekdayOf(s.date)]}</p>
            <p className="mt-0.5 font-num text-sm font-bold text-ink900">{s.projected != null ? centsToWholeDollars(s.projected) : '—'}</p>
            {s.main && <p className="mt-0.5 truncate text-[10px] text-ink600">{nameById.get(s.main.sourceId) ?? KIND_LABEL[s.main.kind]}</p>}
          </Link>
        ))}
      </div>

      {/* Month grid */}
      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <Link href={`/calendar?m=${prevM}&d=${selected}`} aria-label="Previous month" className="text-violet600">
            <Icon name="caret-right" size={20} className="rotate-180" />
          </Link>
          <p className="font-extrabold text-ink900">{MONTHS[month! - 1]} {year}</p>
          <Link href={`/calendar?m=${nextM}&d=${selected}`} aria-label="Next month" className="text-violet600">
            <Icon name="caret-right" size={20} />
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w) => (
            <span key={w} className="text-[11px] font-bold text-ink600">{w}</span>
          ))}
          {cells.map((date, i) => {
            if (!date) return <span key={`b${i}`} />;
            const day = Number(date.slice(8));
            const evs = eventsByDate.get(date) ?? [];
            const tones = new Set<Tone>(evs.map(toneFor));
            if ((clearedByDate.get(date)?.length ?? 0) > 0) tones.add('neg');
            const isToday = date === today;
            const isSel = date === selected;
            return (
              <Link
                key={date}
                href={`/calendar?m=${monthStr}&d=${date}`}
                className={`flex flex-col items-center rounded-input py-1.5 ${
                  isSel ? 'bg-violet500 text-white' : isToday ? 'bg-violet100 text-violet600' : 'text-ink900'
                }`}
              >
                <span className="text-sm font-bold">{day}</span>
                <span className="mt-0.5 flex h-2 gap-0.5">
                  {[...tones].slice(0, 3).map((t) => (
                    <StatusDot key={t} tone={isSel ? 'neutral' : t} />
                  ))}
                </span>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Selected day detail */}
      <h2 className="mt-6 text-lg font-extrabold text-ink900">{selected}</h2>
      <Card className="mt-3">
        <Row label="Starting balance">{startBalance != null ? centsToDollars(startBalance) : '—'}</Row>
        <Row label="Income">{selIncome > 0 ? `+${centsToDollars(selIncome)}` : '$0.00'}</Row>
        <Row label="Bills / expenses">{selExpense < 0 ? centsToDollars(selExpense) : '$0.00'}</Row>
        <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
          <span className="font-bold text-ink900">Projected end of day</span>
          <span className={`font-num font-bold ${projTone}`}>
            {selProjected != null ? centsToDollars(selProjected) : '—'}
          </span>
        </div>
      </Card>

      {(selEvents.length > 0 || selCleared.length > 0) && (
        <Card className="mt-3">
          {selEvents.map((e, i) => (
            <div key={`e${i}`} className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
              <span className="flex items-center gap-2 truncate">
                <StatusDot tone={toneFor(e)} />
                <span className="truncate text-ink900">{nameById.get(e.sourceId) ?? KIND_LABEL[e.kind]}</span>
                <span className="text-xs text-ink600">{KIND_LABEL[e.kind]}</span>
              </span>
              <span className={`font-num ${e.amountCents > 0 ? 'text-pos' : 'text-neg'}`}>
                {e.amountCents > 0 ? '+' : ''}
                {centsToDollars(e.amountCents)}
              </span>
            </div>
          ))}
          {selCleared.map((t) => (
            <div key={`c${t.id}`} className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
              <span className="truncate text-ink900">
                {t.name ?? 'Transaction'} <span className="text-xs text-ink600">cleared</span>
              </span>
              <span className={`font-num ${t.direction === 'income' ? 'text-pos' : 'text-neg'}`}>
                {t.direction === 'income' ? '+' : t.direction === 'transfer' ? '' : '-'}
                {centsToDollars(t.amount_cents)}
              </span>
            </div>
          ))}
        </Card>
      )}
      {selEvents.length === 0 && selCleared.length === 0 && (
        <p className="mt-3 text-sm text-ink600">This day has no planned financial activity.</p>
      )}
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-ink600">{label}</span>
      <span className="font-num text-ink900">{children}</span>
    </div>
  );
}
