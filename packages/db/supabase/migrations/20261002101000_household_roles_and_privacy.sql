-- Roles: member becomes adult. Adults, teens, and children get distinct access.
-- Saves and watchlists use the same sharing model as lists: family, private, or specific people.

update public.household_members set role = 'adult' where role = 'member';
update public.household_invites set role = 'adult' where role = 'member';

alter table public.household_members alter column role set default 'adult';
alter table public.household_invites alter column role set default 'adult';

-- ---------------------------------------------------------------------------
-- Sharing helpers
-- ---------------------------------------------------------------------------

create or replace function public.household_role_of(_household_id uuid)
returns public.household_role
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.household_members m
  where m.household_id = _household_id
    and m.user_id = auth.uid();
$$;

create or replace function public.can_view_finances(_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_household_role(_household_id, array['owner', 'admin', 'adult']::public.household_role[]);
$$;

create or replace function public.can_manage_budget_plan(_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_household_role(_household_id, array['owner', 'admin']::public.household_role[]);
$$;

create or replace function public.can_enter_budget_amounts(_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_finances(_household_id);
$$;

create or replace function public.can_edit_finance_records(_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_finances(_household_id);
$$;

create or replace function public.can_view_shared(
  _household_id uuid,
  _created_by uuid,
  _visibility text,
  _shared boolean
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_household_member(_household_id)
    and (
      public.has_household_role(_household_id, array['owner', 'admin']::public.household_role[])
      or _created_by is not distinct from auth.uid()
      or _visibility = 'household'
      or (_visibility = 'people' and _shared)
    );
$$;

create or replace function public.can_edit_shared(
  _household_id uuid,
  _created_by uuid,
  _visibility text,
  _shared boolean,
  _teen_edits_household boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.household_role_of(_household_id)
    when 'owner' then true
    when 'admin' then true
    when 'adult' then public.can_view_shared(_household_id, _created_by, _visibility, _shared)
    when 'teen' then
      _created_by is not distinct from auth.uid()
      or (_teen_edits_household and _visibility = 'household')
    else false
  end;
$$;

create or replace function public.can_create_shared(_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_household_role(
    _household_id,
    array['owner', 'admin', 'adult', 'teen']::public.household_role[]
  );
$$;

create or replace function public.stash_list_shared_with_me(_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stash_list_people slp
    join public.household_people hp on hp.id = slp.person_id
    where slp.list_id = _list_id
      and hp.user_id = auth.uid()
  );
$$;

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
      and public.can_view_shared(
        l.household_id,
        l.created_by,
        l.visibility,
        public.stash_list_shared_with_me(l.id)
      )
  );
$$;

create or replace function public.can_edit_stash_list(_list_id uuid)
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
      and public.can_edit_shared(
        l.household_id,
        l.created_by,
        l.visibility,
        public.stash_list_shared_with_me(l.id),
        false
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Member role changes, removal, invites
-- ---------------------------------------------------------------------------

create or replace function public.create_household_invite(
  p_household_id uuid,
  p_role public.household_role default 'adult',
  p_email text default null,
  p_ttl_hours integer default 168
)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
  v_hash text;
  v_exp timestamptz;
  v_id uuid;
  v_ttl integer := coalesce(p_ttl_hours, 168);
  v_actor public.household_role;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_role = 'owner' or p_role = 'member' then
    raise exception 'That role cannot be invited';
  end if;

  select role into v_actor
  from public.household_members
  where household_id = p_household_id
    and user_id = v_uid;

  if v_actor is null or v_actor not in ('owner', 'admin', 'adult') then
    raise exception 'Not allowed to invite members';
  end if;

  if v_actor = 'adult' and p_role = 'admin' then
    raise exception 'Adults cannot invite an admin';
  end if;

  if v_ttl < 1 or v_ttl > 720 then
    raise exception 'Invite lifetime must be between 1 and 720 hours';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_exp := now() + make_interval(hours => v_ttl);

  insert into public.household_invites (
    household_id, token_hash, email, role, expires_at, created_by
  )
  values (
    p_household_id, v_hash, nullif(trim(coalesce(p_email, '')), ''), p_role, v_exp, v_uid
  )
  returning id into v_id;

  return query select v_id, v_token, v_exp;
end;
$$;

create or replace function public.revoke_household_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_actor public.household_role;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select household_id into v_household_id
  from public.household_invites
  where id = p_invite_id;

  if v_household_id is null then
    raise exception 'Invite not found';
  end if;

  select role into v_actor
  from public.household_members
  where household_id = v_household_id
    and user_id = auth.uid();

  if v_actor is null or v_actor not in ('owner', 'admin', 'adult') then
    raise exception 'Not allowed to revoke invites';
  end if;

  update public.household_invites
  set revoked_at = now()
  where id = p_invite_id
    and accepted_at is null
    and revoked_at is null;
end;
$$;

create or replace function public.set_household_member_role(
  p_household_id uuid,
  p_user_id uuid,
  p_role public.household_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor public.household_role;
  v_target public.household_role;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id = v_uid then
    raise exception 'You cannot change your own role';
  end if;

  select role into v_actor
  from public.household_members
  where household_id = p_household_id
    and user_id = v_uid;

  select role into v_target
  from public.household_members
  where household_id = p_household_id
    and user_id = p_user_id;

  if v_actor is null or v_target is null then
    raise exception 'Not a member of this household';
  end if;

  if v_target = 'owner' or p_role = 'owner' or p_role = 'member' then
    raise exception 'That role cannot be assigned';
  end if;

  if v_actor in ('owner', 'admin') then
    if p_role not in ('admin', 'adult', 'teen', 'child') then
      raise exception 'That role cannot be assigned';
    end if;
  elsif v_actor = 'adult' then
    if v_target not in ('adult', 'teen', 'child') or p_role not in ('adult', 'teen', 'child') then
      raise exception 'You can only change adult, teen, and child roles';
    end if;
  else
    raise exception 'Not allowed to change roles';
  end if;

  update public.household_members
  set role = p_role
  where household_id = p_household_id
    and user_id = p_user_id;
end;
$$;

create or replace function public.remove_household_member(
  p_household_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor public.household_role;
  v_target public.household_role;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id = v_uid then
    raise exception 'Use leave to remove yourself';
  end if;

  select role into v_actor
  from public.household_members
  where household_id = p_household_id
    and user_id = v_uid;

  select role into v_target
  from public.household_members
  where household_id = p_household_id
    and user_id = p_user_id;

  if v_actor is null or v_target is null then
    raise exception 'Not a member of this household';
  end if;

  if v_actor not in ('owner', 'admin') then
    raise exception 'Not allowed to remove members';
  end if;

  if v_target not in ('adult', 'teen', 'child') then
    raise exception 'Change an admin to another role before removing them';
  end if;

  delete from public.household_members
  where household_id = p_household_id
    and user_id = p_user_id;
end;
$$;

revoke all on function public.household_role_of(uuid) from public;
revoke all on function public.can_view_finances(uuid) from public;
revoke all on function public.can_manage_budget_plan(uuid) from public;
revoke all on function public.can_enter_budget_amounts(uuid) from public;
revoke all on function public.can_edit_finance_records(uuid) from public;
revoke all on function public.can_view_shared(uuid, uuid, text, boolean) from public;
revoke all on function public.can_edit_shared(uuid, uuid, text, boolean, boolean) from public;
revoke all on function public.can_create_shared(uuid) from public;
revoke all on function public.stash_list_shared_with_me(uuid) from public;
revoke all on function public.can_edit_stash_list(uuid) from public;
revoke all on function public.set_household_member_role(uuid, uuid, public.household_role) from public;
revoke all on function public.remove_household_member(uuid, uuid) from public;

grant execute on function public.household_role_of(uuid) to authenticated;
grant execute on function public.can_view_finances(uuid) to authenticated;
grant execute on function public.can_manage_budget_plan(uuid) to authenticated;
grant execute on function public.can_enter_budget_amounts(uuid) to authenticated;
grant execute on function public.can_edit_finance_records(uuid) to authenticated;
grant execute on function public.can_view_shared(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.can_edit_shared(uuid, uuid, text, boolean, boolean) to authenticated;
grant execute on function public.can_create_shared(uuid) to authenticated;
grant execute on function public.stash_list_shared_with_me(uuid) to authenticated;
grant execute on function public.can_edit_stash_list(uuid) to authenticated;
grant execute on function public.set_household_member_role(uuid, uuid, public.household_role) to authenticated;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;

drop policy if exists household_members_update on public.household_members;

drop policy if exists household_members_delete on public.household_members;
create policy household_members_delete on public.household_members
  for delete to authenticated
  using (
    (
      user_id = auth.uid()
      and role <> 'owner'
    )
    or (
      user_id = auth.uid()
      and role = 'owner'
      and (
        select count(*)
        from public.household_members owners
        where owners.household_id = household_members.household_id
          and owners.role = 'owner'
      ) > 1
    )
    or (
      public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
      and role in ('adult', 'teen', 'child')
      and user_id <> auth.uid()
    )
  );

drop policy if exists household_invites_select on public.household_invites;
create policy household_invites_select on public.household_invites
  for select to authenticated
  using (
    public.has_household_role(household_id, array['owner', 'admin', 'adult']::public.household_role[])
  );

-- ---------------------------------------------------------------------------
-- Lists
-- ---------------------------------------------------------------------------

drop policy if exists stash_lists_select on public.stash_lists;
create policy stash_lists_select on public.stash_lists
  for select to authenticated
  using (
    public.is_household_member(household_id)
    and (
      public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
      or created_by = auth.uid()
      or visibility = 'household'
      or (
        visibility = 'people'
        and exists (
          select 1
          from public.stash_list_people slp
          join public.household_people hp on hp.id = slp.person_id
          where slp.list_id = stash_lists.id
            and hp.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists stash_lists_insert on public.stash_lists;
create policy stash_lists_insert on public.stash_lists
  for insert to authenticated
  with check (public.can_create_shared(household_id));

drop policy if exists stash_lists_update on public.stash_lists;
create policy stash_lists_update on public.stash_lists
  for update to authenticated
  using (public.can_edit_stash_list(id))
  with check (public.can_edit_stash_list(id));

drop policy if exists stash_lists_delete on public.stash_lists;
create policy stash_lists_delete on public.stash_lists
  for delete to authenticated
  using (public.can_edit_stash_list(id));

drop policy if exists stash_list_items_insert on public.stash_list_items;
drop policy if exists stash_list_items_update on public.stash_list_items;
drop policy if exists stash_list_items_delete on public.stash_list_items;
create policy stash_list_items_insert on public.stash_list_items
  for insert to authenticated
  with check (public.can_edit_stash_list(list_id));
create policy stash_list_items_update on public.stash_list_items
  for update to authenticated
  using (public.can_edit_stash_list(list_id))
  with check (public.can_edit_stash_list(list_id));
create policy stash_list_items_delete on public.stash_list_items
  for delete to authenticated
  using (public.can_edit_stash_list(list_id));

drop policy if exists stash_list_products_insert on public.stash_list_products;
drop policy if exists stash_list_products_update on public.stash_list_products;
drop policy if exists stash_list_products_delete on public.stash_list_products;
create policy stash_list_products_insert on public.stash_list_products
  for insert to authenticated
  with check (public.can_edit_stash_list(list_id));
create policy stash_list_products_update on public.stash_list_products
  for update to authenticated
  using (public.can_edit_stash_list(list_id))
  with check (public.can_edit_stash_list(list_id));
create policy stash_list_products_delete on public.stash_list_products
  for delete to authenticated
  using (public.can_edit_stash_list(list_id));

drop policy if exists stash_list_people_write on public.stash_list_people;
create policy stash_list_people_write on public.stash_list_people
  for all to authenticated
  using (public.can_edit_stash_list(list_id))
  with check (public.can_edit_stash_list(list_id));

drop policy if exists stash_products_insert on public.stash_products;
drop policy if exists stash_products_update on public.stash_products;
drop policy if exists stash_products_delete on public.stash_products;
create policy stash_products_insert on public.stash_products
  for insert to authenticated
  with check (public.can_create_shared(household_id));
create policy stash_products_update on public.stash_products
  for update to authenticated
  using (
    public.can_edit_shared(household_id, created_by, 'household', false, false)
    or exists (
      select 1
      from public.stash_list_products lp
      where lp.product_id = stash_products.id
        and public.can_edit_stash_list(lp.list_id)
    )
  )
  with check (public.can_create_shared(household_id));
create policy stash_products_delete on public.stash_products
  for delete to authenticated
  using (
    public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
    or created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Saves: same sharing as lists
-- ---------------------------------------------------------------------------

alter table public.stash_links
  add column if not exists visibility text not null default 'household';

alter table public.stash_links
  drop constraint if exists stash_links_visibility_check;

alter table public.stash_links
  add constraint stash_links_visibility_check
  check (visibility in ('household', 'private', 'people'));

alter table public.stash_link_collections
  add column if not exists visibility text not null default 'household';

alter table public.stash_link_collections
  drop constraint if exists stash_link_collections_visibility_check;

alter table public.stash_link_collections
  add constraint stash_link_collections_visibility_check
  check (visibility in ('household', 'private', 'people'));

alter table public.stash_links
  drop constraint if exists stash_links_household_id_canonical_url_key;

create unique index if not exists stash_links_household_creator_url_idx
  on public.stash_links (household_id, created_by, canonical_url);

create table if not exists public.stash_link_people (
  household_id uuid not null references public.households (id) on delete cascade,
  link_id uuid not null references public.stash_links (id) on delete cascade,
  person_id uuid not null references public.household_people (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (link_id, person_id)
);

create table if not exists public.stash_link_collection_people (
  household_id uuid not null references public.households (id) on delete cascade,
  collection_id uuid not null references public.stash_link_collections (id) on delete cascade,
  person_id uuid not null references public.household_people (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, person_id)
);

create or replace function public.link_shared_with_me(_link_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.stash_link_people slp
    join public.household_people hp on hp.id = slp.person_id
    where slp.link_id = _link_id and hp.user_id = auth.uid()
  );
$$;

create or replace function public.collection_shared_with_me(_collection_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.stash_link_collection_people slp
    join public.household_people hp on hp.id = slp.person_id
    where slp.collection_id = _collection_id and hp.user_id = auth.uid()
  );
$$;

drop policy if exists stash_links_all on public.stash_links;
drop policy if exists stash_link_collections_all on public.stash_link_collections;
drop policy if exists stash_link_collection_items_all on public.stash_link_collection_items;

create policy stash_links_select on public.stash_links
  for select to authenticated
  using (
    public.is_household_member(household_id)
    and (
      public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
      or created_by = auth.uid()
      or visibility = 'household'
      or (
        visibility = 'people'
        and public.link_shared_with_me(id)
      )
    )
  );

create policy stash_links_insert on public.stash_links
  for insert to authenticated
  with check (public.can_create_shared(household_id) and created_by = auth.uid());

create policy stash_links_update on public.stash_links
  for update to authenticated
  using (
    public.can_edit_shared(household_id, created_by, visibility, public.link_shared_with_me(id), false)
  )
  with check (
    public.can_edit_shared(household_id, created_by, visibility, public.link_shared_with_me(id), false)
  );

create policy stash_links_delete on public.stash_links
  for delete to authenticated
  using (
    public.can_edit_shared(household_id, created_by, visibility, public.link_shared_with_me(id), false)
  );

create policy stash_link_collections_select on public.stash_link_collections
  for select to authenticated
  using (
    public.is_household_member(household_id)
    and (
      public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
      or created_by = auth.uid()
      or visibility = 'household'
      or (
        visibility = 'people'
        and public.collection_shared_with_me(id)
      )
    )
  );

create policy stash_link_collections_insert on public.stash_link_collections
  for insert to authenticated
  with check (public.can_create_shared(household_id));

create policy stash_link_collections_update on public.stash_link_collections
  for update to authenticated
  using (
    public.can_edit_shared(household_id, created_by, visibility, public.collection_shared_with_me(id), false)
  )
  with check (
    public.can_edit_shared(household_id, created_by, visibility, public.collection_shared_with_me(id), false)
  );

create policy stash_link_collections_delete on public.stash_link_collections
  for delete to authenticated
  using (
    public.can_edit_shared(household_id, created_by, visibility, public.collection_shared_with_me(id), false)
  );

create policy stash_link_collection_items_select on public.stash_link_collection_items
  for select to authenticated
  using (
    public.can_view_shared(
      household_id,
      (select created_by from public.stash_links where id = link_id),
      (select visibility from public.stash_links where id = link_id),
      public.link_shared_with_me(link_id)
    )
    and public.can_view_shared(
      household_id,
      (select created_by from public.stash_link_collections where id = collection_id),
      (select visibility from public.stash_link_collections where id = collection_id),
      public.collection_shared_with_me(collection_id)
    )
  );

create policy stash_link_collection_items_write on public.stash_link_collection_items
  for all to authenticated
  using (
    public.can_edit_shared(
      household_id,
      (select created_by from public.stash_links where id = link_id),
      (select visibility from public.stash_links where id = link_id),
      public.link_shared_with_me(link_id),
      false
    )
  )
  with check (
    public.can_edit_shared(
      household_id,
      (select created_by from public.stash_links where id = link_id),
      (select visibility from public.stash_links where id = link_id),
      public.link_shared_with_me(link_id),
      false
    )
  );

alter table public.stash_link_people enable row level security;
alter table public.stash_link_collection_people enable row level security;

create policy stash_link_people_select on public.stash_link_people
  for select to authenticated
  using (
    public.can_view_shared(
      household_id,
      (select created_by from public.stash_links where id = link_id),
      (select visibility from public.stash_links where id = link_id),
      public.link_shared_with_me(link_id)
    )
  );

create policy stash_link_people_write on public.stash_link_people
  for all to authenticated
  using (
    public.can_edit_shared(
      household_id,
      (select created_by from public.stash_links where id = link_id),
      (select visibility from public.stash_links where id = link_id),
      true,
      false
    )
  )
  with check (
    public.can_edit_shared(
      household_id,
      (select created_by from public.stash_links where id = link_id),
      'people',
      true,
      false
    )
  );

create policy stash_link_collection_people_select on public.stash_link_collection_people
  for select to authenticated
  using (
    public.can_view_shared(
      household_id,
      (select created_by from public.stash_link_collections where id = collection_id),
      (select visibility from public.stash_link_collections where id = collection_id),
      public.collection_shared_with_me(collection_id)
    )
  );

create policy stash_link_collection_people_write on public.stash_link_collection_people
  for all to authenticated
  using (
    public.can_edit_shared(
      household_id,
      (select created_by from public.stash_link_collections where id = collection_id),
      (select visibility from public.stash_link_collections where id = collection_id),
      true,
      false
    )
  )
  with check (
    public.can_edit_shared(
      household_id,
      (select created_by from public.stash_link_collections where id = collection_id),
      'people',
      true,
      false
    )
  );

grant select, insert, update, delete on table public.stash_link_people to authenticated;
grant select, insert, update, delete on table public.stash_link_collection_people to authenticated;
grant execute on function public.link_shared_with_me(uuid) to authenticated;
grant execute on function public.collection_shared_with_me(uuid) to authenticated;

create index if not exists stash_link_people_household_idx on public.stash_link_people (household_id);
create index if not exists stash_link_collection_people_household_idx on public.stash_link_collection_people (household_id);

-- ---------------------------------------------------------------------------
-- Watchlists: private and specific people, same as lists
-- ---------------------------------------------------------------------------

alter table public.watchlist_lists drop constraint if exists watchlist_lists_visibility_check;

update public.watchlist_lists set visibility = 'private' where visibility = 'personal';

alter table public.watchlist_lists
  add constraint watchlist_lists_visibility_check
  check (visibility in ('household', 'private', 'people'));

create table if not exists public.watchlist_list_people (
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.watchlist_lists (id) on delete cascade,
  person_id uuid not null references public.household_people (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, person_id)
);

create or replace function public.watchlist_shared_with_me(_list_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.watchlist_list_people wlp
    join public.household_people hp on hp.id = wlp.person_id
    where wlp.list_id = _list_id and hp.user_id = auth.uid()
  );
$$;

create or replace function public.can_view_watchlist_list(_list_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.watchlist_lists l
    where l.id = _list_id
      and public.can_view_shared(
        l.household_id,
        l.created_by,
        l.visibility,
        public.watchlist_shared_with_me(l.id)
      )
  );
$$;

create or replace function public.can_manage_watchlist_list(_list_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.watchlist_lists l
    where l.id = _list_id
      and public.can_edit_shared(
        l.household_id,
        l.created_by,
        l.visibility,
        public.watchlist_shared_with_me(l.id),
        true
      )
  );
$$;

drop policy if exists watchlist_lists_insert on public.watchlist_lists;
create policy watchlist_lists_insert on public.watchlist_lists
  for insert to authenticated
  with check (
    public.can_create_shared(household_id)
    and (visibility = 'household' or visibility = 'people' or (visibility = 'private' and created_by = auth.uid()))
  );

drop policy if exists watchlist_lists_update on public.watchlist_lists;
create policy watchlist_lists_update on public.watchlist_lists
  for update to authenticated
  using (public.can_manage_watchlist_list(id))
  with check (
    public.can_create_shared(household_id)
    and (visibility = 'household' or visibility = 'people' or (visibility = 'private' and created_by = auth.uid()))
  );

drop policy if exists watchlist_items_insert on public.watchlist_items;
drop policy if exists watchlist_items_update on public.watchlist_items;
drop policy if exists watchlist_items_delete on public.watchlist_items;
create policy watchlist_items_insert on public.watchlist_items
  for insert to authenticated
  with check (public.can_manage_watchlist_list(list_id));
create policy watchlist_items_update on public.watchlist_items
  for update to authenticated
  using (public.can_manage_watchlist_list(list_id))
  with check (public.can_manage_watchlist_list(list_id));
create policy watchlist_items_delete on public.watchlist_items
  for delete to authenticated
  using (public.can_manage_watchlist_list(list_id));

drop policy if exists watchlist_titles_insert on public.watchlist_titles;
drop policy if exists watchlist_titles_update on public.watchlist_titles;
drop policy if exists watchlist_titles_delete on public.watchlist_titles;
create policy watchlist_titles_insert on public.watchlist_titles
  for insert to authenticated
  with check (public.can_create_shared(household_id));
create policy watchlist_titles_update on public.watchlist_titles
  for update to authenticated
  using (public.can_create_shared(household_id))
  with check (public.can_create_shared(household_id));
create policy watchlist_titles_delete on public.watchlist_titles
  for delete to authenticated
  using (public.can_create_shared(household_id));

alter table public.watchlist_list_people enable row level security;
grant select, insert, update, delete on table public.watchlist_list_people to authenticated;

create policy watchlist_list_people_select on public.watchlist_list_people
  for select to authenticated
  using (public.can_view_watchlist_list(list_id));

create policy watchlist_list_people_write on public.watchlist_list_people
  for all to authenticated
  using (public.can_manage_watchlist_list(list_id))
  with check (public.can_manage_watchlist_list(list_id));

grant execute on function public.watchlist_shared_with_me(uuid) to authenticated;
create index if not exists watchlist_list_people_household_idx on public.watchlist_list_people (household_id);

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Finances: teens and children cannot read them. Adults enter amounts and edit
-- accounts, but cannot change the planned budget.
-- ---------------------------------------------------------------------------

alter table public.finance_budget_txns
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

create or replace function public.finance_budget_txn_owner()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists finance_budget_txns_owner on public.finance_budget_txns;
create trigger finance_budget_txns_owner
  before insert on public.finance_budget_txns
  for each row execute function public.finance_budget_txn_owner();

drop policy if exists finance_accounts_select on public.finance_accounts;
drop policy if exists finance_accounts_write on public.finance_accounts;
drop policy if exists finance_accounts_update on public.finance_accounts;
drop policy if exists finance_accounts_delete on public.finance_accounts;
create policy finance_accounts_select on public.finance_accounts
  for select to authenticated using (public.can_view_finances(household_id));
create policy finance_accounts_write on public.finance_accounts
  for insert to authenticated with check (public.can_edit_finance_records(household_id));
create policy finance_accounts_update on public.finance_accounts
  for update to authenticated
  using (public.can_edit_finance_records(household_id))
  with check (public.can_edit_finance_records(household_id));
create policy finance_accounts_delete on public.finance_accounts
  for delete to authenticated using (public.can_manage_budget_plan(household_id));

drop policy if exists finance_budgets_select on public.finance_budgets;
drop policy if exists finance_budgets_write on public.finance_budgets;
drop policy if exists finance_budgets_update on public.finance_budgets;
drop policy if exists finance_budgets_delete on public.finance_budgets;
create policy finance_budgets_select on public.finance_budgets
  for select to authenticated using (public.can_view_finances(household_id));
create policy finance_budgets_write on public.finance_budgets
  for insert to authenticated with check (public.can_manage_budget_plan(household_id));
create policy finance_budgets_update on public.finance_budgets
  for update to authenticated
  using (public.can_manage_budget_plan(household_id))
  with check (public.can_manage_budget_plan(household_id));
create policy finance_budgets_delete on public.finance_budgets
  for delete to authenticated using (public.can_manage_budget_plan(household_id));

drop policy if exists finance_budget_lines_select on public.finance_budget_lines;
drop policy if exists finance_budget_lines_write on public.finance_budget_lines;
drop policy if exists finance_budget_lines_update on public.finance_budget_lines;
drop policy if exists finance_budget_lines_delete on public.finance_budget_lines;
create policy finance_budget_lines_select on public.finance_budget_lines
  for select to authenticated using (public.can_view_finances(household_id));
create policy finance_budget_lines_write on public.finance_budget_lines
  for insert to authenticated with check (public.can_manage_budget_plan(household_id));
create policy finance_budget_lines_update on public.finance_budget_lines
  for update to authenticated
  using (public.can_manage_budget_plan(household_id))
  with check (public.can_manage_budget_plan(household_id));
create policy finance_budget_lines_delete on public.finance_budget_lines
  for delete to authenticated using (public.can_manage_budget_plan(household_id));

drop policy if exists finance_budget_txns_select on public.finance_budget_txns;
drop policy if exists finance_budget_txns_write on public.finance_budget_txns;
drop policy if exists finance_budget_txns_update on public.finance_budget_txns;
drop policy if exists finance_budget_txns_delete on public.finance_budget_txns;
create policy finance_budget_txns_select on public.finance_budget_txns
  for select to authenticated using (public.can_view_finances(household_id));
create policy finance_budget_txns_write on public.finance_budget_txns
  for insert to authenticated with check (public.can_enter_budget_amounts(household_id));
create policy finance_budget_txns_update on public.finance_budget_txns
  for update to authenticated
  using (
    public.can_manage_budget_plan(household_id)
    or (public.household_role_of(household_id) = 'adult' and created_by = auth.uid())
  )
  with check (
    public.can_manage_budget_plan(household_id)
    or (public.household_role_of(household_id) = 'adult' and created_by = auth.uid())
  );
create policy finance_budget_txns_delete on public.finance_budget_txns
  for delete to authenticated
  using (
    public.can_manage_budget_plan(household_id)
    or (public.household_role_of(household_id) = 'adult' and created_by = auth.uid())
  );

drop policy if exists finance_share_portfolios_select on public.finance_share_portfolios;
drop policy if exists finance_share_portfolios_write on public.finance_share_portfolios;
drop policy if exists finance_share_portfolios_update on public.finance_share_portfolios;
drop policy if exists finance_share_portfolios_delete on public.finance_share_portfolios;
create policy finance_share_portfolios_select on public.finance_share_portfolios
  for select to authenticated using (public.can_view_finances(household_id));
create policy finance_share_portfolios_write on public.finance_share_portfolios
  for insert to authenticated with check (public.can_edit_finance_records(household_id));
create policy finance_share_portfolios_update on public.finance_share_portfolios
  for update to authenticated
  using (public.can_edit_finance_records(household_id))
  with check (public.can_edit_finance_records(household_id));
create policy finance_share_portfolios_delete on public.finance_share_portfolios
  for delete to authenticated using (public.can_manage_budget_plan(household_id));

drop policy if exists finance_share_holdings_select on public.finance_share_holdings;
drop policy if exists finance_share_holdings_write on public.finance_share_holdings;
drop policy if exists finance_share_holdings_update on public.finance_share_holdings;
drop policy if exists finance_share_holdings_delete on public.finance_share_holdings;
create policy finance_share_holdings_select on public.finance_share_holdings
  for select to authenticated using (public.can_view_finances(household_id));
create policy finance_share_holdings_write on public.finance_share_holdings
  for insert to authenticated with check (public.can_edit_finance_records(household_id));
create policy finance_share_holdings_update on public.finance_share_holdings
  for update to authenticated
  using (public.can_edit_finance_records(household_id))
  with check (public.can_edit_finance_records(household_id));
create policy finance_share_holdings_delete on public.finance_share_holdings
  for delete to authenticated using (public.can_manage_budget_plan(household_id));

drop policy if exists finance_crypto_holdings_select on public.finance_crypto_holdings;
drop policy if exists finance_crypto_holdings_write on public.finance_crypto_holdings;
drop policy if exists finance_crypto_holdings_update on public.finance_crypto_holdings;
drop policy if exists finance_crypto_holdings_delete on public.finance_crypto_holdings;
create policy finance_crypto_holdings_select on public.finance_crypto_holdings
  for select to authenticated using (public.can_view_finances(household_id));
create policy finance_crypto_holdings_write on public.finance_crypto_holdings
  for insert to authenticated with check (public.can_edit_finance_records(household_id));
create policy finance_crypto_holdings_update on public.finance_crypto_holdings
  for update to authenticated
  using (public.can_edit_finance_records(household_id))
  with check (public.can_edit_finance_records(household_id));
create policy finance_crypto_holdings_delete on public.finance_crypto_holdings
  for delete to authenticated using (public.can_manage_budget_plan(household_id));

drop policy if exists finance_metal_holdings_select on public.finance_metal_holdings;
drop policy if exists finance_metal_holdings_write on public.finance_metal_holdings;
drop policy if exists finance_metal_holdings_update on public.finance_metal_holdings;
drop policy if exists finance_metal_holdings_delete on public.finance_metal_holdings;
create policy finance_metal_holdings_select on public.finance_metal_holdings
  for select to authenticated using (public.can_view_finances(household_id));
create policy finance_metal_holdings_write on public.finance_metal_holdings
  for insert to authenticated with check (public.can_edit_finance_records(household_id));
create policy finance_metal_holdings_update on public.finance_metal_holdings
  for update to authenticated
  using (public.can_edit_finance_records(household_id))
  with check (public.can_edit_finance_records(household_id));
create policy finance_metal_holdings_delete on public.finance_metal_holdings
  for delete to authenticated using (public.can_manage_budget_plan(household_id));

drop policy if exists finance_collectibles_select on public.finance_collectibles;
drop policy if exists finance_collectibles_write on public.finance_collectibles;
drop policy if exists finance_collectibles_update on public.finance_collectibles;
drop policy if exists finance_collectibles_delete on public.finance_collectibles;
create policy finance_collectibles_select on public.finance_collectibles
  for select to authenticated using (public.can_view_finances(household_id));
create policy finance_collectibles_write on public.finance_collectibles
  for insert to authenticated with check (public.can_edit_finance_records(household_id));
create policy finance_collectibles_update on public.finance_collectibles
  for update to authenticated
  using (public.can_edit_finance_records(household_id))
  with check (public.can_edit_finance_records(household_id));
create policy finance_collectibles_delete on public.finance_collectibles
  for delete to authenticated using (public.can_manage_budget_plan(household_id));

-- Meals: adults manage the plan. Teens and children only pick assigned slots.
create or replace function public.enforce_meal_slot_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_manager boolean;
  v_linked_person uuid;
  v_person_household uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_is_manager := public.has_household_role(
    new.household_id,
    array['owner', 'admin', 'adult']::public.household_role[]
  );

  if new.assigned_person_id is not null then
    select household_id into v_person_household
    from public.household_people
    where id = new.assigned_person_id;
    if v_person_household is null or v_person_household <> new.household_id then
      raise exception 'Assignee is not in this household';
    end if;
  end if;

  if v_is_manager then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'You can only pick meals on slots assigned to you';
  end if;

  if new.assigned_person_id is distinct from old.assigned_person_id
     or new.hidden is distinct from old.hidden
     or new.day is distinct from old.day
     or new.slot_key is distinct from old.slot_key then
    raise exception 'Only owners and admins can change this slot';
  end if;

  select id into v_linked_person
  from public.household_people
  where household_id = new.household_id
    and user_id = auth.uid()
  limit 1;

  if v_linked_person is null or new.assigned_person_id is distinct from v_linked_person then
    raise exception 'You can only pick meals on slots assigned to you';
  end if;

  if new.recipe_id is null then
    raise exception 'You can only pick a recipe on this slot';
  end if;

  if not exists (
    select 1
    from public.household_person_slot_recipes r
    where r.person_id = v_linked_person
      and r.slot_key = new.slot_key
      and r.recipe_id = new.recipe_id
  ) then
    raise exception 'Recipe is not on the approved list for this meal';
  end if;

  return new;
end;
$$;

drop policy if exists household_person_slot_recipes_insert on public.household_person_slot_recipes;
drop policy if exists household_person_slot_recipes_delete on public.household_person_slot_recipes;
create policy household_person_slot_recipes_insert on public.household_person_slot_recipes
  for insert to authenticated
  with check (public.has_household_role(household_id, array['owner', 'admin', 'adult']::public.household_role[]));
create policy household_person_slot_recipes_delete on public.household_person_slot_recipes
  for delete to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin', 'adult']::public.household_role[]));

create or replace function public.ensure_finance_budget(p_household_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_view_finances(p_household_id) then
    raise exception 'Not allowed to view finances';
  end if;

  select id into v_id
  from public.finance_budgets
  where household_id = p_household_id;

  if v_id is not null then
    return v_id;
  end if;

  if not public.can_manage_budget_plan(p_household_id) then
    raise exception 'Ask a household admin to set the budget';
  end if;

  insert into public.finance_budgets (household_id)
  values (p_household_id)
  on conflict (household_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.finance_budgets
    where household_id = p_household_id;
    return v_id;
  end if;

  insert into public.finance_budget_lines (
    household_id, budget_id, kind, name, planned, spent, position,
    cadence, anchor_month, parent_id, auto_apply, capture_surplus
  )
  values
    (p_household_id, v_id, 'income', 'Salary', 0, 0, 0, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'income', 'Other income', 0, 0, 1, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Housing', 0, 0, 2, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Groceries', 0, 0, 3, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Transport', 0, 0, 4, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Utilities', 0, 0, 5, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Insurance', 0, 0, 6, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Healthcare', 0, 0, 7, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Childcare', 0, 0, 8, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Entertainment', 0, 0, 9, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Subscriptions', 0, 0, 10, 'monthly', 1, null, false, false),
    (p_household_id, v_id, 'expense', 'Savings & Investments', 0, 0, 11, 'monthly', 1, null, false, true),
    (p_household_id, v_id, 'expense', 'Other', 0, 0, 12, 'monthly', 1, null, false, false);

  return v_id;
end;
$$;
