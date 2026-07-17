import { getSessionContext } from '@/lib/session';

export type TxnDirection = 'income' | 'expense' | 'transfer';
export type TxnStatus = 'cleared' | 'uncleared' | 'pending' | 'scheduled';

export interface TransactionRow {
  id: string;
  name: string | null;
  amount_cents: number;
  direction: TxnDirection;
  category: string | null;
  account_id: string | null;
  transfer_account_id: string | null;
  txn_date: string;
  status: TxnStatus;
  cleared_date: string | null;
  note: string | null;
}

const COLUMNS =
  'id,name,amount_cents,direction,category,account_id,transfer_account_id,txn_date,status,cleared_date,note';

export interface TransactionFilter {
  limit?: number;
  direction?: TxnDirection;
  status?: TxnStatus;
}

/**
 * Read the current user's transactions, newest first. Resilient to migration
 * 0004 not being applied yet — returns [] rather than throwing, so the app
 * keeps working before the table exists.
 */
export async function listTransactions(filter: TransactionFilter = {}): Promise<TransactionRow[]> {
  const { supabase, userId } = await getSessionContext();
  let q = supabase
    .from('transactions')
    .select(COLUMNS)
    .eq('user_id', userId)
    .is('archived_at', null);
  if (filter.direction) q = q.eq('direction', filter.direction);
  if (filter.status) q = q.eq('status', filter.status);
  const { data, error } = await q
    .order('txn_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 100);
  if (error) return [];
  return (data ?? []) as TransactionRow[];
}
