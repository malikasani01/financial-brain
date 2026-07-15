-- ===========================================================================
-- Row Level Security, per-user indexes, and updated_at triggers.
--
-- Every table is owned by exactly one user. The policy below grants a user
-- full access to ONLY their own rows and nothing else. The `authenticated`
-- role is subject to RLS; the Supabase `service_role` bypasses it (used only
-- by trusted server-side code).
-- ===========================================================================

do $$
declare
  rec record;
begin
  for rec in
    select tbl, col from (values
      ('profiles',                 'id'),
      ('user_preferences',         'user_id'),
      ('accounts',                 'user_id'),
      ('account_balance_history',  'user_id'),
      ('cash_reservations',        'user_id'),
      ('income_sources',           'user_id'),
      ('income_events',            'user_id'),
      ('obligations',              'user_id'),
      ('obligation_payments',      'user_id'),
      ('subscriptions',            'user_id'),
      ('life_cost_categories',     'user_id'),
      ('goals',                    'user_id'),
      ('goal_contributions',       'user_id'),
      ('businesses',               'user_id'),
      ('business_scenarios',       'user_id'),
      ('freedom_plans',            'user_id'),
      ('purchase_decisions',       'user_id'),
      ('planned_purchases',        'user_id'),
      ('financial_recommendations','user_id'),
      ('recommendation_actions',   'user_id'),
      ('financial_stage_history',  'user_id'),
      ('safety_buffer_settings',   'user_id'),
      ('forecast_snapshots',       'user_id'),
      ('chat_conversations',       'user_id'),
      ('chat_messages',            'user_id')
    ) as x(tbl, col)
  loop
    -- Enable RLS
    execute format('alter table public.%I enable row level security;', rec.tbl);

    -- One policy: a user may do anything to rows they own, and may only insert
    -- rows owned by themselves.
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (%I = auth.uid()) with check (%I = auth.uid());',
      'own_rows_' || rec.tbl, rec.tbl, rec.col, rec.col
    );

    -- Index the ownership column (RLS predicate hits it on every query).
    execute format(
      'create index if not exists %I on public.%I (%I);',
      'idx_' || rec.tbl || '_' || rec.col, rec.tbl, rec.col
    );

    -- Keep updated_at fresh.
    execute format(
      'create trigger %I before update on public.%I '
      || 'for each row execute function public.set_updated_at();',
      'trg_' || rec.tbl || '_updated', rec.tbl
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Auto-provision a profile + preference row when a new auth user signs up.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
