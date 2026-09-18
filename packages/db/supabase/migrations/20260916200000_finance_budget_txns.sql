-- Persist imported statement transactions so categories can be reclassified after apply.

create table public.finance_budget_txns (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  budget_id uuid not null references public.finance_budgets (id) on delete cascade,
  line_id uuid references public.finance_budget_lines (id) on delete set null,
  txn_date date not null,
  description text not null check (char_length(trim(description)) > 0),
  merchant_key text not null check (char_length(trim(merchant_key)) > 0),
  amount numeric not null check (amount <> 0),
  ignored boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_budget_txns_budget_idx on public.finance_budget_txns (budget_id, txn_date desc);
create index finance_budget_txns_line_idx on public.finance_budget_txns (line_id);
create index finance_budget_txns_household_idx on public.finance_budget_txns (household_id);
create index finance_budget_txns_merchant_idx on public.finance_budget_txns (budget_id, merchant_key);

create or replace function public.finance_budget_txn_guard()
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
    raise exception 'Budget transaction must belong to the same household';
  end if;
  if new.line_id is not null then
    select * into v_line from public.finance_budget_lines where id = new.line_id;
    if not found then
      raise exception 'Budget line not found';
    end if;
    if v_line.household_id <> new.household_id or v_line.budget_id <> new.budget_id then
      raise exception 'Budget transaction line must belong to the same budget';
    end if;
  end if;
  return new;
end;
$$;

create trigger finance_budget_txns_guard
  before insert or update on public.finance_budget_txns
  for each row execute function public.finance_budget_txn_guard();

create trigger finance_budget_txns_set_updated_at
  before update on public.finance_budget_txns
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.finance_budget_txns to authenticated;

alter table public.finance_budget_txns enable row level security;

create policy finance_budget_txns_select on public.finance_budget_txns
  for select to authenticated
  using (public.is_household_member(household_id));

create policy finance_budget_txns_write on public.finance_budget_txns
  for insert to authenticated
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_budget_txns_update on public.finance_budget_txns
  for update to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]))
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_budget_txns_delete on public.finance_budget_txns
  for delete to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

alter table public.finance_budget_txns replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.finance_budget_txns;
  exception
    when duplicate_object then null;
  end;
end;
$$;
