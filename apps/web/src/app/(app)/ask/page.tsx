import { Card, Field, PrimaryButton, SelectField } from '@/components/ui';
import { checkPurchase } from '@/app/actions/financial';

export const dynamic = 'force-dynamic';

const opt = (labels: [string, string][]) => labels.map(([value, label]) => ({ value, label }));

export default function AskPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold text-forest">What are you thinking about?</h1>
      <p className="mt-1 text-muted">Check what it does to your next 90 days before you decide.</p>

      <Card className="mt-6">
        <form action={checkPurchase} className="grid gap-4">
          <Field
            label="What do you want to buy or pay for?"
            name="name"
            required
            placeholder="New laptop"
          />
          <Field label="Amount" name="amount" placeholder="$0.00" required />
          <SelectField
            label="Type"
            name="decision_type"
            options={opt([
              ['ONE_TIME', 'One-time purchase'],
              ['SUBSCRIPTION', 'Subscription'],
              ['PAYMENT_PLAN', 'Payment plan'],
              ['LOAN', 'Loan'],
              ['INCREASE_EXPENSE', 'Increase an existing expense'],
              ['RESTART_EXPENSE', 'Restart a paused expense'],
              ['OTHER', 'Other'],
            ])}
          />
          <SelectField
            label="Purpose"
            name="purpose"
            options={opt([
              ['ESSENTIAL', 'Essential'],
              ['FAMILY', 'Family'],
              ['BUSINESS', 'Business'],
              ['PERSONAL_GROWTH', 'Personal growth'],
              ['HEALTH', 'Health'],
              ['FUN', 'Fun'],
              ['OTHER', 'Other'],
            ])}
          />
          <details className="rounded-2xl border border-sage/30 p-4">
            <summary className="cursor-pointer text-sm text-muted">
              If it&apos;s financed or recurring
            </summary>
            <div className="mt-4 grid gap-4">
              <Field label="Monthly payment" name="monthly_payment" placeholder="$0.00" />
              <Field label="Number of payments (months)" name="term_months" type="number" />
            </div>
          </details>
          <Field label="Why do you want or need it? (optional)" name="note" placeholder="" />
          <PrimaryButton>Check this decision</PrimaryButton>
        </form>
      </Card>
    </main>
  );
}
