-- Listed share portfolios. A HIN/SRN is stored for a future registry feed.
-- CHESS does not offer a public holdings lookup; BGL uses paid registry contracts.

create table public.finance_share_portfolios (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  broker text,
  holder_kind text check (holder_kind is null or holder_kind in ('hin', 'srn')),
  holder_id text,
  postcode text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_share_portfolios_household_idx on public.finance_share_portfolios (household_id);

create table public.finance_share_holdings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  portfolio_id uuid not null references public.finance_share_portfolios (id) on delete cascade,
  symbol text not null check (char_length(trim(symbol)) > 0),
  name text,
  units numeric not null default 0 check (units >= 0),
  cost_per_unit numeric check (cost_per_unit is null or cost_per_unit >= 0),
  last_price numeric check (last_price is null or last_price >= 0),
  priced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id, symbol)
);

create index finance_share_holdings_household_idx on public.finance_share_holdings (household_id);
create index finance_share_holdings_portfolio_idx on public.finance_share_holdings (portfolio_id);

create or replace function public.finance_share_holding_guard()
returns trigger
language plpgsql
as $$
declare
  v_portfolio public.finance_share_portfolios%rowtype;
begin
  select * into v_portfolio from public.finance_share_portfolios where id = new.portfolio_id;
  if not found then
    raise exception 'Portfolio not found';
  end if;
  if v_portfolio.household_id <> new.household_id then
    raise exception 'Holding must belong to the same household';
  end if;
  return new;
end;
$$;

create trigger finance_share_holdings_guard
  before insert or update on public.finance_share_holdings
  for each row execute function public.finance_share_holding_guard();

create trigger finance_share_portfolios_set_updated_at
  before update on public.finance_share_portfolios
  for each row execute function public.set_updated_at();

create trigger finance_share_holdings_set_updated_at
  before update on public.finance_share_holdings
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.finance_share_portfolios to authenticated;
grant select, insert, update, delete on table public.finance_share_holdings to authenticated;

alter table public.finance_share_portfolios enable row level security;
alter table public.finance_share_holdings enable row level security;

create policy finance_share_portfolios_select on public.finance_share_portfolios
  for select to authenticated
  using (public.is_household_member(household_id));

create policy finance_share_portfolios_write on public.finance_share_portfolios
  for insert to authenticated
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_share_portfolios_update on public.finance_share_portfolios
  for update to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]))
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_share_portfolios_delete on public.finance_share_portfolios
  for delete to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_share_holdings_select on public.finance_share_holdings
  for select to authenticated
  using (public.is_household_member(household_id));

create policy finance_share_holdings_write on public.finance_share_holdings
  for insert to authenticated
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_share_holdings_update on public.finance_share_holdings
  for update to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]))
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_share_holdings_delete on public.finance_share_holdings
  for delete to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

alter table public.finance_share_portfolios replica identity full;
alter table public.finance_share_holdings replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.finance_share_portfolios;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.finance_share_holdings;
  exception
    when duplicate_object then null;
  end;
end;
$$;
