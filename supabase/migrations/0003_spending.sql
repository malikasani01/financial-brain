-- ===========================================================================
-- Day-to-day spending log.
--
-- A spending_entries row records an expense the user already incurred. The
-- money is gone, so the server action also lowers the relevant account balance
-- immediately — which is what actually flows through the deterministic engine
-- (Safe to Spend is derived from account balances). This table is the human
-- record of WHAT was spent, and lets the user undo a mistaken entry.
--
-- Idempotent: safe to run more than once.
-- ===========================================================================

create table if not exists public.spending_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  description  text,
  spent_date   date not null,
  -- Which account the money came out of (so an undo can restore it precisely).
  account_id   uuid references public.accounts(id) on delete set null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.spending_entries enable row level security;

drop policy if exists own_rows_spending_entries on public.spending_entries;
create policy own_rows_spending_entries on public.spending_entries
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_spending_entries_user_id on public.spending_entries (user_id);

drop trigger if exists trg_spending_entries_updated on public.spending_entries;
create trigger trg_spending_entries_updated
  before update on public.spending_entries
  for each row execute function public.set_updated_at();
