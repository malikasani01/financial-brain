import Link from 'next/link';
import { listOwn, dollarsInput } from '@/lib/db';
import { listTransactions } from '@/lib/transactions';
import { centsToDollars } from '@/lib/money';
import { Card, Field, PrimaryButton, SelectField } from '@/components/ui';
import { AccountFields, EditForm } from '@/components/entity-fields';
import { addAccount, quickUpdateBalances, updateAccount } from '@/app/actions/financial';
import { archiveAndRecalc } from '@/app/actions/manage';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const rows = await listOwn('accounts', 'id,name,type,balance_cents');

  // Cleared = the entered balances (cleared transactions already applied).
  // Projected = cleared, adjusted for what's still uncleared.
  const uncleared = await listTransactions({ status: 'uncleared', limit: 500 });
  const clearedCents = rows.reduce((t, r) => t + Number(r.balance_cents), 0);
  const unclearedExpense = uncleared
    .filter((t) => t.direction === 'expense')
    .reduce((t, x) => t + x.amount_cents, 0);
  const unclearedIncome = uncleared
    .filter((t) => t.direction === 'income')
    .reduce((t, x) => t + x.amount_cents, 0);
  const projectedCents = clearedCents - unclearedExpense + unclearedIncome;

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/more" className="text-sm font-bold text-violet600">← More</Link>
      <h1 className="mt-3 text-2xl font-extrabold text-ink900">Accounts</h1>

      <Card className="mt-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-ink600">Cleared</p>
            <p className="mt-0.5 font-num text-lg font-bold text-ink900">{centsToDollars(clearedCents)}</p>
          </div>
          <div>
            <p className="text-xs text-ink600">Uncleared</p>
            <p className="mt-0.5 font-num text-lg font-bold text-ink900">
              {centsToDollars(unclearedIncome - unclearedExpense)}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink600">Projected</p>
            <p className="mt-0.5 font-num text-lg font-bold text-ink900">{centsToDollars(projectedCents)}</p>
          </div>
        </div>
        {uncleared.length > 0 && (
          <Link
            href="/accounts/reconcile"
            className="mt-3 block border-t border-line pt-3 text-center text-sm font-bold text-violet600"
          >
            Reconcile with your bank
          </Link>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="mt-6">
          <p className="text-sm text-muted">Update today&apos;s balances</p>
          <form action={quickUpdateBalances} className="mt-3 grid gap-3">
            {rows.map((r) => (
              <label key={r.id} className="block">
                <span className="text-sm text-ink">{String(r.name)}</span>
                <input
                  name={`balance_${r.id}`}
                  defaultValue={dollarsInput(Number(r.balance_cents))}
                  className="mt-1 w-full rounded-2xl border border-sage/40 bg-cream/40 px-4 py-3 outline-none focus:border-forest"
                />
              </label>
            ))}
            <PrimaryButton>Save balances and recalculate</PrimaryButton>
          </form>
        </Card>
      )}

      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li key={r.id}>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink">{String(r.name)}</p>
                  <p className="text-sm text-muted">{centsToDollars(Number(r.balance_cents))}</p>
                </div>
                <form action={archiveAndRecalc.bind(null, 'accounts', r.id, '/accounts')}>
                  <button className="text-sm text-terracotta">Remove</button>
                </form>
              </div>
              <EditForm action={updateAccount.bind(null, r.id)}>
                <AccountFields d={r} />
              </EditForm>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="mt-4">
        <form action={addAccount} className="grid gap-4">
          <Field label="Account name" name="name" required placeholder="Savings" />
          <SelectField
            label="Type"
            name="type"
            options={[
              { value: 'checking', label: 'Checking' },
              { value: 'savings', label: 'Savings' },
              { value: 'cash', label: 'Cash' },
              { value: 'payment_app', label: 'Venmo / payment app' },
              { value: 'other_liquid', label: 'Other liquid' },
            ]}
          />
          <Field label="Current balance" name="balance" placeholder="$0.00" />
          <PrimaryButton>Add account</PrimaryButton>
        </form>
      </Card>
    </main>
  );
}
