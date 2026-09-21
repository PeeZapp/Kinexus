-- Utilities in Australia are often billed every second month.

alter table public.finance_budget_lines
  drop constraint if exists finance_budget_lines_cadence_check;

alter table public.finance_budget_lines
  add constraint finance_budget_lines_cadence_check
  check (cadence in ('monthly', 'bimonthly', 'quarterly', 'half_yearly', 'yearly'));
