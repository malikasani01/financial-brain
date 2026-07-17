import Link from 'next/link';
import { listOwn } from '@/lib/db';
import { listTransactions } from '@/lib/transactions';
import { centsToDollars } from '@/lib/money';
import { Card } from '@/components/ui';
import { ReconcileForm } from '@/components/ReconcileForm';
import { toggleTransactionCleared } from '@/app/actions/manage';

export const dynamic = 'force-dynamic';

export default async function ReconcilePage() {
  const [accounts, uncleared] = await Promise.all([
    listOwn('accounts', 'id,balance_cents'),
    listTransactions({ status: 'uncleared', limit: 200 }),
  ]);
  const clearedCents = accounts.reduce((t, a) => t + Number(a.balance_cents), 0);

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/accounts" className="text-sm font-bold text-violet600">← Accounts</Link>
      <h1 className="mt-3 text-2xl font-extrabold text-ink900">Reconcile</h1>
      <p className="mt-1 text-sm text-ink600">
        Optional. Compare your bank&apos;s balance to what Financial Brain has cleared, and clear
        anything that has since landed.
      </p>

      <div className="mt-5">
        <ReconcileForm clearedCents={clearedCents} />
      </div>

      <h2 className="mt-8 text-lg font-extrabold text-ink900">Not yet cleared</h2>
      {uncleared.length === 0 ? (
        <p className="mt-3 text-sm text-ink600">Everything is cleared — nothing to reconcile.</p>
      ) : (
        <Card className="mt-3">
          {uncleared.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0"
            >
              <span className="w-12 shrink-0 text-xs text-ink600">{t.txn_date.slice(5)}</span>
              <span className="flex-1 truncate text-ink900">
                {t.name ?? (t.direction === 'transfer' ? 'Transfer' : 'Transaction')}
              </span>
              <span className={`font-num ${t.direction === 'income' ? 'text-pos' : 'text-neg'}`}>
                {t.direction === 'income' ? '+' : '-'}
                {centsToDollars(t.amount_cents)}
              </span>
              <form action={toggleTransactionCleared.bind(null, t.id)}>
                <button className="rounded-full border border-pos px-3 py-1 text-xs font-bold text-pos">
                  Clear
                </button>
              </form>
            </div>
          ))}
        </Card>
      )}
    </main>
  );
}
