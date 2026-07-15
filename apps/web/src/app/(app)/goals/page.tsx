import Link from 'next/link';
import { loadEngineView } from '@/lib/engine-view';
import { centsToWholeDollars } from '@/lib/money';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  ON_TRACK: 'On track',
  AT_RISK: 'At risk',
  OFF_TRACK: 'Off track',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
};

export default async function GoalsPage() {
  const { input, output } = await loadEngineView();
  const feasByGoal = new Map(output.goalFeasibility.map((f) => [f.goalId, f]));

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-forest">Goals</h1>
        <Link href="/freedom" className="text-sm text-forest underline underline-offset-4">
          My Freedom Plan
        </Link>
      </div>

      {input.goals.length === 0 ? (
        <p className="mt-6 text-muted">
          What are you building toward? Add a goal in setup and I&apos;ll show what it needs from
          each paycheck.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {input.goals.map((g) => {
            const f = feasByGoal.get(g.id);
            const pct = g.targetCents > 0 ? Math.min(100, (g.savedCents / g.targetCents) * 100) : 0;
            return (
              <li key={g.id}>
                <Link href={`/goals/${g.id}`}>
                  <Card>
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-ink">{g.name}</p>
                      <span className="text-sm text-muted">{f ? STATUS_LABEL[f.status] : ''}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {centsToWholeDollars(g.savedCents)} / {centsToWholeDollars(g.targetCents)}
                    </p>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-sage/20">
                      <div className="h-full rounded-full bg-forest" style={{ width: `${pct}%` }} />
                    </div>
                    {g.targetDate && (
                      <p className="mt-2 text-xs text-muted">Target {g.targetDate}</p>
                    )}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
