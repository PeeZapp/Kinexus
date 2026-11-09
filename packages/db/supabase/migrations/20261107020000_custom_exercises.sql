-- Custom exercises part 1: scopes, groups, RLS, publish/archive RPCs.
-- Existing catalogue rows remain scope=global / status=active.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.exercises
  add column if not exists scope text not null default 'global',
  add column if not exists owner_id uuid references public.profiles (id) on delete set null,
  add column if not exists household_id uuid references public.households (id) on delete cascade,
  add column if not exists group_id uuid,
  add column if not exists status text not null default 'active',
  add column if not exists category text,
  add column if not exists difficulty text,
  add column if not exists is_compound boolean,
  add column if not exists updated_at timestamptz not null default now();

alter table public.exercises drop constraint if exists exercises_scope_check;
alter table public.exercises
  add constraint exercises_scope_check
  check (scope in ('global', 'household', 'group', 'private'));

alter table public.exercises drop constraint if exists exercises_status_check;
alter table public.exercises
  add constraint exercises_status_check
  check (status in ('active', 'hidden'));

alter table public.exercises drop constraint if exists exercises_source;
alter table public.exercises
  add constraint exercises_source
  check (source in ('exercisedb', 'public_domain', 'wger', 'user', 'creator'));

alter table public.exercises drop constraint if exists exercises_scope_refs_check;
alter table public.exercises
  add constraint exercises_scope_refs_check
  check (
    (scope = 'global' and household_id is null and group_id is null)
    or (scope = 'private' and owner_id is not null and household_id is null and group_id is null)
    or (scope = 'household' and household_id is not null and group_id is null)
    or (scope = 'group' and group_id is not null and household_id is null)
  );

alter table public.exercises alter column id set default gen_random_uuid();

create index if not exists exercises_scope_status_idx on public.exercises (scope, status);
create index if not exists exercises_owner_idx on public.exercises (owner_id) where owner_id is not null;
create index if not exists exercises_household_idx on public.exercises (household_id) where household_id is not null;
create index if not exists exercises_group_idx on public.exercises (group_id) where group_id is not null;

drop trigger if exists exercises_set_updated_at on public.exercises;
create trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Exercise groups (buddy-backed membership)
-- ---------------------------------------------------------------------------

create table if not exists public.exercise_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists exercise_groups_owner_idx
  on public.exercise_groups (owner_id, created_at desc);

create table if not exists public.exercise_group_members (
  group_id uuid not null references public.exercise_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (group_id, user_id)
);

create index if not exists exercise_group_members_user_idx
  on public.exercise_group_members (user_id);

alter table public.exercises drop constraint if exists exercises_group_id_fkey;
alter table public.exercises
  add constraint exercises_group_id_fkey
  foreign key (group_id) references public.exercise_groups (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_exercise_group_member(_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _group_id is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.exercise_group_members m
      where m.group_id = _group_id
        and m.user_id = auth.uid()
    );
$$;

create or replace function public.can_edit_exercise_group(_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _group_id is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.exercise_groups g
      where g.id = _group_id
        and g.owner_id = auth.uid()
    );
$$;

create or replace function public.exercise_referenced_by_me(_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _exercise_id is not null
    and auth.uid() is not null
    and (
      exists (
        select 1
        from public.workout_sets ws
        where ws.exercise_id = _exercise_id
          and ws.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.exercise_records er
        where er.exercise_id = _exercise_id
          and er.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.workout_exercises we
        join public.workouts w on w.id = we.workout_id
        where we.exercise_id = _exercise_id
          and w.created_by = auth.uid()
      )
    );
$$;

create or replace function public.can_view_custom_exercise(_row public.exercises)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when _row.scope = 'global' then true
      when _row.scope = 'private' then _row.owner_id = auth.uid()
      when _row.scope = 'household' then public.is_household_member(_row.household_id)
      when _row.scope = 'group' then public.is_exercise_group_member(_row.group_id)
      else false
    end;
$$;

create or replace function public.can_edit_custom_exercise(_row public.exercises)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and _row.source in ('user', 'creator')
    and _row.scope <> 'global'
    and (
      _row.owner_id = auth.uid()
      or (
        _row.scope = 'household'
        and _row.household_id is not null
        and public.has_household_role(
          _row.household_id,
          array['owner', 'admin']::public.household_role[]
        )
      )
      or (
        _row.scope = 'group'
        and public.can_edit_exercise_group(_row.group_id)
      )
    );
$$;

create or replace function public.build_custom_exercise_canonical_key(
  p_scope text,
  p_owner_id uuid,
  p_household_id uuid,
  p_name text,
  p_exclude_id uuid default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_short text;
  v_prefix text;
  v_key text;
begin
  v_slug := public.slugify_catalog_fragment(p_name);
  if v_slug = '' then
    v_slug := 'exercise';
  end if;
  v_slug := left(v_slug, 48);

  if p_scope = 'household' and p_household_id is not null then
    v_short := replace(left(p_household_id::text, 8), '-', '');
    v_prefix := 'hh_';
  elsif p_scope = 'global' then
    v_short := replace(left(coalesce(p_owner_id, auth.uid())::text, 8), '-', '');
    v_prefix := 'creator_';
  else
    v_short := replace(left(coalesce(p_owner_id, auth.uid())::text, 8), '-', '');
    v_prefix := 'user_';
  end if;

  if v_short = '' then
    v_short := 'unknown';
  end if;

  v_key := v_prefix || v_short || '_' || v_slug;
  if exists (
    select 1
    from public.exercises e
    where e.canonical_key = v_key
      and (p_exclude_id is null or e.id is distinct from p_exclude_id)
  ) then
    v_key := v_key || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  end if;
  return v_key;
end;
$$;

create or replace function public.exercises_custom_canonical_key_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source in ('user', 'creator')
     and (
       tg_op = 'INSERT'
       or new.name is distinct from old.name
       or new.scope is distinct from old.scope
       or new.owner_id is distinct from old.owner_id
       or new.household_id is distinct from old.household_id
       or coalesce(new.canonical_key, '') = ''
     )
  then
    new.canonical_key := public.build_custom_exercise_canonical_key(
      new.scope,
      new.owner_id,
      new.household_id,
      new.name,
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists exercises_custom_canonical_key_guard on public.exercises;
create trigger exercises_custom_canonical_key_guard
  before insert or update on public.exercises
  for each row execute function public.exercises_custom_canonical_key_guard();

create or replace function public.exercises_client_mutation_guard()
returns trigger
language plpgsql
as $$
begin
  -- Security-definer RPCs (publish/archive) run as the function owner, not authenticated.
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  -- Catalogue rows are immutable from the client.
  if tg_op = 'UPDATE' and old.source in ('exercisedb', 'public_domain', 'wger') then
    raise exception 'Catalogue exercises cannot be modified';
  end if;
  if tg_op = 'DELETE' and old.source in ('exercisedb', 'public_domain', 'wger') then
    raise exception 'Catalogue exercises cannot be deleted';
  end if;

  if tg_op = 'INSERT' then
    if new.source in ('exercisedb', 'public_domain', 'wger') then
      raise exception 'Catalogue exercises cannot be inserted by clients';
    end if;
    if new.scope = 'global' then
      raise exception 'Use publish_global_exercise to publish globally';
    end if;
    if new.source is distinct from 'user' then
      raise exception 'Custom exercises must use source=user';
    end if;
    if new.owner_id is distinct from auth.uid() then
      raise exception 'owner_id must be the signed-in user';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.scope = 'global' and old.scope is distinct from 'global' then
      raise exception 'Use publish_global_exercise to publish globally';
    end if;
    if new.scope = 'global' and old.scope = 'global' and old.source = 'creator' then
      if new.owner_id is distinct from auth.uid() and not public.is_platform_staff() then
        raise exception 'Only the creator can edit a published exercise';
      end if;
      if not public.is_approved_creator() and not public.is_platform_staff() then
        raise exception 'Creator access required';
      end if;
    elsif new.source in ('user', 'creator') and new.scope <> 'global' then
      if not public.can_edit_custom_exercise(old) then
        raise exception 'Not allowed to edit this exercise';
      end if;
    end if;
    if new.source is distinct from old.source
       and old.source in ('user', 'creator')
       and new.source in ('exercisedb', 'public_domain', 'wger')
    then
      raise exception 'Cannot convert a custom exercise into a catalogue row';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists exercises_client_mutation_guard on public.exercises;
create trigger exercises_client_mutation_guard
  before insert or update or delete on public.exercises
  for each row execute function public.exercises_client_mutation_guard();

create or replace function public.exercise_group_owner_member_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.exercise_group_members (group_id, user_id)
  values (new.id, new.owner_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists exercise_groups_owner_member on public.exercise_groups;
create trigger exercise_groups_owner_member
  after insert on public.exercise_groups
  for each row execute function public.exercise_group_owner_member_guard();

create or replace function public.exercise_group_members_buddy_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner
  from public.exercise_groups
  where id = new.group_id;

  if v_owner is null then
    raise exception 'Exercise group not found';
  end if;

  if new.user_id = v_owner then
    return new;
  end if;

  if not public.are_train_buddies(v_owner, new.user_id) then
    raise exception 'Group members must be accepted train buddies of the owner';
  end if;

  return new;
end;
$$;

drop trigger if exists exercise_group_members_buddy_guard on public.exercise_group_members;
create trigger exercise_group_members_buddy_guard
  before insert or update on public.exercise_group_members
  for each row execute function public.exercise_group_members_buddy_guard();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.publish_global_exercise(p_source_exercise_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_src public.exercises%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_approved_creator() and not public.is_platform_staff() then
    raise exception 'Only approved creators can publish exercises';
  end if;

  select * into v_src
  from public.exercises
  where id = p_source_exercise_id
  for update;

  if not found then
    raise exception 'Exercise not found';
  end if;
  if v_src.source not in ('user', 'creator') then
    raise exception 'Only custom exercises can be published';
  end if;
  if v_src.owner_id is distinct from v_uid and not public.is_platform_staff() then
    raise exception 'Only the owner can publish this exercise';
  end if;
  if char_length(trim(v_src.name)) = 0 then
    raise exception 'Exercise needs a name';
  end if;

  update public.exercises
  set
    scope = 'global',
    source = 'creator',
    status = 'active',
    household_id = null,
    group_id = null,
    owner_id = v_uid,
    canonical_key = public.build_custom_exercise_canonical_key(
      'global',
      v_uid,
      null,
      v_src.name,
      v_src.id
    ),
    updated_at = now()
  where id = v_src.id;

  return v_src.id;
end;
$$;

create or replace function public.archive_exercise(p_exercise_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.exercises%rowtype;
  v_referenced boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.exercises
  where id = p_exercise_id
  for update;

  if not found then
    raise exception 'Exercise not found';
  end if;
  if v_row.source in ('exercisedb', 'public_domain', 'wger') then
    raise exception 'Catalogue exercises cannot be archived';
  end if;
  if not (
    v_row.owner_id = v_uid
    or public.is_platform_staff()
    or (
      v_row.scope = 'household'
      and public.has_household_role(
        v_row.household_id,
        array['owner', 'admin']::public.household_role[]
      )
    )
    or (
      v_row.scope = 'group'
      and public.can_edit_exercise_group(v_row.group_id)
    )
  ) then
    raise exception 'Not allowed';
  end if;

  v_referenced := exists (
    select 1 from public.workout_exercises where exercise_id = v_row.id
  ) or exists (
    select 1 from public.workout_sets where exercise_id = v_row.id
  ) or exists (
    select 1 from public.exercise_records where exercise_id = v_row.id
  );

  if v_referenced then
    update public.exercises
    set status = 'hidden', updated_at = now()
    where id = v_row.id;
    return 'hidden';
  end if;

  delete from public.exercises where id = v_row.id;
  return 'deleted';
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table public.exercises to authenticated;
grant select, insert, update, delete on table public.exercise_groups to authenticated;
grant select, insert, update, delete on table public.exercise_group_members to authenticated;

revoke all on function public.is_exercise_group_member(uuid) from public;
revoke all on function public.can_edit_exercise_group(uuid) from public;
revoke all on function public.exercise_referenced_by_me(uuid) from public;
revoke all on function public.can_view_custom_exercise(public.exercises) from public;
revoke all on function public.can_edit_custom_exercise(public.exercises) from public;
revoke all on function public.build_custom_exercise_canonical_key(text, uuid, uuid, text, uuid) from public;
revoke all on function public.publish_global_exercise(uuid) from public;
revoke all on function public.archive_exercise(uuid) from public;

grant execute on function public.is_exercise_group_member(uuid) to authenticated;
grant execute on function public.can_edit_exercise_group(uuid) to authenticated;
grant execute on function public.exercise_referenced_by_me(uuid) to authenticated;
grant execute on function public.publish_global_exercise(uuid) to authenticated;
grant execute on function public.archive_exercise(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.exercise_groups enable row level security;
alter table public.exercise_group_members enable row level security;

drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises
  for select to authenticated
  using (
    (
      status = 'active'
      and (
        scope = 'global'
        or (scope = 'private' and owner_id = auth.uid())
        or (scope = 'household' and public.is_household_member(household_id))
        or (scope = 'group' and public.is_exercise_group_member(group_id))
      )
    )
    or (
      status = 'hidden'
      and public.exercise_referenced_by_me(id)
    )
  );

drop policy if exists exercises_insert on public.exercises;
create policy exercises_insert on public.exercises
  for insert to authenticated
  with check (
    source = 'user'
    and scope in ('private', 'household', 'group')
    and owner_id = auth.uid()
    and (
      (scope = 'private' and household_id is null and group_id is null)
      or (
        scope = 'household'
        and household_id is not null
        and group_id is null
        and public.is_household_member(household_id)
      )
      or (
        scope = 'group'
        and group_id is not null
        and household_id is null
        and public.can_edit_exercise_group(group_id)
      )
    )
  );

drop policy if exists exercises_update on public.exercises;
create policy exercises_update on public.exercises
  for update to authenticated
  using (
    source in ('user', 'creator')
    and (
      (
        scope <> 'global'
        and (
          owner_id = auth.uid()
          or (
            scope = 'household'
            and public.has_household_role(
              household_id,
              array['owner', 'admin']::public.household_role[]
            )
          )
          or (
            scope = 'group'
            and public.can_edit_exercise_group(group_id)
          )
        )
      )
      or (
        scope = 'global'
        and source = 'creator'
        and owner_id = auth.uid()
        and (public.is_approved_creator() or public.is_platform_staff())
      )
    )
  )
  with check (
    source in ('user', 'creator')
    and scope in ('private', 'household', 'group', 'global')
    and (
      scope <> 'global'
      or (
        source = 'creator'
        and owner_id = auth.uid()
        and (public.is_approved_creator() or public.is_platform_staff())
      )
    )
  );

drop policy if exists exercises_delete on public.exercises;
create policy exercises_delete on public.exercises
  for delete to authenticated
  using (
    source in ('user', 'creator')
    and scope <> 'global'
    and (
      owner_id = auth.uid()
      or (
        scope = 'household'
        and public.has_household_role(
          household_id,
          array['owner', 'admin']::public.household_role[]
        )
      )
      or (
        scope = 'group'
        and public.can_edit_exercise_group(group_id)
      )
    )
  );

drop policy if exists exercise_groups_select on public.exercise_groups;
create policy exercise_groups_select on public.exercise_groups
  for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_exercise_group_member(id)
  );

drop policy if exists exercise_groups_insert on public.exercise_groups;
create policy exercise_groups_insert on public.exercise_groups
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists exercise_groups_update on public.exercise_groups;
create policy exercise_groups_update on public.exercise_groups
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists exercise_groups_delete on public.exercise_groups;
create policy exercise_groups_delete on public.exercise_groups
  for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists exercise_group_members_select on public.exercise_group_members;
create policy exercise_group_members_select on public.exercise_group_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_edit_exercise_group(group_id)
    or public.is_exercise_group_member(group_id)
  );

drop policy if exists exercise_group_members_insert on public.exercise_group_members;
create policy exercise_group_members_insert on public.exercise_group_members
  for insert to authenticated
  with check (
    public.can_edit_exercise_group(group_id)
    or (
      -- owner auto-member insert from trigger runs as definer; client path: owner only
      exists (
        select 1 from public.exercise_groups g
        where g.id = group_id and g.owner_id = auth.uid() and user_id = auth.uid()
      )
    )
  );

drop policy if exists exercise_group_members_delete on public.exercise_group_members;
create policy exercise_group_members_delete on public.exercise_group_members
  for delete to authenticated
  using (
    public.can_edit_exercise_group(group_id)
    or user_id = auth.uid()
  );

notify pgrst, 'reload schema';
