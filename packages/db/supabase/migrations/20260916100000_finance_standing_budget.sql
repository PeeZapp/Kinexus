-- Standing household budget: planned amounts apply every month, not a copy per calendar month.

with ranked as (
  select
    id,
    row_number() over (partition by household_id order by month_start desc, updated_at desc, created_at desc) as rn
  from public.finance_budgets
)
delete from public.finance_budgets b
using ranked r
where b.id = r.id
  and r.rn > 1;

do $$
declare
  rec record;
begin
  for rec in
    select conname
    from pg_constraint
    where conrelid = 'public.finance_budgets'::regclass
      and contype in ('u', 'c')
      and (
        conname ilike '%month_start%'
        or pg_get_constraintdef(oid) ilike '%month_start%'
      )
  loop
    execute format('alter table public.finance_budgets drop constraint if exists %I', rec.conname);
  end loop;
end;
$$;

drop index if exists public.finance_budgets_household_idx;
alter table public.finance_budgets drop column if exists month_start;
alter table public.finance_budgets add constraint finance_budgets_household_key unique (household_id);
create index finance_budgets_household_idx on public.finance_budgets (household_id);

drop function if exists public.ensure_finance_budget(uuid, date);

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

  insert into public.finance_budget_lines (household_id, budget_id, kind, name, planned, spent, position)
  values
    (p_household_id, v_id, 'income', 'Salary', 0, 0, 0),
    (p_household_id, v_id, 'income', 'Other income', 0, 0, 1),
    (p_household_id, v_id, 'expense', 'Housing', 0, 0, 2),
    (p_household_id, v_id, 'expense', 'Groceries', 0, 0, 3),
    (p_household_id, v_id, 'expense', 'Transport', 0, 0, 4),
    (p_household_id, v_id, 'expense', 'Utilities', 0, 0, 5),
    (p_household_id, v_id, 'expense', 'Insurance', 0, 0, 6),
    (p_household_id, v_id, 'expense', 'Healthcare', 0, 0, 7),
    (p_household_id, v_id, 'expense', 'Childcare', 0, 0, 8),
    (p_household_id, v_id, 'expense', 'Entertainment', 0, 0, 9),
    (p_household_id, v_id, 'expense', 'Subscriptions', 0, 0, 10),
    (p_household_id, v_id, 'expense', 'Savings', 0, 0, 11),
    (p_household_id, v_id, 'expense', 'Other', 0, 0, 12);

  return v_id;
end;
$$;

revoke all on function public.ensure_finance_budget(uuid) from public;
grant execute on function public.ensure_finance_budget(uuid) to authenticated;
