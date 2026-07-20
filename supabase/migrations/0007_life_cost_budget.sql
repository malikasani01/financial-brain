-- ===========================================================================
-- Budget mode for flexible life costs.
--
-- Instead of a fixed recurring amount, a category (Groceries, Gas, …) can be
-- tracked as a MONTHLY BUDGET envelope. The forecast reserves the remaining
-- budget for the current month (budget − cleared spending so far) and the full
-- budget for later months. "Spent this month" is derived from cleared expense
-- transactions in that category; only these two columns are stored.
--
-- Idempotent / additive: safe to run more than once.
-- ===========================================================================

alter table public.life_cost_categories
  add column if not exists budget_mode boolean not null default false;

alter table public.life_cost_categories
  add column if not exists monthly_budget_cents integer;
