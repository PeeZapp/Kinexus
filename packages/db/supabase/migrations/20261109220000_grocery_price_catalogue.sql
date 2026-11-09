-- Shared grocery price catalogue: weekly selection + daily regional refresh.

alter table public.households
  add column if not exists state text not null default 'WA';

alter table public.households
  drop constraint if exists households_state_check;

alter table public.households
  add constraint households_state_check
  check (state ~ '^[A-Z]{2,3}$');

create table public.grocery_store_regions (
  state text not null check (state ~ '^[A-Z]{2,3}$'),
  store text not null check (store in ('woolworths', 'coles')),
  store_id text not null check (char_length(trim(store_id)) between 1 and 40),
  created_at timestamptz not null default now(),
  primary key (state, store)
);

insert into public.grocery_store_regions (state, store, store_id) values
  ('WA', 'coles', '7674'),
  ('WA', 'woolworths', '4392')
on conflict (state, store) do update set store_id = excluded.store_id;

create table public.grocery_catalogue_items (
  ingredient_key text not null check (char_length(trim(ingredient_key)) between 1 and 80),
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  search_query text not null check (char_length(trim(search_query)) between 1 and 60),
  rank int not null check (rank >= 1),
  recipe_count int not null check (recipe_count >= 0),
  week_start date not null,
  batch_day smallint not null check (batch_day between 0 and 6),
  created_at timestamptz not null default now(),
  primary key (week_start, ingredient_key)
);

create index grocery_catalogue_items_week_batch_idx
  on public.grocery_catalogue_items (week_start, batch_day, rank);

create table public.grocery_prices (
  ingredient_key text not null check (char_length(trim(ingredient_key)) between 1 and 80),
  store text not null check (store in ('woolworths', 'coles')),
  state text not null check (state ~ '^[A-Z]{2,3}$'),
  product_id text not null check (char_length(trim(product_id)) between 1 and 80),
  name text not null check (char_length(trim(name)) between 1 and 200),
  brand text,
  price numeric(10, 2) not null check (price > 0),
  pack_size text,
  unit_price numeric(12, 6),
  by_weight boolean not null default false,
  in_stock boolean not null default true,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ingredient_key, store, state)
);

create index grocery_prices_state_store_idx
  on public.grocery_prices (state, store, fetched_at desc);

create trigger grocery_prices_updated_at
  before update on public.grocery_prices
  for each row execute function public.set_updated_at();

create table public.grocery_catalogue_requests (
  ingredient_key text not null check (char_length(trim(ingredient_key)) between 1 and 80),
  search_query text not null check (char_length(trim(search_query)) between 1 and 60),
  request_count int not null default 1 check (request_count >= 1),
  last_requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (ingredient_key)
);

create index grocery_catalogue_requests_rank_idx
  on public.grocery_catalogue_requests (request_count desc, last_requested_at desc);

create table public.grocery_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  batch_day smallint not null check (batch_day between 0 and 6),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  continued boolean not null default false,
  stats jsonb not null default '{}'::jsonb
);

create index grocery_refresh_runs_week_batch_idx
  on public.grocery_refresh_runs (week_start, batch_day, started_at desc);

alter table public.grocery_store_regions enable row level security;
alter table public.grocery_catalogue_items enable row level security;
alter table public.grocery_prices enable row level security;
alter table public.grocery_catalogue_requests enable row level security;
alter table public.grocery_refresh_runs enable row level security;

create policy grocery_store_regions_select on public.grocery_store_regions
  for select to authenticated
  using (true);

create policy grocery_catalogue_items_select on public.grocery_catalogue_items
  for select to authenticated
  using (true);

create policy grocery_prices_select on public.grocery_prices
  for select to authenticated
  using (true);

create policy grocery_catalogue_requests_select on public.grocery_catalogue_requests
  for select to authenticated
  using (true);

create policy grocery_refresh_runs_select on public.grocery_refresh_runs
  for select to authenticated
  using (true);

grant select on table public.grocery_store_regions to authenticated;
grant select on table public.grocery_catalogue_items to authenticated;
grant select on table public.grocery_prices to authenticated;
grant select on table public.grocery_catalogue_requests to authenticated;
grant select on table public.grocery_refresh_runs to authenticated;
