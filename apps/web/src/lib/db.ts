import { getSessionContext } from '@/lib/session';

export interface Row {
  id: string;
  [k: string]: unknown;
}

/** List the current user's active (non-archived) rows from a table. */
export async function listOwn(table: string, columns: string): Promise<Row[]> {
  const { supabase, userId } = await getSessionContext();
  const { data } = await supabase
    .from(table)
    .select(columns)
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  return (data ?? []) as unknown as Row[];
}

export function dollarsInput(cents: number | null | undefined): string {
  return cents != null ? (cents / 100).toString() : '';
}
