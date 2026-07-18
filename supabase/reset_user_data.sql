-- =============================================================================
-- reset_user_data.sql — wipe one user's financial data and restart onboarding
-- =============================================================================
-- DESTRUCTIVE. Deletes every financial row for a single user so they can begin
-- from a blank slate with real data. It does NOT delete the auth login, the
-- profile, or the preferences row — it only clears the data tables and resets
-- the onboarding gate (user_preferences.onboarding_completed_at -> null).
--
-- HOW TO RUN
--   1. Open Supabase -> SQL Editor.
--   2. (Optional) confirm the exact login email/id:
--        select id, email, created_at from auth.users order by created_at;
--   3. Set the email on the marked line below, then Run.
--
-- SAFETY
--   * Scoped to one user_id, resolved from auth.users by email.
--   * If the email matches no user, it raises and deletes NOTHING.
--   * Children are deleted before parents; all inter-table FKs are cascade or
--     set-null, so order-related failures cannot occur.
-- =============================================================================

do $$
declare
  uid uuid;
begin
  -- >>> SET YOUR EXACT LOGIN EMAIL HERE <<<
  select id into uid from auth.users where email = 'malikasani01@gmail.com';

  if uid is null then
    raise exception 'No user found for that email — fix the address on the marked line.';
  end if;

  -- children first
  delete from public.account_balance_history   where user_id = uid;
  delete from public.cash_reservations         where user_id = uid;
  -- spending_entries only exists once migration 0003 has been applied.
  if to_regclass('public.spending_entries') is not null then
    delete from public.spending_entries where user_id = uid;
  end if;
  -- transactions only exists once migration 0004 has been applied.
  if to_regclass('public.transactions') is not null then
    delete from public.transactions where user_id = uid;
  end if;
  -- reminders only exists once migration 0005 has been applied.
  if to_regclass('public.reminders') is not null then
    delete from public.reminders where user_id = uid;
  end if;
  delete from public.obligation_payments       where user_id = uid;
  delete from public.goal_contributions        where user_id = uid;
  delete from public.business_scenarios        where user_id = uid;
  delete from public.recommendation_actions    where user_id = uid;
  delete from public.chat_messages             where user_id = uid;
  delete from public.income_events             where user_id = uid;
  delete from public.planned_purchases         where user_id = uid;
  delete from public.purchase_decisions        where user_id = uid;
  delete from public.financial_recommendations where user_id = uid;

  -- parents
  delete from public.accounts                  where user_id = uid;
  delete from public.income_sources            where user_id = uid;
  delete from public.obligations               where user_id = uid;
  delete from public.subscriptions             where user_id = uid;
  delete from public.life_cost_categories      where user_id = uid;
  delete from public.goals                     where user_id = uid;
  delete from public.businesses                where user_id = uid;
  delete from public.freedom_plans             where user_id = uid;
  delete from public.financial_stage_history   where user_id = uid;
  delete from public.safety_buffer_settings    where user_id = uid;
  delete from public.forecast_snapshots        where user_id = uid;
  delete from public.chat_conversations        where user_id = uid;

  -- keep the account + preferences row, but send onboarding back to the start
  update public.user_preferences
     set onboarding_step = 0,
         onboarding_completed_at = null
   where user_id = uid;

  raise notice 'Reset complete for user %', uid;
end $$;
