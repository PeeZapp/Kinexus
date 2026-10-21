-- Local Coles and Woolworths stores a household compares on the shopping list.
-- One row per chain. Prices are looked up live; this table only remembers the store.

create table public.household_grocery_stores (
  household_id uuid not null references public.households (id) on delete cascade,
  chain_id text not null check (chain_id ~ '^[a-z][a-z0-9-]{1,31}$'),
  store_id text not null check (char_length(store_id) between 1 and 40),
  store_name text not null check (char_length(trim(store_name)) between 1 and 120),
  suburb text not null default '' check (char_length(suburb) <= 80),
  updated_at timestamptz not null default now(),
  primary key (household_id, chain_id)
);

create trigger household_grocery_stores_updated_at
  before update on public.household_grocery_stores
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.household_grocery_stores to authenticated;

alter table public.household_grocery_stores enable row level security;

create policy household_grocery_stores_all on public.household_grocery_stores
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
