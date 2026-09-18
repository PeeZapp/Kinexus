-- Phase 6: Stash — household wishlists, owned items, and saved links.

create table public.stash_products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(trim(title)) > 0),
  current_price numeric,
  original_price numeric,
  is_on_sale boolean not null default false,
  image_url text,
  source_url text not null default '',
  store_name text,
  description text,
  sku text,
  price_source text check (price_source is null or price_source in ('manual', 'scraped')),
  is_owned boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stash_products_household_id_idx on public.stash_products (household_id);
create index stash_products_household_owned_idx on public.stash_products (household_id, is_owned);

create table public.stash_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  scope text not null default 'wishlist' check (scope in ('wishlist', 'owned')),
  parent_list_id uuid references public.stash_lists (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stash_lists_household_id_idx on public.stash_lists (household_id);
create index stash_lists_parent_idx on public.stash_lists (parent_list_id);

create table public.stash_list_products (
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.stash_lists (id) on delete cascade,
  product_id uuid not null references public.stash_products (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (list_id, product_id)
);

create index stash_list_products_household_idx on public.stash_list_products (household_id);
create index stash_list_products_product_idx on public.stash_list_products (product_id);

create table public.stash_link_collections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  color text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stash_link_collections_household_idx on public.stash_link_collections (household_id);

create table public.stash_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  url text not null check (char_length(trim(url)) > 0),
  canonical_url text not null check (char_length(trim(canonical_url)) > 0),
  title text not null check (char_length(trim(title)) > 0),
  description text,
  image_url text,
  site_name text,
  favicon_url text,
  link_type text not null default 'other' check (
    link_type in ('recipe', 'video', 'article', 'tool', 'place', 'product', 'other')
  ),
  status text not null default 'saved' check (
    status in ('saved', 'try_next', 'tried', 'liked', 'not_for_me', 'archived')
  ),
  priority smallint not null default 0 check (priority between 0 and 4),
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, canonical_url)
);

create index stash_links_household_idx on public.stash_links (household_id);

create table public.stash_link_collection_items (
  household_id uuid not null references public.households (id) on delete cascade,
  collection_id uuid not null references public.stash_link_collections (id) on delete cascade,
  link_id uuid not null references public.stash_links (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, link_id)
);

create index stash_link_collection_items_household_idx on public.stash_link_collection_items (household_id);
create index stash_link_collection_items_link_idx on public.stash_link_collection_items (link_id);

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

create or replace function public.stash_list_parent_guard()
returns trigger
language plpgsql
as $$
declare
  v_parent public.stash_lists%rowtype;
begin
  if new.parent_list_id is null then
    return new;
  end if;
  if new.parent_list_id = new.id then
    raise exception 'A list cannot be its own parent';
  end if;
  select * into v_parent from public.stash_lists where id = new.parent_list_id;
  if not found then
    raise exception 'Parent list not found';
  end if;
  if v_parent.household_id <> new.household_id then
    raise exception 'Parent list must belong to the same household';
  end if;
  if v_parent.scope <> new.scope then
    raise exception 'Parent list must use the same scope';
  end if;
  return new;
end;
$$;

create trigger stash_lists_parent_guard
  before insert or update on public.stash_lists
  for each row execute function public.stash_list_parent_guard();

create or replace function public.stash_list_product_guard()
returns trigger
language plpgsql
as $$
declare
  v_list public.stash_lists%rowtype;
  v_product public.stash_products%rowtype;
begin
  select * into v_list from public.stash_lists where id = new.list_id;
  if not found then
    raise exception 'List not found';
  end if;
  select * into v_product from public.stash_products where id = new.product_id;
  if not found then
    raise exception 'Product not found';
  end if;
  if v_list.household_id <> v_product.household_id or v_list.household_id <> new.household_id then
    raise exception 'List and product must belong to the same household';
  end if;
  if v_list.scope = 'owned' and v_product.is_owned is not true then
    raise exception 'Owned lists can only hold items marked as owned';
  end if;
  return new;
end;
$$;

create trigger stash_list_products_guard
  before insert or update on public.stash_list_products
  for each row execute function public.stash_list_product_guard();

create or replace function public.stash_link_collection_item_guard()
returns trigger
language plpgsql
as $$
declare
  v_collection public.stash_link_collections%rowtype;
  v_link public.stash_links%rowtype;
begin
  select * into v_collection from public.stash_link_collections where id = new.collection_id;
  select * into v_link from public.stash_links where id = new.link_id;
  if v_collection.household_id <> v_link.household_id or v_collection.household_id <> new.household_id then
    raise exception 'Collection and link must belong to the same household';
  end if;
  return new;
end;
$$;

create trigger stash_link_collection_items_guard
  before insert or update on public.stash_link_collection_items
  for each row execute function public.stash_link_collection_item_guard();

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create trigger stash_products_set_updated_at
  before update on public.stash_products
  for each row execute function public.set_updated_at();

create trigger stash_lists_set_updated_at
  before update on public.stash_lists
  for each row execute function public.set_updated_at();

create trigger stash_link_collections_set_updated_at
  before update on public.stash_link_collections
  for each row execute function public.set_updated_at();

create trigger stash_links_set_updated_at
  before update on public.stash_links
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table public.stash_products to authenticated;
grant select, insert, update, delete on table public.stash_lists to authenticated;
grant select, insert, update, delete on table public.stash_list_products to authenticated;
grant select, insert, update, delete on table public.stash_link_collections to authenticated;
grant select, insert, update, delete on table public.stash_links to authenticated;
grant select, insert, update, delete on table public.stash_link_collection_items to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.stash_products enable row level security;
alter table public.stash_lists enable row level security;
alter table public.stash_list_products enable row level security;
alter table public.stash_link_collections enable row level security;
alter table public.stash_links enable row level security;
alter table public.stash_link_collection_items enable row level security;

create policy stash_products_all on public.stash_products
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy stash_lists_all on public.stash_lists
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy stash_list_products_all on public.stash_list_products
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy stash_link_collections_all on public.stash_link_collections
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy stash_links_all on public.stash_links
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy stash_link_collection_items_all on public.stash_link_collection_items
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter table public.stash_products replica identity full;
alter table public.stash_lists replica identity full;
alter table public.stash_list_products replica identity full;
alter table public.stash_links replica identity full;
alter table public.stash_link_collections replica identity full;
alter table public.stash_link_collection_items replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.stash_products;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.stash_lists;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.stash_list_products;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.stash_links;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.stash_link_collections;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.stash_link_collection_items;
  exception
    when duplicate_object then null;
  end;
end;
$$;
