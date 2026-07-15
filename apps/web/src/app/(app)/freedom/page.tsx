import Link from 'next/link';
import type { BusinessScenarioInput } from '@fb/types';
import { calculateBusinessScenario, calculateFreedom } from '@fb/engine';
import { getSessionContext } from '@/lib/session';
import { centsToWholeDollars, centsToDollars } from '@/lib/money';
import { Card, Field, PrimaryButton, SelectField } from '@/components/ui';
import { addBusinessScenario, deleteScenario, saveFreedomPlan } from '@/app/actions/financial';

export const dynamic = 'force-dynamic';

interface ScenarioRow {
  id: string;
  label: string | null;
  weekly_price_cents: number | null;
  monthly_price_cents: number | null;
  annual_price_cents: number | null;
  paying_users: number | null;
  variable_cost_per_user_cents: number | null;
  fixed_monthly_cents: number | null;
}

export default async function FreedomPage() {
  const { supabase, userId } = await getSessionContext();

  const [{ data: plan }, { data: businesses }, { data: scenarioRows }] = await Promise.all([
    supabase
      .from('freedom_plans')
      .select('monthly_employment_net_cents,desired_replacement_cents,target_date')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('businesses')
      .select('monthly_revenue_cents')
      .eq('user_id', userId)
      .is('archived_at', null),
    supabase
      .from('business_scenarios')
      .select(
        'id,label,weekly_price_cents,monthly_price_cents,annual_price_cents,paying_users,variable_cost_per_user_cents,fixed_monthly_cents',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ]);

  const desired = (plan?.desired_replacement_cents as number | null) ?? 0;
  const currentBusinessIncome = ((businesses ?? []) as { monthly_revenue_cents: number }[]).reduce(
    (s, b) => s + (b.monthly_revenue_cents ?? 0),
    0,
  );
  const freedom = calculateFreedom(desired, currentBusinessIncome);

  const scenarios = ((scenarioRows ?? []) as ScenarioRow[]).map((r) => {
    const input: BusinessScenarioInput = {
      id: r.id,
      label: r.label,
      weeklyPriceCents: r.weekly_price_cents,
      monthlyPriceCents: r.monthly_price_cents,
      annualPriceCents: r.annual_price_cents,
      payingUsers: r.paying_users ?? 0,
      variableCostPerUserCents: r.variable_cost_per_user_cents ?? 0,
      fixedMonthlyCents: r.fixed_monthly_cents ?? 0,
    };
    return calculateBusinessScenario(input, freedom.freedomNumberCents);
  });

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/goals" className="text-sm text-forest underline underline-offset-4">
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-forest">My Freedom Plan</h1>

      <Card className="mt-6">
        <p className="text-sm uppercase tracking-wide text-muted">Freedom number</p>
        <p className="mt-1 text-4xl font-semibold text-forest">
          {centsToWholeDollars(freedom.freedomNumberCents)}
        </p>
        <p className="text-sm text-muted">needed per month to replace employment</p>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-sage/20 pt-4">
          <div>
            <p className="text-sm text-muted">Business income now</p>
            <p className="text-lg font-semibold text-ink">
              {centsToWholeDollars(freedom.currentBusinessIncomeCents)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted">Freedom gap</p>
            <p className="text-lg font-semibold text-terracotta">
              {centsToWholeDollars(freedom.freedomGapCents)}/mo
            </p>
          </div>
        </div>
      </Card>

      <details className="mt-4 rounded-card bg-white p-6 shadow-card">
        <summary className="cursor-pointer text-sm text-muted">Edit freedom inputs</summary>
        <form action={saveFreedomPlan} className="mt-4 grid gap-4">
          <Field
            label="Average monthly net employment income"
            name="employment_net"
            placeholder="$0.00"
          />
          <Field
            label="Desired monthly replacement income"
            name="desired_replacement"
            placeholder="$0.00"
            defaultValue={desired ? (desired / 100).toString() : ''}
          />
          <Field
            label="Current monthly business income"
            name="business_revenue"
            placeholder="$0.00"
          />
          <Field label="Target date to leave employment" name="target_date" type="date" />
          <PrimaryButton>Save</PrimaryButton>
        </form>
      </details>

      <h2 className="mt-8 text-lg font-semibold text-forest">Saylo scenarios</h2>
      <p className="mt-1 text-sm text-muted">
        Model pricing options and see how many paying customers reach your freedom number.
      </p>

      <div className="mt-4 space-y-3">
        {scenarios.map((sc) => (
          <Card key={sc.id}>
            <div className="flex items-start justify-between">
              <p className="font-medium text-ink">
                {sc.label ?? 'Scenario'} · {centsToDollars(sc.monthlyPricePerUserCents)}/mo
              </p>
              <form action={deleteScenario.bind(null, sc.id)}>
                <button className="text-sm text-terracotta">Remove</button>
              </form>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Stat label="MRR" value={centsToWholeDollars(sc.mrrCents)} />
              <Stat label="ARR" value={centsToWholeDollars(sc.arrCents)} />
              <Stat
                label="Net monthly profit"
                value={centsToWholeDollars(sc.netOperatingProfitCents)}
              />
              <Stat label="Covers freedom" value={`${sc.freedomCoveragePercent}%`} />
            </div>
            <p className="mt-3 border-t border-sage/20 pt-3 text-sm text-muted">
              {sc.customersToFreedom != null
                ? `${sc.customersToFreedom.toLocaleString('en-US')} paying customers reach your freedom number.`
                : 'These unit economics never reach the freedom number — the price is below the per-customer cost.'}
            </p>
          </Card>
        ))}
        {scenarios.length === 0 && (
          <p className="text-sm text-muted">No scenarios yet. Add one below.</p>
        )}
      </div>

      <Card className="mt-4">
        <form action={addBusinessScenario} className="grid gap-4">
          <Field label="Label" name="label" placeholder="Scenario A" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price" name="price" placeholder="$9.99" />
            <SelectField
              label="Per"
              name="price_period"
              options={[
                { value: 'monthly', label: 'Month' },
                { value: 'weekly', label: 'Week' },
                { value: 'annual', label: 'Year' },
              ]}
            />
          </div>
          <Field label="Paying users" name="paying_users" type="number" />
          <Field label="Variable cost per user / month" name="variable_cost" placeholder="$0.00" />
          <Field label="Fixed monthly business expenses" name="fixed_monthly" placeholder="$0.00" />
          <PrimaryButton>Add scenario</PrimaryButton>
        </form>
      </Card>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted">{label}</p>
      <p className="font-semibold text-ink">{value}</p>
    </div>
  );
}
