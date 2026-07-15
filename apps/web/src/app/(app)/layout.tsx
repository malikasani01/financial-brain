import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/session';
import { BottomNav } from '@/components/BottomNav';

export const dynamic = 'force-dynamic';

/** Gate: the app is only reachable once onboarding is complete. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, userId } = await getSessionContext();
  const { data: prefs } = await supabase
    .from('user_preferences')
    .select('onboarding_completed_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (!prefs?.onboarding_completed_at) redirect('/onboarding/welcome');

  return (
    <div className="min-h-screen pb-24">
      {children}
      <BottomNav />
    </div>
  );
}
