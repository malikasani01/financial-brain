import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionContext } from '@/lib/session';
import { STEPS, stepIndex } from '@/lib/onboarding';
import { centsToDollars } from '@/lib/money';
import { Card, CheckboxField, Field, PrimaryButton, SelectField } from '@/components/ui';
import {
  AccountFields,
  EditForm,
  GoalFields,
  IncomeFields,
  LifeCostFields,
  ObligationFields,
  SubscriptionFields,
} from '@/components/entity-fields';
import {
  addAccount,
  addGoal,
  addIncome,
  addLifeCost,
  addObligation,
  addSubscription,
  advanceOnboarding,
  archiveRow,
  saveFreedom,
  updateAccount,
  updateGoal,
  updateIncome,
  updateLifeCost,
  updateObligation,
  updateSubscription,
} from '@/app/actions/financial';

export const dynamic = 'force-dynamic';

const FREQS = [
  { value: 'ONE_TIME', label: 'One time' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Every two weeks' },
  { value: 'SEMIMONTHLY', label: 'Twice monthly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
];
const opt = (labels: string[]) => labels.map((l) => ({ value: l, label: l }));

interface Row {
  id: string;
  [k: string]: unknown;
}

async function listRows(table: string, columns: string): Promise<Row[]> {
  const { supabase, userId } = await getSessionContext();
  const { data } = await supabase
    .from(table)
    .select(columns)
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  return (data ?? []) as unknown as Row[];
}

function RowItem({
  table,
  id,
  primary,
  secondary,
  edit,
}: {
  table: string;
  id: string;
  primary: string;
  secondary: string;
  edit?: React.ReactNode;
}) {
  return (
    <li className="border-t border-sage/20 py-3 first:border-t-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-ink">{primary}</p>
          <p className="text-sm text-muted">{secondary}</p>
        </div>
        <form action={archiveRow.bind(null, table, id)}>
          <button className="text-sm text-terracotta">Remove</button>
        </form>
      </div>
      {edit}
    </li>
  );
}

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step: slug } = await params;
  const index = stepIndex(slug);
  if (index === -1) notFound();
  const step = STEPS[index]!;
  const prev = index > 0 ? STEPS[index - 1]! : null;

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <p className="text-sm text-muted">
        Step {index + 1} of {STEPS.length}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sage/20">
        <div
          className="h-full rounded-full bg-forest transition-all"
          style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <h1 className="mt-6 text-2xl font-semibold text-forest">{step.title}</h1>
      <p className="mt-1 text-muted">{step.headline}</p>
      <p className="mt-1 text-sm text-muted">{step.supporting}</p>

      <div className="mt-6 space-y-6">{await renderStep(slug)}</div>

      <div className="mt-8 flex items-center justify-between">
        {prev ? (
          <Link
            href={`/onboarding/${prev.slug}`}
            className="text-sm text-forest underline underline-offset-4"
          >
            Back
          </Link>
        ) : (
          <Link
            href="/onboarding/welcome"
            className="text-sm text-forest underline underline-offset-4"
          >
            Back
          </Link>
        )}
        <form action={advanceOnboarding.bind(null, index + 1)}>
          <PrimaryButton>
            {index === STEPS.length - 1 ? 'Build my picture' : 'Continue'}
          </PrimaryButton>
        </form>
      </div>
    </main>
  );
}

async function renderStep(slug: string) {
  switch (slug) {
    case 'accounts': {
      const rows = await listRows('accounts', 'id,name,type,balance_cents');
      return (
        <>
          <Card>
            <form action={addAccount} className="grid gap-4">
              <Field label="Account name" name="name" required placeholder="Checking" />
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
              <Field
                label="Current available balance"
                name="balance"
                type="text"
                placeholder="$0.00"
              />
              <PrimaryButton>Add another account</PrimaryButton>
            </form>
          </Card>
          <RowList empty="No accounts added yet.">
            {rows.map((r) => (
              <RowItem
                key={r.id}
                table="accounts"
                id={r.id}
                primary={String(r.name)}
                secondary={centsToDollars(Number(r.balance_cents))}
                edit={
                  <EditForm action={updateAccount.bind(null, r.id)}>
                    <AccountFields d={r} />
                  </EditForm>
                }
              />
            ))}
          </RowList>
        </>
      );
    }

    case 'income': {
      const rows = await listRows(
        'income_sources',
        'id,name,source_type,net_amount_cents,frequency,next_expected_date,confidence',
      );
      return (
        <>
          <Card>
            <form action={addIncome} className="grid gap-4">
              <Field label="Income name" name="name" required placeholder="My paycheck" />
              <SelectField
                label="Source"
                name="source_type"
                options={opt([
                  'Employment paycheck',
                  'Rental income',
                  'Spouse or household',
                  'Child support',
                  'Business income',
                  'Reimbursement',
                  'Other',
                ])}
              />
              <Field label="Net amount received" name="amount" placeholder="$0.00" />
              <SelectField
                label="Frequency"
                name="frequency"
                options={FREQS}
                defaultValue="BIWEEKLY"
              />
              <Field label="Next expected date" name="next_expected_date" type="date" />
              <SelectField
                label="How reliable is this?"
                name="confidence"
                options={[
                  { value: 'CONFIRMED', label: 'I know I will receive it' },
                  { value: 'HIGHLY_LIKELY', label: 'I expect it, but it may change' },
                  { value: 'VARIABLE', label: 'It varies' },
                  { value: 'SPECULATIVE', label: "It's only a possibility" },
                ]}
              />
              <PrimaryButton>Add income</PrimaryButton>
            </form>
          </Card>
          <RowList empty="No income added yet.">
            {rows.map((r) => (
              <RowItem
                key={r.id}
                table="income_sources"
                id={r.id}
                primary={String(r.name)}
                secondary={`${centsToDollars(Number(r.net_amount_cents))} · ${String(r.confidence)}`}
                edit={
                  <EditForm action={updateIncome.bind(null, r.id)}>
                    <IncomeFields d={r} />
                  </EditForm>
                }
              />
            ))}
          </RowList>
        </>
      );
    }

    case 'obligations': {
      const rows = await listRows(
        'obligations',
        'id,name,category,amount_due_cents,minimum_required_cents,due_date,frequency,status,is_essential,is_negotiable,days_overdue,total_past_due_cents,consequence_type,consequence_already_occurring,interest_rate',
      );
      return (
        <>
          <Card>
            <form action={addObligation} className="grid gap-4">
              <Field label="Obligation name" name="name" required placeholder="Rent" />
              <SelectField
                label="Category"
                name="category"
                options={opt([
                  'Housing',
                  'Car',
                  'Insurance',
                  'Utilities',
                  'Legal',
                  'Kids',
                  'Food',
                  'Debt',
                  'Business',
                  'Personal',
                  'Other',
                ])}
              />
              <Field label="Amount normally due" name="amount_due" placeholder="$0.00" />
              <Field
                label="Minimum to avoid trouble (cure)"
                name="minimum_required"
                placeholder="optional"
              />
              <Field label="Due date" name="due_date" type="date" />
              <SelectField
                label="Frequency"
                name="frequency"
                options={FREQS}
                defaultValue="MONTHLY"
              />
              <SelectField
                label="Status"
                name="status"
                options={[
                  { value: 'CURRENT', label: 'Current' },
                  { value: 'DUE_SOON', label: 'Due soon' },
                  { value: 'DUE', label: 'Due' },
                  { value: 'OVERDUE', label: 'Behind' },
                  { value: 'SEVERELY_OVERDUE', label: 'Severely behind' },
                  { value: 'PAUSED', label: 'Paused' },
                  { value: 'PAYMENT_PLAN', label: 'Payment plan' },
                ]}
              />
              <CheckboxField label="This is essential" name="is_essential" defaultChecked />
              <CheckboxField label="This is negotiable" name="is_negotiable" />
              <details className="rounded-2xl border border-sage/30 p-4">
                <summary className="cursor-pointer text-sm text-muted">
                  If you&apos;re behind
                </summary>
                <div className="mt-4 grid gap-4">
                  <Field label="Days overdue" name="days_overdue" type="number" />
                  <Field label="Total past due" name="total_past_due" placeholder="$0.00" />
                  <SelectField
                    label="What happens if unpaid?"
                    name="consequence_type"
                    options={opt([
                      'LATE_FEE_OR_CREDIT',
                      'SERVICE_CANCELLATION',
                      'UTILITY_SHUTOFF',
                      'INSURANCE_LAPSE',
                      'VEHICLE_REPOSSESSION',
                      'HOUSING_RISK',
                      'LEGAL_SERIOUS',
                      'ACCOUNT_DEFAULT',
                    ])}
                  />
                  <CheckboxField
                    label="The consequence is already happening"
                    name="consequence_occurring"
                  />
                  <Field
                    label="Interest rate (e.g. 0.24)"
                    name="interest_rate"
                    type="number"
                    step="0.01"
                  />
                </div>
              </details>
              <PrimaryButton>Add obligation</PrimaryButton>
            </form>
          </Card>
          <RowList empty="No obligations added yet.">
            {rows.map((r) => (
              <RowItem
                key={r.id}
                table="obligations"
                id={r.id}
                primary={`${String(r.name)} · ${String(r.category)}`}
                secondary={`${centsToDollars(Number(r.amount_due_cents ?? 0))} · ${String(r.status)}`}
                edit={
                  <EditForm action={updateObligation.bind(null, r.id)}>
                    <ObligationFields d={r} />
                  </EditForm>
                }
              />
            ))}
          </RowList>
        </>
      );
    }

    case 'life-costs': {
      const rows = await listRows(
        'life_cost_categories',
        'id,category,frequency,minimum_cents,normal_cents',
      );
      return (
        <>
          <Card>
            <form action={addLifeCost} className="grid gap-4">
              <SelectField
                label="Category"
                name="category"
                options={opt([
                  'Groceries',
                  'Gas',
                  'Eating out',
                  'Child activities',
                  'Personal care',
                  'Household',
                  'Medical basics',
                  'Miscellaneous',
                ])}
              />
              <SelectField
                label="Frequency"
                name="frequency"
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
          <RowList empty="No normal life costs added.">
            {rows.map((r) => (
              <RowItem
                key={r.id}
                table="life_cost_categories"
                id={r.id}
                primary={String(r.category)}
                secondary={`min ${centsToDollars(Number(r.minimum_cents))} · normal ${centsToDollars(Number(r.normal_cents))}`}
                edit={
                  <EditForm action={updateLifeCost.bind(null, r.id)}>
                    <LifeCostFields d={r} />
                  </EditForm>
                }
              />
            ))}
          </RowList>
        </>
      );
    }

    case 'subscriptions': {
      const rows = await listRows(
        'subscriptions',
        'id,name,amount_cents,frequency,next_charge_date,purpose,pause_preference',
      );
      return (
        <>
          <Card>
            <form action={addSubscription} className="grid gap-4">
              <Field
                label="Subscription name"
                name="name"
                required
                placeholder="Coaching program"
              />
              <Field label="Amount" name="amount" placeholder="$0.00" />
              <SelectField
                label="Frequency"
                name="frequency"
                options={FREQS}
                defaultValue="MONTHLY"
              />
              <Field label="Next charge date" name="next_charge_date" type="date" />
              <SelectField
                label="What does this help with?"
                name="purpose"
                options={opt([
                  'Essential life',
                  'Current income',
                  "Business I'm building",
                  'Health',
                  'Personal growth',
                  'Entertainment',
                  'Other',
                ])}
              />
              <SelectField
                label="How would you feel about pausing?"
                name="pause_preference"
                options={opt([
                  'Cannot pause',
                  'Strongly prefer to keep',
                  'Open to pausing',
                  'Easy to cancel',
                ])}
              />
              <PrimaryButton>Add subscription</PrimaryButton>
            </form>
          </Card>
          <RowList empty="No subscriptions added.">
            {rows.map((r) => (
              <RowItem
                key={r.id}
                table="subscriptions"
                id={r.id}
                primary={String(r.name)}
                secondary={centsToDollars(Number(r.amount_cents))}
                edit={
                  <EditForm action={updateSubscription.bind(null, r.id)}>
                    <SubscriptionFields d={r} />
                  </EditForm>
                }
              />
            ))}
          </RowList>
        </>
      );
    }

    case 'goals': {
      const rows = await listRows(
        'goals',
        'id,name,category,target_cents,saved_cents,target_date,personal_priority,committed_per_paycheck_cents',
      );
      return (
        <>
          <Card>
            <form action={addGoal} className="grid gap-4">
              <Field label="Goal name" name="name" required placeholder="Immigration fund" />
              <SelectField
                label="Category"
                name="category"
                options={opt([
                  'Legal or immigration',
                  'Emergency savings',
                  'Debt stabilization',
                  'Business',
                  'Property',
                  'Financial freedom',
                  'Lifestyle',
                  'Other',
                ])}
              />
              <Field label="Target amount" name="target" placeholder="$0.00" />
              <Field label="Current saved amount" name="saved" placeholder="$0.00" />
              <Field label="Target date" name="target_date" type="date" />
              <SelectField
                label="How important is this?"
                name="personal_priority"
                options={[
                  { value: 'NON_NEGOTIABLE', label: 'Non-negotiable' },
                  { value: 'VERY_IMPORTANT', label: 'Very important' },
                  { value: 'IMPORTANT', label: 'Important' },
                  { value: 'NICE_TO_HAVE', label: 'Nice to have' },
                ]}
              />
              <Field
                label="Committed amount per paycheck (optional)"
                name="committed_per_paycheck"
                placeholder="$0.00"
              />
              <PrimaryButton>Add goal</PrimaryButton>
            </form>
          </Card>
          <RowList empty="No goals added.">
            {rows.map((r) => (
              <RowItem
                key={r.id}
                table="goals"
                id={r.id}
                primary={String(r.name)}
                secondary={`${centsToDollars(Number(r.saved_cents))} / ${centsToDollars(Number(r.target_cents))}`}
                edit={
                  <EditForm action={updateGoal.bind(null, r.id)}>
                    <GoalFields d={r} />
                  </EditForm>
                }
              />
            ))}
          </RowList>
        </>
      );
    }

    case 'freedom': {
      return (
        <Card>
          <form action={saveFreedom} className="grid gap-4">
            <Field
              label="Average monthly net employment income"
              name="employment_net"
              placeholder="$0.00"
            />
            <Field
              label="Desired monthly replacement income"
              name="desired_replacement"
              placeholder="$0.00"
            />
            <Field
              label="Target date to leave employment (optional)"
              name="target_date"
              type="date"
            />
            <div className="border-t border-sage/20 pt-4">
              <p className="text-sm text-muted">Optional: a business you&apos;re building</p>
              <div className="mt-3 grid gap-4">
                <Field label="Business name" name="business_name" placeholder="Saylo" />
                <Field
                  label="Current monthly revenue"
                  name="business_revenue"
                  placeholder="$0.00"
                />
                <Field
                  label="Current monthly operating expenses"
                  name="business_opex"
                  placeholder="$0.00"
                />
              </div>
            </div>
            <PrimaryButton>Save</PrimaryButton>
          </form>
        </Card>
      );
    }

    default:
      notFound();
  }
}

function RowList({ children, empty }: { children: React.ReactNode; empty: string }) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.some((c) => c);
  if (!hasItems || (Array.isArray(children) && children.length === 0)) {
    return <p className="text-sm text-muted">{empty}</p>;
  }
  return <ul className="rounded-card bg-white/60 px-6 py-2 shadow-card">{children}</ul>;
}
