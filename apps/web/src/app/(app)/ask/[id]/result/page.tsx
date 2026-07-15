import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PurchaseResult } from '@fb/types';
import { getSessionContext } from '@/lib/session';
import { centsToDollars, centsToWholeDollars } from '@/lib/money';
import { Card } from '@/components/ui';
import { addPurchaseToPlan } from '@/app/actions/financial';

export const dynamic = 'force-dynamic';

const STATE_STYLE = {
  GREEN: { title: 'Financially safe', accent: 'text-forest', chip: 'bg-forest/10 text-forest' },
  YELLOW: {
    title: 'You can do this, but there is a tradeoff',
    accent: 'text-terracotta',
    chip: 'bg-terracotta/10 text-terracotta',
  },
  RED: {
    title: 'Not recommended right now',
    accent: 'text-terracotta',
    chip: 'bg-terracotta/15 text-terracotta',
  },
} as const;

export default async function DecisionResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await getSessionContext();
  const { data } = await supabase
    .from('purchase_decisions')
    .select('name,amount_cents,result_state,result_json,chose_buy_anyway')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) notFound();

  const row = data as {
    name: string;
    amount_cents: number;
    result_state: 'GREEN' | 'YELLOW' | 'RED';
    result_json: PurchaseResult;
    chose_buy_anyway: boolean;
  };
  const r = row.result_json;
  const style = STATE_STYLE[row.result_state];

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${style.chip}`}>
        {row.result_state}
      </span>
      <h1 className={`mt-3 text-2xl font-semibold ${style.accent}`}>{style.title}</h1>
      <p className="mt-1 text-muted">
        {row.name} · {centsToWholeDollars(row.amount_cents)}
      </p>

      <Card className="mt-6">
        <Row label="Safe to spend before" value={centsToDollars(r.safeToSpendBeforeCents)} />
        <Row label="Safe to spend after" value={centsToDollars(r.safeToSpendAfterCents)} />
        <Row label="Lowest cash after" value={centsToDollars(r.lowestCashAfterCents)} />
        {r.dailyFlexBeforeCents != null && r.dailyFlexAfterCents != null && (
          <Row
            label="Daily flexibility"
            value={`${centsToDollars(r.dailyFlexBeforeCents)} → ${centsToDollars(r.dailyFlexAfterCents)}`}
          />
        )}
      </Card>

      {r.reasons.length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Why</h2>
          <ul className="mt-2 space-y-2">
            {r.reasons.map((reason, i) => (
              <li
                key={i}
                className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-ink shadow-card"
              >
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {row.result_state === 'GREEN' ? (
          <form action={addPurchaseToPlan.bind(null, id, false)}>
            <button className="w-full rounded-2xl bg-forest px-6 py-4 font-medium text-cream">
              Add purchase to my plan
            </button>
          </form>
        ) : (
          <form action={addPurchaseToPlan.bind(null, id, true)}>
            <button className="w-full rounded-2xl border border-forest px-6 py-4 font-medium text-forest">
              Buy anyway — add it to my plan
            </button>
          </form>
        )}
        <Link href="/home" className="block py-2 text-center text-sm text-forest underline">
          Not now
        </Link>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        You&apos;re always in control. Adding it keeps your forecast accurate.
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-sage/20 py-3 first:border-t-0">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}
