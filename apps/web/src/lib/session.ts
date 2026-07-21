import type { Clock } from '@fb/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Today's date (YYYY-MM-DD) in the given IANA timezone. */
export function todayInTimezone(timezone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export interface SessionContext {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  clock: Clock;
}

/**
 * Resolve the authenticated user plus a Clock anchored to their profile
 * timezone. Throws if unauthenticated (routes are already gated by middleware).
 */
export async function getSessionContext(): Promise<SessionContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle();

  const timezone = (profile?.timezone as string | undefined) ?? 'America/Denver';
  return { supabase, userId: user.id, clock: { today: todayInTimezone(timezone), timezone } };
}
