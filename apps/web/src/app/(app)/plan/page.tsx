import Link from 'next/link';
import type { CashEvent, LedgerPeriod, PeriodAdvice } from '@fb/types';
import { addDays, advisePaycheckPeriods, buildPaycheckLedger } from '@fb/engine';
import { loadEngineView } from '@/lib/engine-view';
import { listOwn } from '@/lib/db';
import { listTransactions } from '@/lib/transactions';
import { centsToDollars, centsToWholeDollars } from '@/lib/money';
import { Card } from '@/components/ui';
import { EditTransaction } from '@/components/EditTransaction';
import { LogSaving } from '@/components/LogSaving';
import { deleteTransaction, editTransaction, saveToGoal } from '@/app/actions/manage';

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

/** How each non-confirmed reliability reads to the user. */
const CONFIDENCE_LABEL: Record<string, string> = {
  HIGHLY_LIKELY: 'Expected — may change',
  VARIABLE: 'Varies',
  SPECULATIVE: 'Only a possibility',
};

export default async function PlanPage() {
  const { input, output, clock } = await loadEngineView();
  const s = output.safeToSpend;
  const ledger = buildPaycheckLedger(input);
  const advice = advisePaycheckPeriods(input, ledger);

  // Real names for the ledger and the "potential extra income" list — events
  // only carry a sourceId, so map each id back to its human name.
  const [subRows, lifeRows, goalRows, incomeRows, accountRows, txns] = await Promise.all([
    listOwn('subscriptions', 'id,name'),
    listOwn('life_cost_categories', 'id,category'),
    listOwn('goals', 'id,name'),
    listOwn('income_sources', 'id,name,net_amount_cents,frequency,confidence'),
    listOwn('accounts', 'id,name'),
    listTransactions({ limit: 500 }),
  ]);
  const nameById = new Map<string, string>();
  for (const o of input.obligations) nameById.set(o.id, o.name);
  for (const g of goalRows) nameById.set(g.id, String(g.name));
  for (const r of subRows) nameById.set(r.id, String(r.name));
  for (const r of lifeRows) nameById.set(r.id, String(r.category));
  for (const r of incomeRows) nameById.set(r.id, String(r.name));

  const accounts = accountRows.map((a) => ({ id: a.id, name: String(a.name) }));
  const txnById = new Map(txns.map((t) => [t.id, t]));
  // Recently-cleared manual transactions, newest first (shown green, editable).
  const recentlyCleared = txns
    .filter((t) => t.status === 'cleared' && t.txn_date >= addDays(clock.today, -14))
    .slice(0, 8);
  // Goals still needing money, for the "I saved this" sheet.
  const goalOptions = input.goals
    .map((g) => ({
      id: g.id,
      name: g.name,
      remainingCents: output.goalFeasibility.find((f) => f.goalId === g.id)?.remainingCents ?? 0,
    }))
    .filter((g) => g.remainingCents > 0);

  // Overdue obligations post their cure "today" regardless of due date (the
  // money is needed now to cure them), so tag those ledger lines rather than
  // showing a plain date that looks like it ignored the user's edit.
  const overdueIds = new Set(
    input.obligations
      .filter((o) => o.status === 'OVERDUE' || o.status === 'SEVERELY_OVERDUE')
      .map((o) => o.id),
  );

  const incomeLabel = (p: LedgerPeriod): string => {
    const names = p.incomeSourceIds.map((id) => nameById.get(id)).filter(Boolean);
    return names.length > 0 ? names.join(' + ') : 'Paycheck';
  };

  const trimText = (a: PeriodAdvice): string =>
    a.trims.length > 0
      ? ` Consider trimming ${a.trims
          .map((t) => `${t.category} (${centsToDollars(t.potentialSavingsCents)})`)
          .join(', ')} toward their minimum.`
      : '';

  const adviceLine = (a: PeriodAdvice): { emoji: string; className: string; text: string } => {
    if (a.health === 'NEGATIVE') {
      return {
        emoji: '🔴',
        className: 'bg-terracotta/10 text-terracotta',
        text: `This period goes negative — something has to move.${trimText(a)}`,
      };
    }
    if (a.health === 'TIGHT') {
      return {
        emoji: '🟠',
        className: 'bg-amber-500/10 text-amber-700',
        text: `Tight period — you dip below your safety buffer here.${trimText(a)}`,
      };
    }
    if (a.suggestedSavingsCents > 0) {
      const split = a.allocations
        .map((al) => {
          const name = nameById.get(al.goalId) ?? 'a goal';
          const done = al.remainingAfterCents === 0 ? ' — fully funded' : '';
          return `${centsToDollars(al.amountCents)} to "${name}"${done}`;
        })
        .join(', ');
      return {
        emoji: '🟢',
        className: 'bg-forest/10 text-forest',
        text: `Healthy period — you could save ${centsToDollars(a.suggestedSavingsCents)} (${split}) and still keep your buffer safe.`,
      };
    }
    return {
      emoji: '🟢',
      className: 'bg-forest/10 text-forest',
      text: "Healthy period — you're staying above your safety buffer.",
    };
  };

  // Income the user did NOT confirm never counts toward Safe to Spend (the
  // safety rule), but we surface it here so it isn't invisible.
  const unconfirmedIncome = incomeRows.filter((r) => String(r.confidence) !== 'CONFIRMED');

  const nextFunding = input.fundingEvents.find((f) => f.date > clock.today);
  const until = nextFunding?.date;
  const dips = ledger.lowestCents < ledger.safetyBufferCents;

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold text-forest">Paycheck plan</h1>

      <Card className="mt-6">
        <p className="text-sm uppercase tracking-wide text-muted">Next money in</p>
        {nextFunding ? (
          <>
            <p className="mt-1 text-3xl font-semibold text-forest">
              {centsToWholeDollars(nextFunding.amountCents)}
            </p>
            <p className="text-sm text-muted">on {nextFunding.date}</p>
          </>
        ) : (
          <p className="mt-1 text-muted">No confirmed income scheduled.</p>
        )}
        {s.dailyFlexibilityCents != null && (
          <p className="mt-3 border-t border-sage/20 pt-3 text-sm text-muted">
            {centsToDollars(s.dailyFlexibilityCents)} per day flexible{' '}
            {until ? `until ${until}` : ''}
          </p>
        )}
      </Card>

      <h2 className="mt-8 text-lg font-semibold text-forest">Your paycheck ledger</h2>
      <p className="mt-1 text-sm text-muted">
        Every bill subtracted from what came in, in date order — the same way you&apos;d track it
        by hand.
      </p>

      <div
        className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
          ledger.lowestCents < 0
            ? 'bg-terracotta/10 text-terracotta'
            : dips
              ? 'bg-amber-500/10 text-amber-700'
              : 'bg-forest/10 text-forest'
        }`}
      >
        Lowest point in view: {centsToDollars(ledger.lowestCents)}.{' '}
        {ledger.lowestCents < 0
          ? 'Your balance goes negative — something needs to move.'
          : dips
            ? `This dips below your ${centsToWholeDollars(ledger.safetyBufferCents)} safety buffer.`
            : `You stay above your ${centsToWholeDollars(ledger.safetyBufferCents)} safety buffer throughout.`}
      </div>

      {recentlyCleared.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-card border border-pos/30 bg-pos/5">
          <p className="border-b border-pos/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-pos">
            Recently cleared
          </p>
          {recentlyCleared.map((t) => (
            <div key={t.id} className="border-t border-pos/15 px-4 first:border-t-0">
              <EditTransaction
                txn={t}
                accounts={accounts}
                editAction={editTransaction.bind(null, t.id)}
                deleteAction={deleteTransaction.bind(null, t.id)}
              >
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-ink900">{t.name ?? 'Transaction'}</span>
                    <span className="ml-2 text-xs text-pos">✓ cleared · {t.txn_date.slice(5)}</span>
                  </span>
                  <span className={`shrink-0 font-num ${t.direction === 'income' ? 'text-pos' : 'text-ink900'}`}>
                    {t.direction === 'income' ? '+' : '-'}
                    {centsToDollars(t.amount_cents)}
                  </span>
                </div>
              </EditTransaction>
            </div>
          ))}
        </div>
      )}

      {ledger.periods.length === 0 && (
        <p className="mt-6 text-sm text-muted">
          Nothing scheduled yet. Add income and bills and your ledger will fill in.
        </p>
      )}

      <div className="mt-5 space-y-6">
        {ledger.periods.map((p, pi) => {
          const adv = advice[pi]!;
          const a = adviceLine(adv);
          return (
            <section key={`${p.incomeDate ?? 'onhand'}-${pi}`}>
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="font-medium text-forest">
                    {p.incomeDate ? incomeLabel(p) : 'Cash on hand'}
                  </p>
                  {p.incomeDate && <p className="text-xs text-muted">{p.incomeDate}</p>}
                </div>
                <div className="text-right">
                  {p.incomeDate && (
                    <p className="text-sm text-forest">
                      +{centsToDollars(p.incomeAmountCents)} received
                    </p>
                  )}
                  <p className="mt-0.5 text-xs uppercase tracking-wide text-muted">Available</p>
                  <p className="font-semibold text-ink">{centsToDollars(p.availableCents)}</p>
                </div>
              </div>

              <p className={`mt-2 rounded-xl px-3 py-2 text-xs ${a.className}`}>
                <span aria-hidden>{a.emoji}</span> {a.text}
              </p>

              {adv.suggestedSavingsCents > 0 && (
                <LogSaving
                  goals={goalOptions}
                  accounts={accounts}
                  suggestedGoalId={adv.allocations[0]?.goalId ?? null}
                  suggestedAmountCents={adv.suggestedSavingsCents}
                  action={saveToGoal}
                />
              )}

              <ul className="mt-2 rounded-card bg-white/60 px-5 py-1 shadow-card">
                {p.lines.length === 0 && (
                  <li className="py-3 text-sm text-muted">Nothing due this period.</li>
                )}
                {p.lines.map((l, li) => {
                  const overdue = overdueIds.has(l.sourceId);
                  const txn = l.kind === 'MANUAL' ? txnById.get(l.sourceId) : undefined;
                  const rowContent = (
                    <>
                      {/* Line 1: what it is + how much */}
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 flex-1 truncate font-medium text-ink900">
                          {nameById.get(l.sourceId) ?? KIND_LABEL[l.kind]}
                        </span>
                        <span
                          className={`shrink-0 font-num font-semibold ${
                            l.negative ? 'text-neg' : 'text-ink900'
                          }`}
                        >
                          {centsToDollars(l.amountCents)}
                        </span>
                      </div>
                      {/* Line 2: when + type · running balance */}
                      <div className="mt-0.5 flex items-center justify-between gap-3 text-xs text-ink600">
                        <span className="truncate">
                          {overdue ? 'Overdue — due now' : l.date} · {KIND_LABEL[l.kind]}
                          {txn && <span className="ml-1 text-violet600">· tap to edit</span>}
                        </span>
                        <span
                          className={`shrink-0 font-num ${
                            l.negative ? 'text-neg' : l.belowBuffer ? 'text-warn' : 'text-ink600'
                          }`}
                        >
                          Balance {centsToDollars(l.runningCents)}
                        </span>
                      </div>
                    </>
                  );
                  return (
                    <li key={`${l.sourceId}-${l.date}-${li}`} className="border-t border-sage/20 py-3 first:border-t-0">
                      {txn ? (
                        <EditTransaction
                          txn={txn}
                          accounts={accounts}
                          editAction={editTransaction.bind(null, txn.id)}
                          deleteAction={deleteTransaction.bind(null, txn.id)}
                        >
                          {rowContent}
                        </EditTransaction>
                      ) : (
                        rowContent
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {unconfirmedIncome.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold text-forest">Potential extra income</h2>
          <p className="mt-1 text-sm text-muted">
            Not counted in Safe to Spend — income only counts once you mark it as sure. Here so you
            can see it.
          </p>
          <ul className="mt-3 rounded-card bg-white/60 px-6 py-2 shadow-card">
            {unconfirmedIncome.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 border-t border-sage/20 py-3 first:border-t-0"
              >
                <span className="flex-1 truncate text-ink">
                  {String(r.name)}
                  <span className="ml-2 text-xs text-muted">
                    {CONFIDENCE_LABEL[String(r.confidence)] ?? 'Not counted'}
                  </span>
                </span>
                <span className="text-muted">{centsToDollars(Number(r.net_amount_cents))}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-8 space-y-3">
        <Link
          href="/plan/priorities"
          className="block rounded-2xl border border-forest px-6 py-4 text-center font-medium text-forest"
        >
          What needs your money first?
        </Link>
        <Link
          href="/plan/allocate"
          className="block rounded-2xl bg-forest px-6 py-4 text-center font-medium text-cream"
        >
          I have money — what should I pay?
        </Link>
      </div>
    </main>
  );
}
