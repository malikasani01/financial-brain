-- ===========================================================================
-- Financial Brain — initial schema
-- All money is stored as INTEGER cents. All tables are scoped to a user via
-- Row Level Security (auth.uid() = user_id). Never hard-delete financial data:
-- soft-delete via `archived_at` or a status column.
-- ===========================================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Shared: bump updated_at on every UPDATE
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enums (mirror packages/types/src/enums.ts exactly)
-- ---------------------------------------------------------------------------
create type account_type      as enum ('checking','savings','cash','payment_app','other_liquid');
create type income_confidence as enum ('CONFIRMED','HIGHLY_LIKELY','VARIABLE','SPECULATIVE');
create type frequency         as enum ('ONE_TIME','WEEKLY','BIWEEKLY','SEMIMONTHLY','MONTHLY','QUARTERLY','ANNUAL','CUSTOM');
create type obligation_status as enum ('CURRENT','DUE_SOON','DUE','OVERDUE','SEVERELY_OVERDUE','PAUSED','IN_DISPUTE','PAYMENT_PLAN');
create type priority_class    as enum ('PROTECT','STABILIZE','BUILD','ENJOY','OPTIONAL_GROWTH');
create type financial_stage   as enum ('CRITICAL','STABILIZING','STABLE','BUILDING_FREEDOM');
create type decision_type     as enum ('ONE_TIME','SUBSCRIPTION','PAYMENT_PLAN','LOAN','INCREASE_EXPENSE','RESTART_EXPENSE','OTHER');
create type decision_state    as enum ('GREEN','YELLOW','RED');
create type goal_status       as enum ('ON_TRACK','AT_RISK','OFF_TRACK','PAUSED','COMPLETED');
create type personal_priority as enum ('NON_NEGOTIABLE','VERY_IMPORTANT','IMPORTANT','NICE_TO_HAVE');

-- ---------------------------------------------------------------------------
-- Identity & preferences
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone     text not null default 'America/Denver',
  currency     char(3) not null default 'USD',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.user_preferences (
  user_id                      uuid primary key references auth.users(id) on delete cascade,
  safety_buffer_override_cents integer,
  onboarding_step              smallint not null default 0,
  onboarding_completed_at      timestamptz,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Liquidity
-- ---------------------------------------------------------------------------
create table public.accounts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  type               account_type not null,
  balance_cents      integer not null default 0,
  balance_updated_at timestamptz not null default now(),
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.account_balance_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  account_id    uuid not null references public.accounts(id) on delete cascade,
  balance_cents integer not null,
  recorded_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.cash_reservations (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  amount_cents         integer not null,
  reason               text,
  reserved_for_date    date,
  -- If set, this reservation funds that obligation; the obligation is then
  -- excluded from future forecast outflows to avoid double-counting.
  linked_obligation_id uuid,
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Income
-- ---------------------------------------------------------------------------
create table public.income_sources (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  source_type        text not null,
  net_amount_cents   integer not null,
  frequency          frequency not null,
  next_expected_date date,
  confidence         income_confidence not null,
  notes              text,
  paused             boolean not null default false,
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.income_events (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  income_source_id     uuid references public.income_sources(id) on delete set null,
  amount_cents         integer not null,
  received_date        date not null,
  deposited_account_id uuid references public.accounts(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Obligations
-- ---------------------------------------------------------------------------
create table public.obligations (
  id                            uuid primary key default gen_random_uuid(),
  user_id                       uuid not null references auth.users(id) on delete cascade,
  name                          text not null,
  category                      text not null,
  amount_due_cents              integer,
  minimum_required_cents        integer,        -- cure amount
  due_date                      date,
  frequency                     frequency not null,
  status                        obligation_status not null,
  priority_class                priority_class,
  is_essential                  boolean,
  is_negotiable                 boolean,
  next_expected_payment_date    date,
  -- "I'm behind" context
  days_overdue                  integer,
  payments_behind               integer,
  total_past_due_cents          integer,
  consequence_type              text,
  consequence_already_occurring boolean,
  consequence_date              date,
  -- Financial cost of delay. NULL => UNKNOWN; never fabricated.
  interest_rate                 numeric,
  late_fee_cents                integer,
  penalty_cents                 integer,
  goal_alignment_key            text,
  resolved                      boolean not null default false,
  notes                         text,
  archived_at                   timestamptz,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create table public.obligation_payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  obligation_id     uuid not null references public.obligations(id) on delete cascade,
  amount_cents      integer not null,
  payment_date      date not null,
  account_id        uuid references public.accounts(id) on delete set null,
  resolved_immediate text,  -- 'YES' | 'PARTIAL' | 'NO'
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Subscriptions & normal life costs
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  amount_cents     integer not null,
  frequency        frequency not null,
  next_charge_date date,
  auto_renews      boolean,
  purpose          text,
  pause_preference text,   -- personal context only; NOT an urgency input
  paused           boolean not null default false,
  notes            text,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.life_cost_categories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  category      text not null,
  frequency     frequency not null,
  minimum_cents integer not null,
  normal_cents  integer not null,
  planning_mode text not null default 'STAGE_DEFAULT', -- MIN|NORMAL|CUSTOM|STAGE_DEFAULT
  custom_cents  integer,
  is_essential  boolean not null default true,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Goals
-- ---------------------------------------------------------------------------
create table public.goals (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users(id) on delete cascade,
  name                        text not null,
  category                    text not null,
  target_cents                integer not null,
  saved_cents                 integer not null default 0,
  target_date                 date,
  personal_priority           personal_priority,
  -- ONLY committed contributions reduce Safe to Spend (locked decision).
  committed_per_paycheck_cents integer not null default 0,
  status                      goal_status not null default 'ON_TRACK',
  archived_at                 timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create table public.goal_contributions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  goal_id           uuid not null references public.goals(id) on delete cascade,
  amount_cents      integer not null,
  contribution_date date not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Business & freedom
-- ---------------------------------------------------------------------------
create table public.businesses (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  monthly_revenue_cents integer not null default 0,
  monthly_opex_cents    integer not null default 0,
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.business_scenarios (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users(id) on delete cascade,
  business_id                 uuid not null references public.businesses(id) on delete cascade,
  label                       text,
  weekly_price_cents          integer,
  monthly_price_cents         integer,
  annual_price_cents          integer,
  paying_users                integer,
  variable_cost_per_user_cents integer,
  fixed_monthly_cents         integer,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create table public.freedom_plans (
  user_id                       uuid primary key references auth.users(id) on delete cascade,
  monthly_employment_net_cents  integer,
  desired_replacement_cents     integer,
  target_date                   date,
  goals_selected                text[],
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Decisions & recommendations
-- ---------------------------------------------------------------------------
create table public.purchase_decisions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  name                 text,
  amount_cents         integer not null,
  decision_type        decision_type,
  purpose              text,
  monthly_payment_cents integer,
  term_months          integer,
  interest_rate        numeric,
  link                 text,
  note                 text,
  result_state         decision_state,
  result_json          jsonb,       -- full engine output snapshot for audit
  chose_buy_anyway     boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.planned_purchases (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  purchase_decision_id uuid references public.purchase_decisions(id) on delete set null,
  amount_cents         integer not null,
  planned_date         date not null,
  frequency            frequency not null default 'ONE_TIME',
  term_months          integer,
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.financial_recommendations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text,
  reason        text,
  urgency_score smallint,
  amount_cents  integer,
  state         text not null default 'ACTIVE',  -- ACTIVE|DISMISSED|RESOLVED
  dismiss_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.recommendation_actions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  recommendation_id uuid not null references public.financial_recommendations(id) on delete cascade,
  action            text not null,
  detail            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- History / snapshots
-- ---------------------------------------------------------------------------
create table public.financial_stage_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  stage       financial_stage not null,
  recorded_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.safety_buffer_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  override_cents      integer,
  recommended_cents   integer,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.forecast_snapshots (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  computed_at            timestamptz not null default now(),
  safe_to_spend_cents    integer,
  lowest_cash_cents      integer,
  lowest_cash_date       date,
  safety_buffer_cents    integer,
  stage                  financial_stage,
  daily_flexibility_cents integer,
  urgent_count           smallint,
  full_result            jsonb not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- AI chat
-- ---------------------------------------------------------------------------
create table public.chat_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role            text not null,
  content         text not null,
  context_json    jsonb,   -- exactly what was sent to the model, for audit
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
