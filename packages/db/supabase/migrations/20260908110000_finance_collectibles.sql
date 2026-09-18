-- Phase 7b: Household collectibles valued from BrickEconomy (LEGO) and PriceCharting (cards).

create table public.finance_collectibles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  kind text not null check (kind in ('lego', 'trading_card', 'other')),
  condition text not null default 'new' check (condition in ('new', 'used')),
  quantity integer not null default 1 check (quantity >= 1),
  catalog_id text,
  source text not null default 'manual' check (source in ('brickeconomy', 'pricecharting', 'manual')),
  source_url text,
  image_url text,
  purchased_value numeric check (purchased_value is null or purchased_value >= 0),
  market_value numeric not null default 0 check (market_value >= 0),
  notes text,
  valued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_collectibles_household_idx on public.finance_collectibles (household_id, kind);

create trigger finance_collectibles_set_updated_at
  before update on public.finance_collectibles
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.finance_collectibles to authenticated;

alter table public.finance_collectibles enable row level security;

create policy finance_collectibles_select on public.finance_collectibles
  for select to authenticated
  using (public.is_household_member(household_id));

create policy finance_collectibles_write on public.finance_collectibles
  for insert to authenticated
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_collectibles_update on public.finance_collectibles
  for update to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]))
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy finance_collectibles_delete on public.finance_collectibles
  for delete to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

alter table public.finance_collectibles replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.finance_collectibles;
  exception
    when duplicate_object then null;
  end;
end;
$$;
