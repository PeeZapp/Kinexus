-- Standing budget lines can land in specific months instead of applying every month.

alter table public.finance_budget_lines
  add column if not exists cadence text not null default 'monthly',
  add column if not exists anchor_month integer not null default 1;

alter table public.finance_budget_lines
  drop constraint if exists finance_budget_lines_cadence_check;

alter table public.finance_budget_lines
  add constraint finance_budget_lines_cadence_check
  check (cadence in ('monthly', 'quarterly', 'half_yearly', 'yearly'));

alter table public.finance_budget_lines
  drop constraint if exists finance_budget_lines_anchor_month_check;

alter table public.finance_budget_lines
  add constraint finance_budget_lines_anchor_month_check
  check (anchor_month between 1 and 12);
