import { redirect } from 'next/navigation';
import { recalculateFinancials } from '@fb/data';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Runs the first real calculation, then hands off to the Truth screen. The work
 * is genuine (fetch -> normalize -> engine -> snapshot); there is no fake delay.
 */
export default async function AnalyzingPage() {
  const { supabase, userId, clock } = await getSessionContext();
  await recalculateFinancials(supabase, userId, clock);
  redirect('/onboarding/truth');
}
