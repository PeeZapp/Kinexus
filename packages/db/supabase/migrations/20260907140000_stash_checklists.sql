-- Lists vs wishlists: checklist items, and keep product scrape lists as wishlists.

alter table public.stash_lists
  add column if not exists kind text not null default 'wishlist';

alter table public.stash_lists
  drop constraint if exists stash_lists_kind_check;

alter table public.stash_lists
  add constraint stash_lists_kind_check
  check (kind in ('checklist', 'wishlist'));

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
  if v_parent.kind <> new.kind then
    raise exception 'Parent list must be the same kind';
  end if;
  return new;
end;
$$;

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
  if v_list.kind <> 'wishlist' then
    raise exception 'Products can only be added to wishlists';
  end if;
  select * into v_product from public.stash_products where id = new.product_id;
  if not found then
    raise exception 'Product not found';
  end if;
  if v_list.household_id <> v_product.household_id or v_list.household_id <> new.household_id then
    raise exception 'List and product must belong to the same household';
  end if;
  return new;
end;
$$;

create table if not exists public.stash_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.stash_lists (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(trim(title)) > 0),
  notes text,
  category text,
  priority integer not null default 0 check (priority between 0 and 4),
  is_checked boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stash_list_items_household_idx on public.stash_list_items (household_id);
create index if not exists stash_list_items_list_idx on public.stash_list_items (list_id, is_checked, position);

create or replace function public.stash_list_item_guard()
returns trigger
language plpgsql
as $$
declare
  v_list public.stash_lists%rowtype;
begin
  select * into v_list from public.stash_lists where id = new.list_id;
  if not found then
    raise exception 'List not found';
  end if;
  if v_list.kind <> 'checklist' then
    raise exception 'Items can only be added to checklists';
  end if;
  if v_list.household_id <> new.household_id then
    raise exception 'Item must belong to the same household as the list';
  end if;
  return new;
end;
$$;

drop trigger if exists stash_list_items_guard on public.stash_list_items;
create trigger stash_list_items_guard
  before insert or update on public.stash_list_items
  for each row execute function public.stash_list_item_guard();

drop trigger if exists stash_list_items_set_updated_at on public.stash_list_items;
create trigger stash_list_items_set_updated_at
  before update on public.stash_list_items
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.stash_list_items to authenticated;

alter table public.stash_list_items enable row level security;

drop policy if exists stash_list_items_select on public.stash_list_items;
drop policy if exists stash_list_items_insert on public.stash_list_items;
drop policy if exists stash_list_items_update on public.stash_list_items;
drop policy if exists stash_list_items_delete on public.stash_list_items;

create policy stash_list_items_select on public.stash_list_items
  for select to authenticated
  using (public.can_view_stash_list(list_id));

create policy stash_list_items_insert on public.stash_list_items
  for insert to authenticated
  with check (public.can_view_stash_list(list_id));

create policy stash_list_items_update on public.stash_list_items
  for update to authenticated
  using (public.can_view_stash_list(list_id))
  with check (public.can_view_stash_list(list_id));

create policy stash_list_items_delete on public.stash_list_items
  for delete to authenticated
  using (public.can_view_stash_list(list_id));

alter table public.stash_list_items replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.stash_list_items;
  exception
    when duplicate_object then null;
  end;
end;
$$;
