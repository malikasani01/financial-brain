import Link from 'next/link';
import type { CashEvent, GoalInput } from '@fb/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays } from '@fb/engine';
import { loadEngineView } from '@/lib/engine-view';
import { listOwn } from '@/lib/db';
import { listTransactions, listExpenseCategories } from '@/lib/transactions';
import { centsToWholeDollars, centsToDollars } from '@/lib/money';
import { Card } from '@/components/ui';
import { Badge, Logo, Money } from '@/components/brand';
import { Icon } from '@/components/Icon';
import { QuickAdd } from '@/components/QuickAdd';
import { addTransaction, setAccountBalance } from '@/app/actions/manage';

export const dynamic = 'force-dynamic';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 'YYYY-MM-DD' -> 'Aug 1' (no Date parsing, so no timezone drift). */
function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}
function daysUntil(iso: string, today: string): number {
  const MS = 86_400_000;
  return Math.round((Date.parse(iso) - Date.parse(today)) / MS);
}

function greeting(tz: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date()),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Whole days since the most recently updated account balance (PRD §55). */
async function oldestBalanceAgeDays(
  supabase: SupabaseClient,
  userId: string,
  today: string,
): Promise<number | null> {
  const { data } = await supabase
    .from('accounts')
    .select('balance_updated_at')
    .eq('user_id', userId)
    .is('archived_at', null);
  const rows = (data ?? []) as { balance_updated_at: string | null }[];
  if (rows.length === 0) return null;
  const newest = rows.map((r) => (r.balance_updated_at ? r.balance_updated_at.slice(0, 10) : today)).sort().at(-1)!;
  return Math.max(0, daysUntil(today, newest) * -1);
}

const KIND_LABEL: Record<CashEvent['kind'], string> = {
  INCOME: 'Income',
  OBLIGATION: 'Bill',
  LIFE_COST: 'Living cost',
  SUBSCRIPTION: 'Subscription',
  GOAL_CONTRIBUTION: 'Goal',
  PLANNED_PURCHASE: 'Planned purchase',
  MANUAL: 'Expense',
};

const GOAL_STATUS: Record<string, { label: string; tone: 'pos' | 'warn' | 'neg' | 'neutral' }> = {
  ON_TRACK: { label: 'On track', tone: 'pos' },
  AT_RISK: { label: 'At risk', tone: 'warn' },
  OFF_TRACK: { label: 'Off track', tone: 'neg' },
  PAUSED: { label: 'Paused', tone: 'neutral' },
  COMPLETED: { label: 'Complete', tone: 'pos' },
};

export default async function HomePage() {
  const { output, input, clock, supabase, userId } = await loadEngineView();
  const s = output.safeToSpend;
  const today = clock.today;

  // --- Hero numbers (all engine-computed; the breakdown reconciles) ---
  const bankCents = s.currentLiquidCashCents;
  const reservedCents = Math.max(0, s.currentLiquidCashCents - s.lowestProjectedCashCents);
  const nextFunding = input.fundingEvents.find((f) => f.date > today);
  const daysToPayday = s.daysUntilNextFundingEvent;
  const beforePaydayCents = nextFunding
    ? (output.forecast.days.filter((d) => d.date < nextFunding.date).at(-1)?.projectedCashCents ??
      s.lowestProjectedCashCents)
    : s.lowestProjectedCashCents;

  // --- Priorities (top 3 unresolved) ---
  const obligationName = new Map(input.obligations.map((o) => [o.id, o.name]));
  const nextMoves = output.urgency
    .filter((u) => {
      const ob = input.obligations.find((o) => o.id === u.obligationId);
      return ob && !ob.resolved;
    })
    .map((u) => ({ ...u, name: obligationName.get(u.obligationId) ?? 'Obligation' }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const urgentCount = nextMoves.filter((u) => u.score >= 70).length;
  const staleDays = await oldestBalanceAgeDays(supabase, userId, today);

  // --- Names for events, then This Week + Upcoming bills ---
  const [subRows, incomeRows, accountRows] = await Promise.all([
    listOwn('subscriptions', 'id,name'),
    listOwn('income_sources', 'id,name'),
    listOwn('accounts', 'id,name'),
  ]);
  const nameById = new Map<string, string>();
  for (const o of input.obligations) nameById.set(o.id, o.name);
  for (const g of input.goals) nameById.set(g.id, g.name);
  for (const r of [...subRows, ...incomeRows]) nameById.set(r.id, String(r.name));
  const accounts = accountRows.map((a) => ({ id: a.id, name: String(a.name) }));

  const weekEnd = addDays(today, 7);
  const inWeek = (d: string) => d >= today && d <= weekEnd;
  const weekIncome = input.events
    .filter((e) => e.kind === 'INCOME' && e.confidence === 'CONFIRMED' && inWeek(e.date))
    .reduce((t, e) => t + e.amountCents, 0);
  const weekBills = input.events
    .filter((e) => e.amountCents < 0 && inWeek(e.date))
    .reduce((t, e) => t + e.amountCents, 0);
  const weekEndBalance =
    output.forecast.days.filter((d) => d.date <= weekEnd).at(-1)?.projectedCashCents ??
    s.currentLiquidCashCents;

  const upcomingBills = input.events
    .filter((e) => e.amountCents < 0 && e.date <= addDays(today, 14))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 5);

  const recent = await listTransactions({ limit: 5 });

  // Category choices: the user's own (remembered), then the standard set.
  const DEFAULT_CATEGORIES = [
    'Housing',
    'Auto & Transport',
    'Bills & Utilities',
    'Groceries',
    'Dining Out',
    'Health',
    'Personal',
    'Business',
    'Other',
  ];
  const { categories: usedCategories, lastUsed } = await listExpenseCategories();
  const categoryOptions = [...new Set([...usedCategories, ...DEFAULT_CATEGORIES])];
  const defaultCategory = lastUsed ?? 'Other';

  const goals = input.goals
    .map((g: GoalInput) => ({
      g,
      f: output.goalFeasibility.find((x) => x.goalId === g.id),
    }))
    .filter((x) => x.f && x.f.status !== 'COMPLETED')
    .slice(0, 3);

  return (
    <main className="mx-auto max-w-md px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size={32} />
          <div>
            <p className="text-sm font-bold text-ink900">{greeting(clock.timezone)}, Malika</p>
            <p className="text-xs text-ink600">{fmtDate(today)}</p>
          </div>
        </div>
        <Link href="/more" aria-label="More" className="text-ink600">
          <Icon name="dots" size={26} />
        </Link>
      </div>

      {staleDays != null && staleDays >= 7 && (
        <div className="mt-4 rounded-button bg-warn/15 px-4 py-3 text-sm text-[#9A6410]">
          Balances last updated {staleDays} days ago.{' '}
          <Link href="/accounts" className="font-bold underline">
            Update
          </Link>
        </div>
      )}

      {/* Hero: Available to Spend */}
      <Card className="mt-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink600">Available to spend</p>
        <p className={`mt-1 font-num text-5xl font-bold ${s.safeToSpendCents > 0 ? 'text-pos' : 'text-ink900'}`}>
          {centsToDollars(s.safeToSpendCents)}
        </p>
        {nextFunding && daysToPayday != null && (
          <p className="mt-1 text-sm text-ink600">
            {daysToPayday === 0 ? 'Payday today' : `${daysToPayday} days until payday`} ·{' '}
            {fmtDate(nextFunding.date)}
          </p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
          <Stat label="Bank" cents={bankCents} />
          <Stat label="Reserved" cents={reservedCents} href="/reserved" />
          <Stat label="Buffer" cents={s.safetyBufferCents} />
        </div>

        <p className="mt-4 rounded-button bg-violet100 px-4 py-3 text-sm text-ink900">
          <span className="font-num font-bold text-violet600">{centsToDollars(s.safeToSpendCents)}</span>{' '}
          is safe to spend{nextFunding ? ` before ${fmtDate(nextFunding.date)}` : ''}.
          {s.dailyFlexibilityCents != null && daysToPayday != null && daysToPayday > 0 && (
            <> That&apos;s about {centsToDollars(s.dailyFlexibilityCents)} a day for {daysToPayday} days.</>
          )}
        </p>

        <div className="mt-3 flex items-center gap-4 text-sm font-bold">
          <Link href="/home/safe-to-spend" className="text-violet600">Why?</Link>
          <span className="text-line">·</span>
          <Link href="/accounts" className="text-violet600">Update cash</Link>
        </div>
      </Card>

      {/* Projected before payday */}
      {nextFunding && (
        <p className="mt-3 text-center text-sm text-ink600">
          Projected balance before payday:{' '}
          <Money cents={beforePaydayCents} colorBySign className="font-bold" />
        </p>
      )}

      {/* Ask CTA */}
      <Link
        href="/ask"
        className="mt-5 flex items-center justify-center gap-2 rounded-button bg-violet500 px-6 py-4 font-bold text-white"
      >
        <Icon name="chat" size={20} /> Can I afford something?
      </Link>

      {/* This Week */}
      <h2 className="mt-8 text-lg font-extrabold text-ink900">This week</h2>
      <Card className="mt-3">
        <Row label="Starting balance"><Money cents={s.currentLiquidCashCents} /></Row>
        <Row label="Income this week"><Money cents={weekIncome} colorBySign showPlus /></Row>
        <Row label="Bills this week"><Money cents={weekBills} colorBySign /></Row>
        <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
          <span className="font-bold text-ink900">Projected end of week</span>
          <Money cents={weekEndBalance} colorBySign className="font-bold" />
        </div>
      </Card>

      {/* Upcoming bills */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-ink900">Upcoming bills</h2>
      </div>
      <Card className="mt-3">
        {upcomingBills.length === 0 && (
          <p className="text-sm text-ink600">No bills due in the next 14 days.</p>
        )}
        {upcomingBills.map((e, i) => {
          const d = daysUntil(e.date, today);
          const tone = d < 0 ? 'neg' : d <= 7 ? 'warn' : 'neutral';
          return (
            <div
              key={`${e.sourceId}-${e.date}-${i}`}
              className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink900">
                  {nameById.get(e.sourceId) ?? KIND_LABEL[e.kind]}
                </p>
                <p className="text-sm text-ink600">
                  {d < 0 ? 'Overdue' : d === 0 ? 'Due today' : `Due in ${d} days`} · {fmtDate(e.date)}
                </p>
              </div>
              <Badge tone={tone}>{centsToDollars(e.amountCents)}</Badge>
            </div>
          );
        })}
      </Card>

      {/* Next money moves */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-ink900">Your next money moves</h2>
        {urgentCount > 0 && <Badge tone="warn">{urgentCount} urgent</Badge>}
      </div>
      {nextMoves.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {nextMoves.map((m, i) => (
            <li key={m.obligationId}>
              <Card className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-ink900">
                    <span className="text-ink600">{i + 1}. </span>
                    {m.name}
                  </p>
                  <p className="text-sm text-ink600">Urgency {m.score}</p>
                </div>
                <Link href="/plan/priorities" className="text-sm font-bold text-violet600">
                  Plan
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink600">
          You&apos;re current on your critical obligations. Your next focus is your buffer and goals.
        </p>
      )}

      {/* Goals snapshot */}
      {goals.length > 0 && (
        <>
          <div className="mt-8 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-ink900">Goals</h2>
            <Link href="/goals" className="text-sm font-bold text-violet600">View all</Link>
          </div>
          <div className="mt-3 space-y-2">
            {goals.map(({ g, f }) => {
              const pct = g.targetCents > 0 ? Math.min(100, (g.savedCents / g.targetCents) * 100) : 0;
              const status = GOAL_STATUS[f!.status] ?? GOAL_STATUS.PAUSED!;
              return (
                <Link key={g.id} href={`/goals/${g.id}`}>
                  <Card>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-ink900">{g.name}</p>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink600">
                      <span className="font-num">{centsToWholeDollars(g.savedCents)}</span> /{' '}
                      <span className="font-num">{centsToWholeDollars(g.targetCents)}</span>
                    </p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-violet500" style={{ width: `${pct}%` }} />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Recent transactions */}
      {recent.length > 0 && (
        <>
          <div className="mt-8 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-ink900">Recent transactions</h2>
            <Link href="/transactions" className="text-sm font-bold text-violet600">View all</Link>
          </div>
          <Card className="mt-3">
            {recent.map((t) => {
              const positive = t.direction === 'income';
              const sign = positive ? '+' : t.direction === 'transfer' ? '' : '-';
              const color = positive ? 'text-pos' : t.direction === 'transfer' ? 'text-ink900' : 'text-neg';
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0"
                >
                  <span className="w-12 shrink-0 text-xs text-ink600">{t.txn_date.slice(5)}</span>
                  <span className="flex-1 truncate text-ink900">
                    {t.name ?? (t.direction === 'transfer' ? 'Transfer' : 'Transaction')}
                    {t.status !== 'cleared' && <span className="ml-2 text-xs text-ink600">pending</span>}
                  </span>
                  <span className={`font-num font-bold ${color}`}>
                    {sign}
                    {centsToDollars(t.amount_cents)}
                  </span>
                </div>
              );
            })}
          </Card>
        </>
      )}

      {accounts.length > 0 && (
        <QuickAdd
          addTransaction={addTransaction}
          setAccountBalance={setAccountBalance}
          accounts={accounts}
          categories={categoryOptions}
          defaultCategory={defaultCategory}
          today={today}
        />
      )}
    </main>
  );
}

function Stat({ label, cents, href }: { label: string; cents: number; href?: string }) {
  const body = (
    <>
      <p className="text-xs text-ink600">
        {label}
        {href && <span className="ml-1 text-violet600">›</span>}
      </p>
      <p className="mt-0.5 font-num text-sm font-bold text-ink900">{centsToWholeDollars(cents)}</p>
    </>
  );
  return href ? <Link href={href}>{body}</Link> : <div>{body}</div>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-ink600">{label}</span>
      <span className="font-num">{children}</span>
    </div>
  );
}
