-- Phase 7: Finances — household assets, liabilities, and monthly budgets.

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  kind text not null check (
    kind in (
      'cash',
      'bank',
      'investment',
      'super',
      'property',
      'vehicle',
      'other_asset',
      'credit',
      'loan',
      'mortgage',
      'other_liability'
    )
  ),
  institution text,
  value numeric not null default 0 check (value >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_accounts_household_idx on public.finance_accounts (household_id);

create table public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  month_start date not null check (extract(day from month_start) = 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, month_start)
);

create index finance_budgets_household_idx on public.finance_budgets (household_id, month_start desc);

create table public.finance_budget_lines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  budget_id uuid not null references public.finance_budgets (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  name text not null check (char_length(trim(name)) > 0),
  planned numeric not null default 0 check (planned >= 0),
  spent numeric not null default 0 check (spent >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_budget_lines_budget_idx on public.finance_budget_lines (budget_id, kind, position);
create index finance_budget_lines_household_idx on public.finance_budget_lines (household_id);

create or replace function public.finance_budget_line_guard()
returns trigger
language plpgsql
as $$
declare
  v_budget public.finance_budgets%rowtype;
begin
  select * into v_budget from public.finance_budgets where id = new.budget_id;
  if not found then
    raise exception 'Budget not found';
  end if;
  if v_budget.household_id <> new.household_id then
    raise exception 'Budget line must belong to the same household';
  end if;
  return new;
end;
$$;

create trigger finance_budget_lines_guard
  before insert or update on public.finance_budget_lines
  for each row execute function public.finance_budget_line_guard();

create trigger finance_accounts_set_updated_at
  before update on public.finance_accounts
  for each row execute function public.set_updated_at();

create trigger finance_budgets_set_updated_at
  before update on public.finance_budgets
  for each row execute function public.set_updated_at();

create trigger finance_budget_lines_set_updated_at
  before update on public.finance_budget_lines
  for each row execute function public.set_updated_at();

create or replace function public.ensure_finance_budget(p_household_id uuid, p_month_start date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_prev uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Not a member of this household';
  end if;

  if extract(day from p_month_start) <> 1 then
    raise exception 'Budget month must start on the first';
  end if;

  select id into v_id
  from public.finance_budgets
  where household_id = p_household_id
    and month_start = p_month_start;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.finance_budgets (household_id, month_start)
  values (p_household_id, p_month_start)
  on conflict (household_id, month_start) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.finance_budgets
    where household_id = p_household_id
      and month_start = p_month_start;
    return v_id;
  end if;

  select id into v_prev
  from public.finance_budgets
  where household_id = p_household_id
    and month_start < p_month_start
  order by month_start desc
  limit 1;

  if v_prev is not null then
    insert into public.finance_budget_lines (household_id, budget_id, kind, name, planned, spent, position)
    select p_household_id, v_id, kind, name, planned, 0, position
    from public.finance_budget_lines
    where budget_id = v_prev
    order by position, name;
  else
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
  end if;

  return v_id;
end;
$$;

revoke all on function public.ensure_finance_budget(uuid, date) from public;
grant execute on function public.ensure_finance_budget(uuid, date) to authenticated;

grant select, insert, update, delete on table public.finance_accounts to authenticated;
grant select, insert, update, delete on table public.finance_budgets to authenticated;
grant select, insert, update, delete on table public.finance_budget_lines to authenticated;

alter table public.finance_accounts enable row level security;
alter table public.finance_budgets enable row level security;
alter table public.finance_budget_lines enable row level security;

create policy finance_accounts_select on public.finance_accounts
  for select to authenticated
  using (public.is_household_member(household_id));

create policy finance_accounts_write on public.finance_accounts
  for insert to authenticated
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_accounts_update on public.finance_accounts
  for update to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]))
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_accounts_delete on public.finance_accounts
  for delete to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_budgets_select on public.finance_budgets
  for select to authenticated
  using (public.is_household_member(household_id));

create policy finance_budgets_write on public.finance_budgets
  for insert to authenticated
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_budgets_update on public.finance_budgets
  for update to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]))
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_budgets_delete on public.finance_budgets
  for delete to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_budget_lines_select on public.finance_budget_lines
  for select to authenticated
  using (public.is_household_member(household_id));

create policy finance_budget_lines_write on public.finance_budget_lines
  for insert to authenticated
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_budget_lines_update on public.finance_budget_lines
  for update to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]))
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_budget_lines_delete on public.finance_budget_lines
  for delete to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

alter table public.finance_accounts replica identity full;
alter table public.finance_budgets replica identity full;
alter table public.finance_budget_lines replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.finance_accounts;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.finance_budgets;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.finance_budget_lines;
  exception
    when duplicate_object then null;
  end;
end;
$$;
