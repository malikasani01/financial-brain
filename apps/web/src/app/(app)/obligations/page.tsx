import Link from 'next/link';
import { listOwn } from '@/lib/db';
import { centsToDollars } from '@/lib/money';
import { Card, Field, PrimaryButton, SelectField } from '@/components/ui';
import {
  archiveAndRecalc,
  markObligationResolved,
  recordObligationPayment,
} from '@/app/actions/manage';

export const dynamic = 'force-dynamic';

export default async function ObligationsPage() {
  const [rows, accounts] = await Promise.all([
    listOwn(
      'obligations',
      'id,name,category,amount_due_cents,minimum_required_cents,status,resolved',
    ),
    listOwn('accounts', 'id,name'),
  ]);
  const accountOptions = accounts.map((a) => ({ value: a.id, label: String(a.name) }));

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/settings" className="text-sm text-forest underline underline-offset-4">
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-forest">Obligations</h1>

      <ul className="mt-6 space-y-3">
        {rows.map((r) => {
          const cure =
            (r.minimum_required_cents as number | null) ??
            (r.amount_due_cents as number | null) ??
            0;
          return (
            <li key={r.id}>
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-ink">
                      {String(r.name)}
                      {r.resolved ? ' · resolved' : ''}
                    </p>
                    <p className="text-sm text-muted">
                      {String(r.category)} · {String(r.status)} · {centsToDollars(cure)}
                    </p>
                  </div>
                  <form action={archiveAndRecalc.bind(null, 'obligations', r.id, '/obligations')}>
                    <button className="text-sm text-terracotta">Remove</button>
                  </form>
                </div>

                {!r.resolved && (
                  <div className="mt-3 flex items-center gap-4 border-t border-sage/20 pt-3">
                    <details className="flex-1">
                      <summary className="cursor-pointer text-sm text-forest">
                        Record payment
                      </summary>
                      <form action={recordObligationPayment} className="mt-3 grid gap-3">
                        <input type="hidden" name="obligation_id" value={r.id} />
                        <Field
                          label="Amount paid"
                          name="amount"
                          defaultValue={cure ? (cure / 100).toString() : ''}
                        />
                        <Field label="Payment date" name="payment_date" type="date" />
                        {accountOptions.length > 0 && (
                          <SelectField
                            label="From account"
                            name="account_id"
                            options={accountOptions}
                          />
                        )}
                        <SelectField
                          label="Did this resolve it?"
                          name="resolved"
                          options={[
                            { value: 'YES', label: 'Yes' },
                            { value: 'PARTIAL', label: 'Partially' },
                            { value: 'NO', label: 'No' },
                          ]}
                        />
                        <PrimaryButton>Record payment</PrimaryButton>
                      </form>
                    </details>
                    <form action={markObligationResolved.bind(null, r.id)}>
                      <button className="text-sm text-forest underline">Mark resolved</button>
                    </form>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
        {rows.length === 0 && <li className="text-sm text-muted">No obligations yet.</li>}
      </ul>

      <p className="mt-6 text-sm text-muted">
        Add new obligations during setup or from the onboarding flow. This screen manages the ones
        you already have.
      </p>
    </main>
  );
}
