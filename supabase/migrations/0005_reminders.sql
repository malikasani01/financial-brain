-- ===========================================================================
-- Financial Reminders — small financial tasks and follow-ups that protect the
-- user's money (cancel a subscription, call to reactivate insurance, follow up
-- with an attorney, review a recurring charge, ...).
--
-- Reminders are a PURE application-layer feature. They never enter the
-- deterministic engine, EngineInput, or the forecast, and never change
-- projected cash flow. A reminder may optionally LINK to a real financial
-- record (subscription / obligation / account / goal / business), but it never
-- replaces or mutates that record — money only moves when the user confirms a
-- linked action (e.g. "yes, I canceled this subscription"), which runs the
-- existing mutation + recalculation.
--
-- Overdue / due-soon are DERIVED from due_date + status at read time and are
-- never stored.
--
-- Idempotent: safe to run more than once.
-- ===========================================================================

create table if not exists public.reminders (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  title                    text not null,
  -- Optional free-text detail the user typed.
  description              text,
  -- The raw voice transcription, if the reminder was captured by voice (kept
  -- for reference; the audio itself is never stored).
  transcription            text,
  due_date                 date,
  due_time                 time,
  -- IANA timezone the due date/time is expressed in (defaults to the profile's).
  timezone                 text,
  -- Subscription | Insurance | Bill | Debt | Legal | Account | Goal | Business
  -- | Follow-up | Other (free text; the UI offers the standard set).
  category                 text,
  priority                 text not null default 'NORMAL'
                             check (priority in ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  status                   text not null default 'OPEN'
                             check (status in ('OPEN', 'COMPLETED', 'CANCELED')),
  -- NONE | DAILY | WEEKLY | MONTHLY | CUSTOM
  recurrence_rule          text not null default 'NONE'
                             check (recurrence_rule in ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM')),
  -- { lead: ['AT_DUE'|'ONE_DAY'|'THREE_DAYS'|'ONE_WEEK'|'CUSTOM'], customDays?: number }
  notification_preferences jsonb,
  -- Optional link to a real financial record. Not a FK: the target lives in one
  -- of several tables, and the reminder must survive that record being removed.
  -- subscription | obligation | account | goal | business
  related_entity_type      text
                             check (related_entity_type is null or related_entity_type in
                               ('subscription', 'obligation', 'account', 'goal', 'business')),
  related_entity_id        uuid,
  completed_at             timestamptz,
  archived_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.reminders enable row level security;

drop policy if exists own_rows_reminders on public.reminders;
create policy own_rows_reminders on public.reminders
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_reminders_user_id on public.reminders (user_id);
create index if not exists idx_reminders_user_due on public.reminders (user_id, due_date);
create index if not exists idx_reminders_user_status on public.reminders (user_id, status);

drop trigger if exists trg_reminders_updated on public.reminders;
create trigger trg_reminders_updated
  before update on public.reminders
  for each row execute function public.set_updated_at();

-- Cancellation flow: when a reminder linked to a subscription is completed with
-- "yes, I canceled it", we stamp this and pause the subscription (pausing is
-- what removes it from the forecast) so future charges stop while the record is
-- kept, not hard-deleted. Additive column; harmless if already present.
alter table public.subscriptions add column if not exists canceled_at timestamptz;
