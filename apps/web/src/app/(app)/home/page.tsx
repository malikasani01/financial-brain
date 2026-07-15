import Link from 'next/link';
import { redirect } from 'next/navigation';
import { latestSnapshot } from '@fb/data';
import { getSessionContext } from '@/lib/session';
import { centsToWholeDollars, centsToDollars } from '@/lib/money';
import { Card } from '@/components/ui';
import { signOut } from '../actions';

export const dynamic = 'force-dynamic';

function greeting(today: string, tz: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(
      new Date(),
    ),
  );
  void today;
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default async function HomePage() {
  const { supabase, userId, clock } = await getSessionContext();

  const { data: prefs } = await supabase
    .from('user_preferences')
    .select('onboarding_completed_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!prefs?.onboarding_completed_at) redirect('/onboarding/welcome');

  const snapshot = await latestSnapshot(supabase, userId);
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();
  const name = (profile?.display_name as string | undefined) ?? '';

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <p className="text-muted">
        {greeting(clock.today, clock.timezone)}
        {name ? `, ${name}` : ''}.
      </p>

      {snapshot ? (
        <>
          <Card className="mt-6 text-center">
            <p className="text-5xl font-semibold text-forest">
              {centsToWholeDollars(snapshot.safeToSpend.safeToSpendCents)}
            </p>
            <p className="mt-1 text-sm uppercase tracking-wide text-muted">Safe to spend</p>
            {snapshot.safeToSpend.dailyFlexibilityCents != null && (
              <p className="mt-3 text-sm text-muted">
                {centsToDollars(snapshot.safeToSpend.dailyFlexibilityCents)} per day flexible
              </p>
            )}
          </Card>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <Mini
              label="Available"
              value={centsToWholeDollars(snapshot.safeToSpend.currentLiquidCashCents)}
            />
            <Mini
              label="Already needed"
              value={centsToWholeDollars(
                snapshot.safeToSpend.currentLiquidCashCents - snapshot.safeToSpend.safeToSpendCents,
              )}
            />
          </div>

          <p className="mt-6 text-sm text-muted">
            Lowest projected cash{' '}
            {centsToWholeDollars(snapshot.safeToSpend.lowestProjectedCashCents)} on{' '}
            {snapshot.safeToSpend.lowestCashDate}. The full dashboard, planner, and Ask flow arrive
            in Phase 3.
          </p>
        </>
      ) : (
        <Card className="mt-6">
          <p className="text-muted">
            I need a little more information before I can calculate what is safe to spend.
          </p>
          <Link href="/onboarding/welcome" className="mt-3 inline-block text-forest underline">
            Finish setup
          </Link>
        </Card>
      )}

      <form action={signOut} className="mt-10">
        <button className="text-sm text-forest underline underline-offset-4">Sign out</button>
      </form>
    </main>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-white p-5 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}
