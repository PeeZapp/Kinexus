-- Budget lines can nest one level (Subscriptions → Netflix) and auto-apply
-- the planned amount at the start of each due month for direct debits.

alter table public.finance_budget_lines
  add column if not exists parent_id uuid references public.finance_budget_lines (id) on delete cascade,
  add column if not exists auto_apply boolean not null default false,
  add column if not exists auto_applied_month date;

alter table public.finance_budget_lines
  drop constraint if exists finance_budget_lines_auto_applied_month_check;

alter table public.finance_budget_lines
  add constraint finance_budget_lines_auto_applied_month_check
  check (auto_applied_month is null or extract(day from auto_applied_month) = 1);

create index if not exists finance_budget_lines_parent_idx
  on public.finance_budget_lines (parent_id);

alter table public.finance_budget_txns
  add column if not exists source text not null default 'manual';

alter table public.finance_budget_txns
  drop constraint if exists finance_budget_txns_source_check;

alter table public.finance_budget_txns
  add constraint finance_budget_txns_source_check
  check (source in ('manual', 'import', 'auto'));

create unique index if not exists finance_budget_txns_auto_month_idx
  on public.finance_budget_txns (line_id, (date_trunc('month', txn_date::timestamp)))
  where source = 'auto' and line_id is not null and ignored = false;

create or replace function public.finance_budget_line_guard()
returns trigger
language plpgsql
as $$
declare
  v_budget public.finance_budgets%rowtype;
  v_parent public.finance_budget_lines%rowtype;
begin
  select * into v_budget from public.finance_budgets where id = new.budget_id;
  if not found then
    raise exception 'Budget not found';
  end if;
  if v_budget.household_id <> new.household_id then
    raise exception 'Budget line must belong to the same household';
  end if;
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'A category cannot sit under itself';
    end if;
    select * into v_parent from public.finance_budget_lines where id = new.parent_id;
    if not found then
      raise exception 'Parent category not found';
    end if;
    if v_parent.budget_id <> new.budget_id or v_parent.household_id <> new.household_id then
      raise exception 'Subcategory must belong to the same budget';
    end if;
    if v_parent.kind <> new.kind then
      raise exception 'Subcategory must be the same type as its parent';
    end if;
    if v_parent.parent_id is not null then
      raise exception 'Subcategories cannot have their own subcategories';
    end if;
  end if;
  return new;
end;
$$;
