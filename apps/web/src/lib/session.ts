import type { SupabaseClient } from '@supabase/supabase-js';
import type { Clock } from '@fb/types';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

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
  supabase: SupabaseClient;
  userId: string;
  clock: Clock;
}

/**
 * Resolve "the user" plus a Clock. Login has been removed, so there is no
 * per-request auth session: this app runs as its single stored account. We use
 * the server-only service-role client and treat the one profile in the database
 * as the user. Every downstream query still scopes by this `userId`.
 */
export async function getSessionContext(): Promise<SessionContext> {
  const supabase = createSupabaseServiceClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id,timezone')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!profile) {
    throw new Error('No account found. Create one in Supabase (auth + profile) before using the app.');
  }

  const timezone = (profile.timezone as string | undefined) ?? 'America/Denver';
  return {
    supabase,
    userId: profile.id as string,
    clock: { today: todayInTimezone(timezone), timezone },
  };
}
