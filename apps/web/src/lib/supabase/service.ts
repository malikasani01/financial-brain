import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client using the SERVICE ROLE key, which bypasses Row
 * Level Security. Login has been removed, so there is no per-request user
 * session; server code operates as the single account and scopes every query
 * by `user_id` itself.
 *
 * NEVER import this into a Client Component — the service role key must never
 * reach the browser. It is read from a server-only env var.
 */
export function createSupabaseServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
