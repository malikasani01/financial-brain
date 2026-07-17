import Link from 'next/link';
import { listTransactions, type TransactionFilter, type TransactionRow } from '@/lib/transactions';
import { centsToDollars } from '@/lib/money';
import { Icon } from '@/components/Icon';
import { deleteTransaction, toggleTransactionCleared } from '@/app/actions/manage';

export const dynamic = 'force-dynamic';

const FILTERS: { key: string; label: string; where: TransactionFilter }[] = [
  { key: 'all', label: 'All', where: {} },
  { key: 'income', label: 'Income', where: { direction: 'income' } },
  { key: 'expense', label: 'Expenses', where: { direction: 'expense' } },
  { key: 'cleared', label: 'Cleared', where: { status: 'cleared' } },
  { key: 'uncleared', label: 'Uncleared', where: { status: 'uncleared' } },
];

function signed(t: TransactionRow): { text: string; className: string } {
  const amount = centsToDollars(t.amount_cents);
  if (t.direction === 'income') return { text: `+${amount}`, className: 'text-pos' };
  if (t.direction === 'transfer') return { text: amount, className: 'text-ink900' };
  return { text: `-${amount}`, className: 'text-neg' };
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = 'all' } = await searchParams;
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]!;
  const rows = await listTransactions({ ...active.where, limit: 200 });

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-extrabold text-ink900">Transactions</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/transactions?filter=${f.key}`}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${
              f.key === active.key ? 'bg-violet500 text-white' : 'border border-line text-ink600'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-card bg-white p-6 text-center shadow-card">
          <p className="font-bold text-ink900">No transactions yet</p>
          <p className="mt-1 text-sm text-ink600">
            Add your current bank balance, then record your first expense or income with the +
            button on Home.
          </p>
        </div>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-card bg-white shadow-card">
          {rows.map((t) => {
            const s = signed(t);
            const isCleared = t.status === 'cleared';
            return (
              <li key={t.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                <form action={toggleTransactionCleared.bind(null, t.id)}>
                  <button
                    aria-label={isCleared ? 'Mark uncleared' : 'Mark cleared'}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                      isCleared ? 'border-pos bg-pos text-white' : 'border-line text-transparent'
                    }`}
                  >
                    <Icon name="target" size={14} />
                  </button>
                </form>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink900">
                    {t.name ?? (t.direction === 'transfer' ? 'Transfer' : 'Transaction')}
                  </p>
                  <p className="truncate text-sm text-ink600">
                    {[t.category, t.txn_date, isCleared ? 'cleared' : 'uncleared']
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <span className={`shrink-0 font-num font-bold ${s.className}`}>{s.text}</span>
                <form action={deleteTransaction.bind(null, t.id)}>
                  <button aria-label="Delete" className="text-xs font-bold text-ink600">
                    Delete
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
