import Link from 'next/link';
import type { CashEvent } from '@fb/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadEngineView } from '@/lib/engine-view';
import { listOwn } from '@/lib/db';
import { listTransactions } from '@/lib/transactions';
import { centsToWholeDollars, centsToDollars } from '@/lib/money';
import { Card } from '@/components/ui';
import { QuickAdd } from '@/components/QuickAdd';
import { addTransaction, setAccountBalance } from '@/app/actions/manage';

export const dynamic = 'force-dynamic';

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
  const newest = rows
    .map((r) => (r.balance_updated_at ? r.balance_updated_at.slice(0, 10) : today))
    .sort()
    .at(-1)!;
  const MS = 86_400_000;
  return Math.max(0, Math.round((Date.parse(today) - Date.parse(newest)) / MS));
}

function greeting(tz: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(
      new Date(),
    ),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const KIND_LABEL: Record<CashEvent['kind'], string> = {
  INCOME: 'Income',
  OBLIGATION: 'Bill',
  LIFE_COST: 'Living cost',
  SUBSCRIPTION: 'Subscription',
  GOAL_CONTRIBUTION: 'Goal',
  PLANNED_PURCHASE: 'Planned purchase',
};

export default async function HomePage() {
  const { output, input, clock, supabase, userId } = await loadEngineView();
  const s = output.safeToSpend;

  const obligationName = new Map(input.obligations.map((o) => [o.id, o.name]));
  const nextMoves = output.urgency
    .map((u) => ({ ...u, name: obligationName.get(u.obligationId) ?? 'Obligation' }))
    .filter((u) => {
      const ob = input.obligations.find((o) => o.id === u.obligationId);
      return ob && !ob.resolved;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const urgentCount = nextMoves.filter((u) => u.score >= 70).length;
  const nextFunding = input.fundingEvents.find((f) => f.date > clock.today);
  const alreadyNeeded = s.currentLiquidCashCents - s.lowestProjectedCashCents;
  const staleDays = await oldestBalanceAgeDays(supabase, userId, clock.today);

  const timeline = [...input.events]
    .filter((e) => e.date >= clock.today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, 6);

  // Real names for the timeline: events carry only a sourceId.
  const [subRows, incomeRows] = await Promise.all([
    listOwn('subscriptions', 'id,name'),
    listOwn('income_sources', 'id,name'),
  ]);
  const nameById = new Map<string, string>();
  for (const o of input.obligations) nameById.set(o.id, o.name);
  for (const g of input.goals) nameById.set(g.id, g.name);
  for (const r of [...subRows, ...incomeRows]) nameById.set(r.id, String(r.name));

  const accountRows = await listOwn('accounts', 'id,name');
  const accounts = accountRows.map((a) => ({ id: a.id, name: String(a.name) }));
  const recent = await listTransactions({ limit: 5 });

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <div className="flex items-center justify-between">
        <p className="text-muted">{greeting(clock.timezone)}, Malika.</p>
        <Link href="/settings" className="text-sm text-forest underline underline-offset-4">
          Manage
        </Link>
      </div>

      {staleDays != null && staleDays >= 7 && (
        <div className="mt-4 rounded-2xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
          Your balances were last updated {staleDays} days ago. Safe to Spend may no longer reflect
          your current cash.{' '}
          <Link href="/accounts" className="underline">
            Update balances
          </Link>
        </div>
      )}

      <Card className="mt-5 text-center">
        <p className="text-6xl font-semibold text-forest">
          {centsToWholeDollars(s.safeToSpendCents)}
        </p>
        <p className="mt-1 text-sm uppercase tracking-wide text-muted">Safe to spend</p>
        {nextFunding && <p className="mt-1 text-sm text-muted">until {nextFunding.date}</p>}
        <p className="mt-4 text-sm text-muted">
          You have {centsToWholeDollars(s.currentLiquidCashCents)} available, but{' '}
          {centsToWholeDollars(alreadyNeeded)} is needed for upcoming obligations and{' '}
          {centsToWholeDollars(s.safetyBufferCents)} is protected.
        </p>
        <div className="mt-3 flex items-center justify-center gap-3 text-sm">
          <Link href="/home/safe-to-spend" className="text-forest underline">
            Why?
          </Link>
          <span className="text-sage">·</span>
          <Link href="/accounts" className="text-forest underline">
            Update my available cash
          </Link>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Mini
          label="Daily flexible"
          value={s.dailyFlexibilityCents != null ? centsToDollars(s.dailyFlexibilityCents) : '—'}
        />
        <Mini
          label="Next money in"
          value={nextFunding ? centsToWholeDollars(nextFunding.amountCents) : '—'}
          sub={nextFunding?.date}
        />
        <Mini label="Needs attention" value={`${urgentCount}`} sub="urgent" />
      </div>

      <Link
        href="/ask"
        className="mt-5 block rounded-2xl bg-forest px-6 py-4 text-center font-medium text-cream"
      >
        Can I afford something?
      </Link>

      <h2 className="mt-8 text-lg font-semibold text-forest">Your next money moves</h2>
      {nextMoves.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {nextMoves.map((m, i) => (
            <li key={m.obligationId}>
              <Card className="flex items-center justify-between">
                <div>
                  <p className="text-ink">
                    <span className="text-muted">{i + 1}. </span>
                    {m.name}
                  </p>
                  <p className="text-sm text-muted">Urgency {m.score}</p>
                </div>
                <Link href="/plan/priorities" className="text-sm text-forest underline">
                  Plan
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">
          You&apos;re current on your critical obligations. Your next focus is your buffer and
          goals.
        </p>
      )}

      <h2 className="mt-8 text-lg font-semibold text-forest">Upcoming</h2>
      <ul className="mt-3 rounded-card bg-white/60 px-6 py-2 shadow-card">
        {timeline.map((e, i) => (
          <li
            key={`${e.sourceId}-${e.date}-${i}`}
            className="flex items-center justify-between border-t border-sage/20 py-3 first:border-t-0"
          >
            <span className="text-sm text-muted">{e.date}</span>
            <span className="flex-1 truncate px-3 text-ink">
              {nameById.get(e.sourceId) ?? KIND_LABEL[e.kind]}
            </span>
            <span className={e.amountCents >= 0 ? 'text-forest' : 'text-ink'}>
              {e.amountCents >= 0 ? '+' : ''}
              {centsToDollars(e.amountCents)}
            </span>
          </li>
        ))}
        {timeline.length === 0 && <li className="py-3 text-sm text-muted">No upcoming events.</li>}
      </ul>

      {recent.length > 0 && (
        <>
          <div className="mt-8 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-forest">Recent transactions</h2>
            <Link href="/transactions" className="text-sm font-bold text-violet600">
              View all
            </Link>
          </div>
          <ul className="mt-3 rounded-card bg-white/60 px-6 py-2 shadow-card">
            {recent.map((t) => {
              const positive = t.direction === 'income';
              const amount = centsToDollars(t.amount_cents);
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 border-t border-sage/20 py-3 first:border-t-0"
                >
                  <span className="w-14 shrink-0 text-xs text-muted">{t.txn_date.slice(5)}</span>
                  <span className="flex-1 truncate text-ink">
                    {t.name ?? (t.direction === 'transfer' ? 'Transfer' : 'Transaction')}
                    {t.status !== 'cleared' && (
                      <span className="ml-2 text-xs text-muted">pending</span>
                    )}
                  </span>
                  <span
                    className={`font-num ${positive ? 'text-pos' : t.direction === 'transfer' ? 'text-ink' : 'text-neg'}`}
                  >
                    {positive ? '+' : t.direction === 'transfer' ? '' : '-'}
                    {amount}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {accounts.length > 0 && (
        <QuickAdd
          addTransaction={addTransaction}
          setAccountBalance={setAccountBalance}
          accounts={accounts}
          today={clock.today}
        />
      )}
    </main>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card bg-white p-4 shadow-card">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
