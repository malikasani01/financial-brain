import type { ReactNode } from 'react';
import { dollarsInput } from '@/lib/db';
import { CheckboxField, Field, PrimaryButton, SelectField } from '@/components/ui';

/**
 * Prefillable form-field groups, one per entity. Each takes a DB row (`d`) and
 * renders the same inputs the add forms use, defaulted to current values, so a
 * single set of fields powers every edit form in onboarding and the management
 * screens. Field `name`s match the add* / update* server-action parsers.
 */

type Row = Record<string, unknown> | undefined;

const str = (v: unknown): string | undefined => (v == null ? undefined : String(v));
const dollars = (v: unknown): string => dollarsInput(v == null ? null : Number(v));

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

/** An "Edit" disclosure containing a prefilled form that saves on submit. */
export function EditForm({
  action,
  children,
}: {
  action: (fd: FormData) => Promise<void>;
  children: ReactNode;
}) {
  return (
    <details className="mt-3 border-t border-sage/20 pt-3">
      <summary className="cursor-pointer text-sm text-forest">Edit</summary>
      <form action={action} className="mt-3 grid gap-3">
        {children}
        <PrimaryButton>Save changes</PrimaryButton>
      </form>
    </details>
  );
}

export function AccountFields({ d }: { d?: Row }) {
  return (
    <>
      <Field label="Account name" name="name" required defaultValue={str(d?.name)} />
      <SelectField
        label="Type"
        name="type"
        defaultValue={str(d?.type)}
        options={[
          { value: 'checking', label: 'Checking' },
          { value: 'savings', label: 'Savings' },
          { value: 'cash', label: 'Cash' },
          { value: 'payment_app', label: 'Venmo / payment app' },
          { value: 'other_liquid', label: 'Other liquid' },
        ]}
      />
      <Field label="Current available balance" name="balance" defaultValue={dollars(d?.balance_cents)} />
    </>
  );
}

export function IncomeFields({ d }: { d?: Row }) {
  return (
    <>
      <Field label="Income name" name="name" required defaultValue={str(d?.name)} />
      <SelectField
        label="Source"
        name="source_type"
        defaultValue={str(d?.source_type)}
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
      <Field label="Net amount received" name="amount" defaultValue={dollars(d?.net_amount_cents)} />
      <SelectField label="Frequency" name="frequency" options={FREQS} defaultValue={str(d?.frequency)} />
      <Field
        label="Next expected date"
        name="next_expected_date"
        type="date"
        defaultValue={str(d?.next_expected_date)}
      />
      <SelectField
        label="How reliable is this?"
        name="confidence"
        defaultValue={str(d?.confidence)}
        options={[
          { value: 'CONFIRMED', label: 'I know I will receive it' },
          { value: 'HIGHLY_LIKELY', label: 'I expect it, but it may change' },
          { value: 'VARIABLE', label: 'It varies' },
          { value: 'SPECULATIVE', label: "It's only a possibility" },
        ]}
      />
    </>
  );
}

export function ObligationFields({ d }: { d?: Row }) {
  return (
    <>
      <Field label="Obligation name" name="name" required defaultValue={str(d?.name)} />
      <SelectField
        label="Category"
        name="category"
        defaultValue={str(d?.category)}
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
      <Field label="Amount normally due" name="amount_due" defaultValue={dollars(d?.amount_due_cents)} />
      <Field
        label="Minimum to avoid trouble (cure)"
        name="minimum_required"
        defaultValue={dollars(d?.minimum_required_cents)}
      />
      <Field label="Due date" name="due_date" type="date" defaultValue={str(d?.due_date)} />
      <SelectField label="Frequency" name="frequency" options={FREQS} defaultValue={str(d?.frequency)} />
      <SelectField
        label="Status"
        name="status"
        defaultValue={str(d?.status)}
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
      <CheckboxField label="This is essential" name="is_essential" defaultChecked={d?.is_essential === true} />
      <CheckboxField
        label="This is negotiable"
        name="is_negotiable"
        defaultChecked={d?.is_negotiable === true}
      />
      <details className="rounded-2xl border border-sage/30 p-4">
        <summary className="cursor-pointer text-sm text-muted">If you&apos;re behind</summary>
        <div className="mt-4 grid gap-4">
          <Field
            label="Days overdue"
            name="days_overdue"
            type="number"
            defaultValue={str(d?.days_overdue)}
          />
          <Field
            label="Total past due"
            name="total_past_due"
            defaultValue={dollars(d?.total_past_due_cents)}
          />
          <SelectField
            label="What happens if unpaid?"
            name="consequence_type"
            defaultValue={str(d?.consequence_type)}
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
            defaultChecked={d?.consequence_already_occurring === true}
          />
          <Field
            label="Interest rate (e.g. 0.24)"
            name="interest_rate"
            type="number"
            step="0.01"
            defaultValue={str(d?.interest_rate)}
          />
        </div>
      </details>
    </>
  );
}

export function LifeCostFields({ d }: { d?: Row }) {
  return (
    <>
      <SelectField
        label="Category"
        name="category"
        defaultValue={str(d?.category)}
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
        defaultValue={str(d?.frequency)}
        options={[
          { value: 'WEEKLY', label: 'Weekly' },
          { value: 'BIWEEKLY', label: 'Per paycheck' },
          { value: 'MONTHLY', label: 'Monthly' },
        ]}
      />
      <Field label="Minimum realistic amount" name="minimum" defaultValue={dollars(d?.minimum_cents)} />
      <Field label="Normal comfortable amount" name="normal" defaultValue={dollars(d?.normal_cents)} />
    </>
  );
}

export function SubscriptionFields({ d }: { d?: Row }) {
  return (
    <>
      <Field label="Subscription name" name="name" required defaultValue={str(d?.name)} />
      <Field label="Amount" name="amount" defaultValue={dollars(d?.amount_cents)} />
      <SelectField label="Frequency" name="frequency" options={FREQS} defaultValue={str(d?.frequency)} />
      <Field
        label="Next charge date"
        name="next_charge_date"
        type="date"
        defaultValue={str(d?.next_charge_date)}
      />
      <SelectField
        label="What does this help with?"
        name="purpose"
        defaultValue={str(d?.purpose)}
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
        defaultValue={str(d?.pause_preference)}
        options={opt(['Cannot pause', 'Strongly prefer to keep', 'Open to pausing', 'Easy to cancel'])}
      />
    </>
  );
}

export function GoalFields({ d }: { d?: Row }) {
  return (
    <>
      <Field label="Goal name" name="name" required defaultValue={str(d?.name)} />
      <SelectField
        label="Category"
        name="category"
        defaultValue={str(d?.category)}
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
      <Field label="Target amount" name="target" defaultValue={dollars(d?.target_cents)} />
      <Field label="Current saved amount" name="saved" defaultValue={dollars(d?.saved_cents)} />
      <Field label="Target date" name="target_date" type="date" defaultValue={str(d?.target_date)} />
      <SelectField
        label="How important is this?"
        name="personal_priority"
        defaultValue={str(d?.personal_priority)}
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
        defaultValue={dollars(d?.committed_per_paycheck_cents)}
      />
    </>
  );
}
