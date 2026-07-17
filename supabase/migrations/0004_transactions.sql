-- ===========================================================================
-- Transactions — the record of actual money movements.
--
-- A transaction is a discrete income/expense/transfer. CLEARED transactions
-- have already moved money, so the server action also adjusts the account
-- balance (which is what the deterministic engine reads for Safe to Spend);
-- UNCLEARED/PENDING/SCHEDULED transactions are recorded but do not touch the
-- balance yet. Wiring uncleared items into the 90-day forecast (and linking a
-- cleared transaction to a scheduled obligation to avoid double-counting) is a
-- later phase — the engine is intentionally untouched here.
--
-- Idempotent: safe to run more than once. Backfills the older spending_entries
-- log the first time it runs.
-- ===========================================================================

create table if not exists public.transactions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  name                 text,
  amount_cents         integer not null check (amount_cents > 0),
  direction            text not null check (direction in ('income', 'expense', 'transfer')),
  category             text,
  account_id           uuid references public.accounts(id) on delete set null,
  -- Destination account for a transfer (source is account_id).
  transfer_account_id  uuid references public.accounts(id) on delete set null,
  txn_date             date not null,
  status               text not null default 'cleared'
                         check (status in ('cleared', 'uncleared', 'pending', 'scheduled')),
  cleared_date         date,
  -- Optional links (used by later phases; harmless now).
  obligation_id        uuid references public.obligations(id) on delete set null,
  goal_id              uuid references public.goals(id) on delete set null,
  note                 text,
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.transactions enable row level security;

drop policy if exists own_rows_transactions on public.transactions;
create policy own_rows_transactions on public.transactions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_transactions_user_id on public.transactions (user_id);
create index if not exists idx_transactions_user_date on public.transactions (user_id, txn_date desc);

drop trigger if exists trg_transactions_updated on public.transactions;
create trigger trg_transactions_updated
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- One-time backfill of the legacy day-to-day spending log. Runs only when the
-- transactions table is still empty, so re-running this migration is a no-op.
do $$
begin
  if to_regclass('public.spending_entries') is not null
     and not exists (select 1 from public.transactions) then
    insert into public.transactions
      (user_id, name, amount_cents, direction, category, account_id, txn_date, status, cleared_date, created_at)
    select user_id, description, amount_cents, 'expense', null, account_id, spent_date, 'cleared', spent_date, created_at
    from public.spending_entries
    where archived_at is null;
  end if;
end $$;
