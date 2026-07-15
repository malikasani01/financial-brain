import Link from 'next/link';
import { listOwn, dollarsInput } from '@/lib/db';
import { centsToDollars } from '@/lib/money';
import { Card, Field, PrimaryButton, SelectField } from '@/components/ui';
import { addAccount, quickUpdateBalances } from '@/app/actions/financial';
import { archiveAndRecalc } from '@/app/actions/manage';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const rows = await listOwn('accounts', 'id,name,type,balance_cents');

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/settings" className="text-sm text-forest underline underline-offset-4">
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-forest">Accounts</h1>

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
            <Card className="flex items-center justify-between">
              <div>
                <p className="text-ink">{String(r.name)}</p>
                <p className="text-sm text-muted">{centsToDollars(Number(r.balance_cents))}</p>
              </div>
              <form action={archiveAndRecalc.bind(null, 'accounts', r.id, '/accounts')}>
                <button className="text-sm text-terracotta">Remove</button>
              </form>
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
