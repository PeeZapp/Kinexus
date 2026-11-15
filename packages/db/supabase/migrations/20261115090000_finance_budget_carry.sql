-- Cumulative category over/under balances that persist until the household clears them.

create table if not exists public.finance_budget_carry (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  budget_id uuid not null references public.finance_budgets (id) on delete cascade,
  line_id uuid not null references public.finance_budget_lines (id) on delete cascade,
  -- Positive = underspend credit remaining. Negative = overspend still owed.
  balance numeric(14, 2) not null default 0,
  last_accrued_month date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_budget_carry_budget_line_unique unique (budget_id, line_id),
  constraint finance_budget_carry_month_start check (
    last_accrued_month is null or last_accrued_month = date_trunc('month', last_accrued_month)::date
  )
);

create index if not exists finance_budget_carry_household_idx
  on public.finance_budget_carry (household_id);

create index if not exists finance_budget_carry_nonzero_idx
  on public.finance_budget_carry (budget_id)
  where balance <> 0;

create table if not exists public.finance_budget_carry_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  budget_id uuid not null references public.finance_budgets (id) on delete cascade,
  line_id uuid not null references public.finance_budget_lines (id) on delete cascade,
  kind text not null check (kind in ('accrue', 'apply', 'transfer', 'clear')),
  -- Signed change to line_id balance for this event.
  amount numeric(14, 2) not null,
  source_month date,
  target_line_id uuid references public.finance_budget_lines (id) on delete set null,
  target_month date,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint finance_budget_carry_events_source_month check (
    source_month is null or source_month = date_trunc('month', source_month)::date
  ),
  constraint finance_budget_carry_events_target_month check (
    target_month is null or target_month = date_trunc('month', target_month)::date
  )
);

create index if not exists finance_budget_carry_events_budget_idx
  on public.finance_budget_carry_events (budget_id, created_at desc);

create index if not exists finance_budget_carry_events_apply_idx
  on public.finance_budget_carry_events (budget_id, target_month, target_line_id)
  where kind = 'apply' and target_month is not null;

create or replace function public.finance_budget_carry_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists finance_budget_carry_touch on public.finance_budget_carry;
create trigger finance_budget_carry_touch
  before update on public.finance_budget_carry
  for each row execute function public.finance_budget_carry_touch();

create or replace function public.finance_budget_carry_guard()
returns trigger
language plpgsql
as $$
declare
  v_budget public.finance_budgets%rowtype;
  v_line public.finance_budget_lines%rowtype;
begin
  select * into v_budget from public.finance_budgets where id = new.budget_id;
  if not found then
    raise exception 'Budget not found';
  end if;
  if v_budget.household_id <> new.household_id then
    raise exception 'Carry household must match budget';
  end if;

  select * into v_line from public.finance_budget_lines where id = new.line_id;
  if not found then
    raise exception 'Budget line not found';
  end if;
  if v_line.budget_id <> new.budget_id or v_line.household_id <> new.household_id then
    raise exception 'Carry line must belong to budget';
  end if;

  return new;
end;
$$;

drop trigger if exists finance_budget_carry_guard on public.finance_budget_carry;
create trigger finance_budget_carry_guard
  before insert or update on public.finance_budget_carry
  for each row execute function public.finance_budget_carry_guard();

alter table public.finance_budget_carry enable row level security;
alter table public.finance_budget_carry_events enable row level security;

drop policy if exists finance_budget_carry_select on public.finance_budget_carry;
create policy finance_budget_carry_select on public.finance_budget_carry
  for select to authenticated
  using (public.can_view_finances(household_id));

drop policy if exists finance_budget_carry_insert on public.finance_budget_carry;
create policy finance_budget_carry_insert on public.finance_budget_carry
  for insert to authenticated
  with check (public.can_enter_budget_amounts(household_id));

drop policy if exists finance_budget_carry_update on public.finance_budget_carry;
create policy finance_budget_carry_update on public.finance_budget_carry
  for update to authenticated
  using (public.can_enter_budget_amounts(household_id))
  with check (public.can_enter_budget_amounts(household_id));

drop policy if exists finance_budget_carry_delete on public.finance_budget_carry;
create policy finance_budget_carry_delete on public.finance_budget_carry
  for delete to authenticated
  using (public.can_manage_budget_plan(household_id));

drop policy if exists finance_budget_carry_events_select on public.finance_budget_carry_events;
create policy finance_budget_carry_events_select on public.finance_budget_carry_events
  for select to authenticated
  using (public.can_view_finances(household_id));

drop policy if exists finance_budget_carry_events_insert on public.finance_budget_carry_events;
create policy finance_budget_carry_events_insert on public.finance_budget_carry_events
  for insert to authenticated
  with check (public.can_enter_budget_amounts(household_id));

drop policy if exists finance_budget_carry_events_delete on public.finance_budget_carry_events;
create policy finance_budget_carry_events_delete on public.finance_budget_carry_events
  for delete to authenticated
  using (public.can_manage_budget_plan(household_id));

grant select, insert, update, delete on public.finance_budget_carry to authenticated;
grant select, insert, delete on public.finance_budget_carry_events to authenticated;
