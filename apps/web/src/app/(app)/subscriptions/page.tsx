import Link from 'next/link';
import type { Frequency } from '@fb/types';
import { monthlyEquivalentRaw } from '@fb/engine';
import { listOwn } from '@/lib/db';
import { centsToDollars, centsToWholeDollars } from '@/lib/money';
import { Card, Field, PrimaryButton, SelectField } from '@/components/ui';
import { SubscriptionFields, EditForm } from '@/components/entity-fields';
import { addSubscription, updateSubscription } from '@/app/actions/financial';
import { archiveAndRecalc, setSubscriptionPaused } from '@/app/actions/manage';

export const dynamic = 'force-dynamic';

export default async function SubscriptionsPage() {
  const rows = await listOwn(
    'subscriptions',
    'id,name,amount_cents,frequency,next_charge_date,purpose,pause_preference,paused',
  );

  const pausableMonthly = rows
    .filter((r) => !r.paused)
    .reduce(
      (s, r) => s + monthlyEquivalentRaw(Number(r.amount_cents), r.frequency as Frequency),
      0,
    );

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/settings" className="text-sm text-forest underline underline-offset-4">
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-forest">Subscriptions</h1>

      {pausableMonthly > 0 && (
        <p className="mt-3 rounded-2xl bg-sage/15 px-4 py-3 text-sm text-forest">
          Pausing your active subscriptions could free about{' '}
          {centsToWholeDollars(Math.round(pausableMonthly))} per month. This is informational — you
          choose what to pause.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink">
                    {String(r.name)}
                    {r.paused ? ' · paused' : ''}
                  </p>
                  <p className="text-sm text-muted">
                    {centsToDollars(Number(r.amount_cents))} · {String(r.purpose ?? '')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <form action={setSubscriptionPaused.bind(null, r.id, !r.paused)}>
                    <button className="text-sm text-forest underline">
                      {r.paused ? 'Resume' : 'Pause'}
                    </button>
                  </form>
                  <form
                    action={archiveAndRecalc.bind(null, 'subscriptions', r.id, '/subscriptions')}
                  >
                    <button className="text-sm text-terracotta">Cancel</button>
                  </form>
                </div>
              </div>
              <EditForm action={updateSubscription.bind(null, r.id)}>
                <SubscriptionFields d={r} />
              </EditForm>
            </Card>
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-muted">No subscriptions yet.</li>}
      </ul>

      <Card className="mt-4">
        <form action={addSubscription} className="grid gap-4">
          <Field label="Subscription name" name="name" required placeholder="Coaching program" />
          <Field label="Amount" name="amount" placeholder="$0.00" />
          <SelectField
            label="Frequency"
            name="frequency"
            defaultValue="MONTHLY"
            options={[
              { value: 'WEEKLY', label: 'Weekly' },
              { value: 'BIWEEKLY', label: 'Every two weeks' },
              { value: 'MONTHLY', label: 'Monthly' },
              { value: 'ANNUAL', label: 'Annual' },
            ]}
          />
          <Field label="Next charge date" name="next_charge_date" type="date" />
          <PrimaryButton>Add subscription</PrimaryButton>
        </form>
      </Card>
    </main>
  );
}
