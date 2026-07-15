import Link from 'next/link';
import { listOwn } from '@/lib/db';
import { centsToDollars } from '@/lib/money';
import { Card, Field, PrimaryButton, SelectField } from '@/components/ui';
import { addLifeCost } from '@/app/actions/financial';
import { archiveAndRecalc, setLifeCostPlanning } from '@/app/actions/manage';

export const dynamic = 'force-dynamic';

const MODE_LABEL: Record<string, string> = {
  MIN: 'Minimum',
  NORMAL: 'Normal',
  CUSTOM: 'Custom',
  STAGE_DEFAULT: 'Auto (by stage)',
};

export default async function LifeCostsPage() {
  const rows = await listOwn(
    'life_cost_categories',
    'id,category,frequency,minimum_cents,normal_cents,planning_mode,custom_cents',
  );

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/settings" className="text-sm text-forest underline underline-offset-4">
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-forest">Normal life costs</h1>

      <ul className="mt-6 space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink">{String(r.category)}</p>
                  <p className="text-sm text-muted">
                    min {centsToDollars(Number(r.minimum_cents))} · normal{' '}
                    {centsToDollars(Number(r.normal_cents))} · {MODE_LABEL[String(r.planning_mode)]}
                  </p>
                </div>
                <form
                  action={archiveAndRecalc.bind(null, 'life_cost_categories', r.id, '/life-costs')}
                >
                  <button className="text-sm text-terracotta">Remove</button>
                </form>
              </div>
              <details className="mt-3 border-t border-sage/20 pt-3">
                <summary className="cursor-pointer text-sm text-forest">Planning amount</summary>
                <form action={setLifeCostPlanning} className="mt-3 grid gap-3">
                  <input type="hidden" name="id" value={r.id} />
                  <SelectField
                    label="Use"
                    name="planning_mode"
                    defaultValue={String(r.planning_mode)}
                    options={[
                      { value: 'STAGE_DEFAULT', label: 'Auto (by financial stage)' },
                      { value: 'MIN', label: 'Minimum' },
                      { value: 'NORMAL', label: 'Normal' },
                      { value: 'CUSTOM', label: 'Custom amount' },
                    ]}
                  />
                  <Field label="Custom amount (if custom)" name="custom" placeholder="$0.00" />
                  <PrimaryButton>Save</PrimaryButton>
                </form>
              </details>
            </Card>
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-muted">No life costs yet.</li>}
      </ul>

      <Card className="mt-4">
        <form action={addLifeCost} className="grid gap-4">
          <SelectField
            label="Category"
            name="category"
            options={[
              'Groceries',
              'Gas',
              'Eating out',
              'Child activities',
              'Personal care',
              'Household',
              'Medical basics',
              'Miscellaneous',
            ].map((c) => ({ value: c, label: c }))}
          />
          <SelectField
            label="Frequency"
            name="frequency"
            defaultValue="WEEKLY"
            options={[
              { value: 'WEEKLY', label: 'Weekly' },
              { value: 'BIWEEKLY', label: 'Per paycheck' },
              { value: 'MONTHLY', label: 'Monthly' },
            ]}
          />
          <Field label="Minimum realistic amount" name="minimum" placeholder="$0.00" />
          <Field label="Normal comfortable amount" name="normal" placeholder="$0.00" />
          <PrimaryButton>Add life cost</PrimaryButton>
        </form>
      </Card>
    </main>
  );
}
