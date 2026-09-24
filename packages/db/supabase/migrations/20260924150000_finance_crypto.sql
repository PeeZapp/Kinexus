-- Crypto holdings tracked per household (no portfolio nesting).

create table public.finance_crypto_holdings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  symbol text not null check (char_length(trim(symbol)) > 0),
  name text,
  units numeric not null default 0 check (units >= 0),
  cost_per_unit numeric check (cost_per_unit is null or cost_per_unit >= 0),
  last_price numeric check (last_price is null or last_price >= 0),
  priced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, symbol)
);

create index finance_crypto_holdings_household_idx on public.finance_crypto_holdings (household_id);

create trigger finance_crypto_holdings_set_updated_at
  before update on public.finance_crypto_holdings
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.finance_crypto_holdings to authenticated;

alter table public.finance_crypto_holdings enable row level security;

create policy finance_crypto_holdings_select on public.finance_crypto_holdings
  for select to authenticated
  using (public.is_household_member(household_id));

create policy finance_crypto_holdings_write on public.finance_crypto_holdings
  for insert to authenticated
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_crypto_holdings_update on public.finance_crypto_holdings
  for update to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]))
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_crypto_holdings_delete on public.finance_crypto_holdings
  for delete to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

alter table public.finance_crypto_holdings replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.finance_crypto_holdings;
  exception
    when duplicate_object then null;
  end;
end;
$$;
