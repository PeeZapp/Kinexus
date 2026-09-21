-- One category per budget can receive leftover after actual spending.

alter table public.finance_budget_lines
  add column if not exists capture_surplus boolean not null default false;

update public.finance_budget_lines line
set
  capture_surplus = true,
  auto_apply = false,
  name = case
    when lower(trim(line.name)) = 'savings' then 'Savings & Investments'
    else line.name
  end
from (
  select distinct on (budget_id) id
  from public.finance_budget_lines
  where kind = 'expense'
    and parent_id is null
    and lower(trim(name)) in ('savings', 'savings & investments', 'savings and investments')
  order by budget_id, position, created_at
) picked
where line.id = picked.id;

insert into public.finance_budget_lines (
  household_id,
  budget_id,
  kind,
  name,
  planned,
  spent,
  position,
  cadence,
  anchor_month,
  parent_id,
  auto_apply,
  capture_surplus
)
select
  budget.household_id,
  budget.id,
  'expense',
  'Savings & Investments',
  0,
  0,
  coalesce(max(line.position), -1) + 1,
  'monthly',
  1,
  null,
  false,
  true
from public.finance_budgets budget
left join public.finance_budget_lines line on line.budget_id = budget.id
where not exists (
  select 1
  from public.finance_budget_lines existing
  where existing.budget_id = budget.id
    and existing.capture_surplus
)
group by budget.household_id, budget.id;

create unique index if not exists finance_budget_lines_capture_surplus_idx
  on public.finance_budget_lines (budget_id)
  where capture_surplus = true;

alter table public.finance_budget_lines
  drop constraint if exists finance_budget_lines_capture_surplus_check;

alter table public.finance_budget_lines
  add constraint finance_budget_lines_capture_surplus_check
  check (
    not capture_surplus
    or (kind = 'expense' and parent_id is null and auto_apply = false)
  );

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
  if new.capture_surplus then
    new.auto_apply := false;
    new.parent_id := null;
    new.kind := 'expense';
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

create or replace function public.ensure_finance_budget(p_household_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Not a member of this household';
  end if;

  select id into v_id
  from public.finance_budgets
  where household_id = p_household_id;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.finance_budgets (household_id)
  values (p_household_id)
  on conflict (household_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.finance_budgets
    where household_id = p_household_id;
    return v_id;
  end if;

  insert into public.finance_budget_lines (
    household_id,
    budget_id,
    kind,
    name,
    planned,
    spent,
    position,
    cadence,
    anchor_month,
    parent_id,
    auto_apply,
    capture_surplus
  )
  values
    (p_household_id, v_id, 'income', 'Salary', 0, 0, 0, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'income', 'Other income', 0, 0, 1, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Housing', 0, 0, 2, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Groceries', 0, 0, 3, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Transport', 0, 0, 4, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Utilities', 0, 0, 5, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Insurance', 0, 0, 6, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Healthcare', 0, 0, 7, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Childcare', 0, 0, 8, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Entertainment', 0, 0, 9, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Subscriptions', 0, 0, 10, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Savings & Investments', 0, 0, 11, 'monthly', 1, null, false, true),
    (p_household_id, v_id, 'expense', 'Other', 0, 0, 12, 'monthly', 1, null, false, false);

  return v_id;
end;
$$;
