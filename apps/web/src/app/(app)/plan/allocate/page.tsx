import Link from 'next/link';
import { allocateAvailableCash } from '@fb/engine';
import { loadEngineView } from '@/lib/engine-view';
import { centsToDollars, dollarsToCents } from '@/lib/money';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AllocatePage({
  searchParams,
}: {
  searchParams: Promise<{ amount?: string }>;
}) {
  const { amount } = await searchParams;
  const hasAmount = amount != null && amount.trim() !== '';

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/plan" className="text-sm text-forest underline underline-offset-4">
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-forest">What should this money do?</h1>

      {/* GET form: navigates to ?amount=... and the server recomputes. */}
      <Card className="mt-6">
        <form method="get" className="grid gap-4">
          <label className="block">
            <span className="text-sm text-muted">How much money is available?</span>
            <input
              name="amount"
              defaultValue={amount ?? ''}
              placeholder="$0.00"
              className="mt-1 w-full rounded-2xl border border-sage/40 bg-cream/40 px-4 py-3 outline-none focus:border-forest"
            />
          </label>
          <button className="rounded-2xl bg-forest px-5 py-3 font-medium text-cream">
            Build my plan
          </button>
        </form>
      </Card>

      {hasAmount && (await AllocationResult({ dollars: amount }))}
    </main>
  );
}

async function AllocationResult({ dollars }: { dollars: string }) {
  const { input } = await loadEngineView();
  const cents = dollarsToCents(dollars);
  const result = allocateAvailableCash(cents, input);

  return (
    <div className="mt-6">
      <p className="text-sm text-muted">Recommended allocation of {centsToDollars(cents)}:</p>
      <ul className="mt-3 space-y-3">
        {result.lines.map((line, i) => (
          <li key={`${line.obligationId ?? 'buffer'}-${i}`}>
            <Card className="flex items-center justify-between">
              <div>
                <p className="font-medium text-ink">{line.label}</p>
                <p className="text-sm text-muted">{line.reason}</p>
              </div>
              <span className="text-lg font-semibold text-forest">
                {centsToDollars(line.amountCents)}
              </span>
            </Card>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">
        Protected as cash buffer: {centsToDollars(result.protectedAsBufferCents)}. This engine never
        sends every dollar to debt — near-term needs and your buffer come first.
      </p>
    </div>
  );
}
