import Link from 'next/link';
import { loadEngineView } from '@/lib/engine-view';
import { centsToDollars } from '@/lib/money';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function PrioritiesPage() {
  const { output, input } = await loadEngineView();
  const urgencyById = new Map(output.urgency.map((u) => [u.obligationId, u]));

  const items = input.obligations
    .filter((o) => !o.resolved)
    .map((o) => {
      const u = urgencyById.get(o.id);
      return {
        id: o.id,
        name: o.name,
        category: o.category,
        status: o.status,
        amount: o.minimumRequiredCents ?? o.amountDueCents ?? null,
        score: u?.score ?? 0,
        unknown: u?.unknownFactors ?? [],
      };
    })
    .sort((a, b) => b.score - a.score);

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link href="/plan" className="text-sm text-forest underline underline-offset-4">
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-forest">What needs your money first?</h1>

      {items.length === 0 ? (
        <p className="mt-6 text-muted">
          You&apos;re current on your obligations. Your next focus is your buffer and goals.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((it) => (
            <li key={it.id}>
              <Card>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-ink">{it.name}</p>
                    <p className="text-sm text-muted">
                      {it.category} · {it.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-forest">{it.score}</p>
                    <p className="text-xs text-muted">urgency</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-sage/20 pt-3">
                  <span className="text-sm text-muted">Amount needed</span>
                  <span className="text-ink">
                    {it.amount != null ? centsToDollars(it.amount) : 'Unknown'}
                  </span>
                </div>
                {it.unknown.length > 0 && (
                  <p className="mt-2 text-sm text-terracotta">Needs: {it.unknown.join(', ')}</p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/plan/allocate"
        className="mt-8 block rounded-2xl bg-forest px-6 py-4 text-center font-medium text-cream"
      >
        I have money. What should I pay?
      </Link>
    </main>
  );
}
