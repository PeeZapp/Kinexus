-- Family lists: sharing + admin-only create. Drop wishlist/owned split.

alter table public.stash_lists
  add column if not exists visibility text not null default 'household';

alter table public.stash_lists
  drop constraint if exists stash_lists_visibility_check;

alter table public.stash_lists
  add constraint stash_lists_visibility_check
  check (visibility in ('household', 'private', 'people'));

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

alter table public.stash_lists drop constraint if exists stash_lists_scope_check;
alter table public.stash_lists drop column if exists scope;

create table if not exists public.stash_list_people (
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.stash_lists (id) on delete cascade,
  person_id uuid not null references public.household_people (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, person_id)
);

create index if not exists stash_list_people_household_idx on public.stash_list_people (household_id);
create index if not exists stash_list_people_person_idx on public.stash_list_people (person_id);

create or replace function public.stash_list_person_guard()
returns trigger
language plpgsql
as $$
declare
  v_list public.stash_lists%rowtype;
  v_person public.household_people%rowtype;
begin
  select * into v_list from public.stash_lists where id = new.list_id;
  select * into v_person from public.household_people where id = new.person_id;
  if v_list.household_id <> v_person.household_id or v_list.household_id <> new.household_id then
    raise exception 'Person must belong to the same household as the list';
  end if;
  return new;
end;
$$;

drop trigger if exists stash_list_people_guard on public.stash_list_people;
create trigger stash_list_people_guard
  before insert or update on public.stash_list_people
  for each row execute function public.stash_list_person_guard();

create or replace function public.can_view_stash_list(_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stash_lists l
    where l.id = _list_id
      and public.is_household_member(l.household_id)
      and (
        public.has_household_role(l.household_id, array['owner', 'admin']::public.household_role[])
        or l.created_by = auth.uid()
        or l.visibility = 'household'
        or (
          l.visibility = 'people'
          and exists (
            select 1
            from public.stash_list_people slp
            join public.household_people hp on hp.id = slp.person_id
            where slp.list_id = l.id
              and hp.user_id = auth.uid()
          )
        )
      )
  );
$$;

create or replace function public.can_view_stash_product(_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stash_products p
    where p.id = _product_id
      and public.is_household_member(p.household_id)
      and (
        public.has_household_role(p.household_id, array['owner', 'admin']::public.household_role[])
        or p.created_by = auth.uid()
        or exists (
          select 1
          from public.stash_list_products lp
          where lp.product_id = p.id
            and public.can_view_stash_list(lp.list_id)
        )
      )
  );
$$;

revoke all on function public.can_view_stash_list(uuid) from public;
revoke all on function public.can_view_stash_product(uuid) from public;
grant execute on function public.can_view_stash_list(uuid) to authenticated;
grant execute on function public.can_view_stash_product(uuid) to authenticated;

grant select, insert, update, delete on table public.stash_list_people to authenticated;

alter table public.stash_list_people enable row level security;

drop policy if exists stash_lists_all on public.stash_lists;
drop policy if exists stash_products_all on public.stash_products;
drop policy if exists stash_list_products_all on public.stash_list_products;

create policy stash_lists_select on public.stash_lists
  for select to authenticated
  using (public.can_view_stash_list(id));

create policy stash_lists_insert on public.stash_lists
  for insert to authenticated
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy stash_lists_update on public.stash_lists
  for update to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]))
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy stash_lists_delete on public.stash_lists
  for delete to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy stash_products_select on public.stash_products
  for select to authenticated
  using (public.can_view_stash_product(id));

create policy stash_products_insert on public.stash_products
  for insert to authenticated
  with check (public.is_household_member(household_id));

create policy stash_products_update on public.stash_products
  for update to authenticated
  using (public.can_view_stash_product(id))
  with check (public.can_view_stash_product(id));

create policy stash_products_delete on public.stash_products
  for delete to authenticated
  using (public.can_view_stash_product(id));

create policy stash_list_products_select on public.stash_list_products
  for select to authenticated
  using (public.can_view_stash_list(list_id));

create policy stash_list_products_insert on public.stash_list_products
  for insert to authenticated
  with check (public.can_view_stash_list(list_id));

create policy stash_list_products_update on public.stash_list_products
  for update to authenticated
  using (public.can_view_stash_list(list_id))
  with check (public.can_view_stash_list(list_id));

create policy stash_list_products_delete on public.stash_list_products
  for delete to authenticated
  using (public.can_view_stash_list(list_id));

create policy stash_list_people_select on public.stash_list_people
  for select to authenticated
  using (public.can_view_stash_list(list_id));

create policy stash_list_people_write on public.stash_list_people
  for all to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]))
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

alter table public.stash_list_people replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.stash_list_people;
  exception
    when duplicate_object then null;
  end;
end;
$$;
