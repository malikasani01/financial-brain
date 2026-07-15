import Link from 'next/link';
import { listOwn } from '@/lib/db';
import { centsToDollars } from '@/lib/money';
import { Card, Field, PrimaryButton, SelectField } from '@/components/ui';
import { addIncome } from '@/app/actions/financial';
import { archiveAndRecalc, markIncomeReceived } from '@/app/actions/manage';

export const dynamic = 'force-dynamic';

const FREQS = [
  { value: 'ONE_TIME', label: 'One time' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Every two weeks' },
  { value: 'SEMIMONTHLY', label: 'Twice monthly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

export default async function IncomePage() {
  const [rows, accounts] = await Promise.all([
    listOwn('income_sources', 'id,name,net_amount_cents,confidence,next_expected_date'),
    listOwn('accounts', 'id,name'),
  ]);
  const accountOptions = accounts.map((a) => ({ value: a.id, label: String(a.name) }));

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/settings" className="text-sm text-forest underline underline-offset-4">
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-forest">Income</h1>

      <ul className="mt-6 space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink">{String(r.name)}</p>
                  <p className="text-sm text-muted">
                    {centsToDollars(Number(r.net_amount_cents))} · {String(r.confidence)}
                  </p>
                </div>
                <form action={archiveAndRecalc.bind(null, 'income_sources', r.id, '/income')}>
                  <button className="text-sm text-terracotta">Remove</button>
                </form>
              </div>
              <details className="mt-3 border-t border-sage/20 pt-3">
                <summary className="cursor-pointer text-sm text-forest">Mark received</summary>
                <form action={markIncomeReceived} className="mt-3 grid gap-3">
                  <input type="hidden" name="income_source_id" value={r.id} />
                  <Field
                    label="Amount received"
                    name="amount"
                    defaultValue={(Number(r.net_amount_cents) / 100).toString()}
                  />
                  <Field label="Date received" name="received_date" type="date" />
                  {accountOptions.length > 0 && (
                    <SelectField label="Into account" name="account_id" options={accountOptions} />
                  )}
                  <PrimaryButton>Record deposit</PrimaryButton>
                </form>
              </details>
            </Card>
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-muted">No income sources yet.</li>}
      </ul>

      <Card className="mt-4">
        <form action={addIncome} className="grid gap-4">
          <Field label="Income name" name="name" required placeholder="Rental income" />
          <Field label="Net amount" name="amount" placeholder="$0.00" />
          <SelectField label="Frequency" name="frequency" options={FREQS} defaultValue="MONTHLY" />
          <Field label="Next expected date" name="next_expected_date" type="date" />
          <SelectField
            label="Reliability"
            name="confidence"
            options={[
              { value: 'CONFIRMED', label: 'I know I will receive it' },
              { value: 'HIGHLY_LIKELY', label: 'Expect it, may change' },
              { value: 'VARIABLE', label: 'It varies' },
              { value: 'SPECULATIVE', label: 'Only a possibility' },
            ]}
          />
          <PrimaryButton>Add income</PrimaryButton>
        </form>
      </Card>
    </main>
  );
}
