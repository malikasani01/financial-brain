import Link from 'next/link';
import { latestSnapshot } from '@fb/data';
import { getSessionContext } from '@/lib/session';
import { centsToWholeDollars } from '@/lib/money';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

const STAGE_LABEL: Record<string, string> = {
  CRITICAL: 'Critical Mode',
  STABILIZING: 'Stabilization Mode',
  STABLE: 'Stable',
  BUILDING_FREEDOM: 'Building Freedom',
};

export default async function TruthPage() {
  const { supabase, userId } = await getSessionContext();
  const snapshot = await latestSnapshot(supabase, userId);

  if (!snapshot) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-muted">
          I need a little more information before I can calculate anything.
        </p>
        <Link href="/onboarding/accounts" className="mt-4 inline-block text-forest underline">
          Finish setup
        </Link>
      </main>
    );
  }

  const s = snapshot.safeToSpend;
  const urgent = snapshot.urgency.filter((u) => u.score >= 70).length;

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="text-2xl font-semibold text-forest">Here is where you are today</h1>

      <Card className="mt-6">
        <p className="text-sm uppercase tracking-wide text-muted">Financial stage</p>
        <p className="mt-1 text-3xl font-semibold text-forest">
          {STAGE_LABEL[snapshot.stage.stage]}
        </p>
        {snapshot.stage.reasons[0] && (
          <p className="mt-2 text-sm text-muted">{snapshot.stage.reasons[0]}</p>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Stat label="Cash available" value={centsToWholeDollars(s.currentLiquidCashCents)} />
        <Stat label="Safe to spend" value={centsToWholeDollars(s.safeToSpendCents)} accent />
        <Stat label="Critical items" value={String(urgent)} />
        <Stat label="Safety buffer" value={centsToWholeDollars(s.safetyBufferCents)} />
      </div>

      <Link
        href="/home"
        className="mt-8 inline-block rounded-2xl bg-forest px-6 py-4 text-center font-medium text-cream"
      >
        Show me what to do next
      </Link>
    </main>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-card bg-white p-5 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ? 'text-forest' : 'text-ink'}`}>
        {value}
      </p>
    </div>
  );
}
