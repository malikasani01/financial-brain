-- ===========================================================================
-- Life-cost per-occurrence overrides — one-off "just this week" tweaks.
--
-- Flexible life costs (Groceries, Gas, Eating out, …) recur at a planned
-- amount. Sometimes a single occurrence should differ (a lighter grocery week,
-- a heavier gas week) WITHOUT changing the ongoing plan. Each row overrides one
-- category's amount on one date; the engine applies it to that occurrence only.
--
-- Idempotent: safe to run more than once.
-- ===========================================================================

create table if not exists public.life_cost_overrides (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  life_cost_id  uuid not null references public.life_cost_categories(id) on delete cascade,
  override_date date not null,
  amount_cents  integer not null check (amount_cents >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One override per (category, date); re-setting it upserts.
  unique (life_cost_id, override_date)
);

alter table public.life_cost_overrides enable row level security;

drop policy if exists own_rows_life_cost_overrides on public.life_cost_overrides;
create policy own_rows_life_cost_overrides on public.life_cost_overrides
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_life_cost_overrides_user on public.life_cost_overrides (user_id);
create index if not exists idx_life_cost_overrides_lc on public.life_cost_overrides (life_cost_id);

drop trigger if exists trg_life_cost_overrides_updated on public.life_cost_overrides;
create trigger trg_life_cost_overrides_updated
  before update on public.life_cost_overrides
  for each row execute function public.set_updated_at();
