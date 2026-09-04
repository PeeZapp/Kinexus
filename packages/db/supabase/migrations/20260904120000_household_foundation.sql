-- Phase 1: profiles, households, membership, hashed invites, planning people, RLS + RPCs.
-- Invites are unguessable tokens stored only as SHA-256 hashes (not FP-XXXX codes).
-- Run this file once. If you get "type household_role already exists", skip it and
-- apply 20260904140000_meals_schema.sql next.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.household_role as enum ('owner', 'admin', 'member');
create type public.person_type as enum ('adult', 'child', 'other');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  country text,
  currency text,
  timezone text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.household_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members (user_id);

create table public.household_people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  person_type public.person_type not null default 'adult',
  birthday date,
  dietary text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index household_people_household_id_idx on public.household_people (household_id);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  token_hash text not null unique,
  email text,
  role public.household_role not null default 'member',
  expires_at timestamptz not null,
  created_by uuid not null references auth.users (id),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint household_invites_role_not_owner check (role <> 'owner')
);

create index household_invites_household_id_idx on public.household_invites (household_id);
create index household_invites_pending_idx
  on public.household_invites (household_id)
  where accepted_at is null and revoked_at is null;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

create trigger household_people_set_updated_at
  before update on public.household_people
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New auth user → profile
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, email)
  values (
    new.id,
    nullif(
      trim(
        coalesce(
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'name',
          split_part(coalesce(new.email, ''), '@', 1)
        )
      ),
      ''
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers (security definer — avoid recursive policy checks)
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member(_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = _household_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_household_role(_household_id uuid, _roles public.household_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = _household_id
      and m.user_id = auth.uid()
      and m.role = any (_roles)
  );
$$;

create or replace function public.shares_household(_user_a uuid, _user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members a
    join public.household_members b on a.household_id = b.household_id
    where a.user_id = _user_a
      and b.user_id = _user_b
  );
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_household(
  p_name text,
  p_country text default null,
  p_currency text default null,
  p_timezone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'Household name is required';
  end if;

  insert into public.households (name, country, currency, timezone, created_by)
  values (trim(p_name), p_country, p_currency, p_timezone, v_uid)
  returning id into v_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_id, v_uid, 'owner');

  return v_id;
end;
$$;

create or replace function public.create_household_invite(
  p_household_id uuid,
  p_role public.household_role default 'member',
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
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_role = 'owner' then
    raise exception 'Cannot invite someone as owner';
  end if;

  if v_ttl < 1 or v_ttl > 720 then
    raise exception 'Invite lifetime must be between 1 and 720 hours';
  end if;

  if not public.has_household_role(p_household_id, array['owner', 'admin']::public.household_role[]) then
    raise exception 'Not allowed to invite members';
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

  invite_id := v_id;
  token := v_token;
  expires_at := v_exp;
  return next;
end;
$$;

create or replace function public.peek_household_invite(p_token text)
returns table (household_name text, role public.household_role, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if p_token is null or char_length(trim(p_token)) = 0 then
    return;
  end if;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  return query
  select h.name as household_name, i.role, i.expires_at
  from public.household_invites i
  join public.households h on h.id = i.household_id
  where i.token_hash = v_hash
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now();
end;
$$;

create or replace function public.accept_household_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_invite public.household_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_token is null or char_length(trim(p_token)) = 0 then
    raise exception 'Invite token is required';
  end if;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  select * into v_invite
  from public.household_invites
  where token_hash = v_hash
  for update;

  if not found then
    raise exception 'Invalid invite';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'Invite has been revoked';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'Invite has expired';
  end if;

  if exists (
    select 1
    from public.household_members m
    where m.household_id = v_invite.household_id
      and m.user_id = v_uid
  ) then
    if v_invite.accepted_at is null then
      update public.household_invites
      set accepted_at = now(), accepted_by = v_uid
      where id = v_invite.id;
    end if;
    return v_invite.household_id;
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'Invite has already been used';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_invite.household_id, v_uid, v_invite.role);

  update public.household_invites
  set accepted_at = now(), accepted_by = v_uid
  where id = v_invite.id;

  return v_invite.household_id;
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

  if not public.has_household_role(v_household_id, array['owner', 'admin']::public.household_role[]) then
    raise exception 'Not allowed to revoke invites';
  end if;

  update public.household_invites
  set revoked_at = now()
  where id = p_invite_id
    and accepted_at is null
    and revoked_at is null;
end;
$$;

create or replace function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.household_role;
  v_owner_count integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_role
  from public.household_members
  where household_id = p_household_id
    and user_id = v_uid;

  if v_role is null then
    raise exception 'Not a member of this household';
  end if;

  if v_role = 'owner' then
    select count(*) into v_owner_count
    from public.household_members
    where household_id = p_household_id
      and role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'Transfer ownership or delete the household before leaving as the last owner';
    end if;
  end if;

  delete from public.household_members
  where household_id = p_household_id
    and user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.has_household_role(uuid, public.household_role[]) from public;
revoke all on function public.shares_household(uuid, uuid) from public;
revoke all on function public.create_household(text, text, text, text) from public;
revoke all on function public.create_household_invite(uuid, public.household_role, text, integer) from public;
revoke all on function public.peek_household_invite(text) from public;
revoke all on function public.accept_household_invite(text) from public;
revoke all on function public.revoke_household_invite(uuid) from public;
revoke all on function public.leave_household(uuid) from public;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.has_household_role(uuid, public.household_role[]) to authenticated;
grant execute on function public.shares_household(uuid, uuid) to authenticated;
grant execute on function public.create_household(text, text, text, text) to authenticated;
grant execute on function public.create_household_invite(uuid, public.household_role, text, integer) to authenticated;
grant execute on function public.peek_household_invite(text) to authenticated;
grant execute on function public.accept_household_invite(text) to authenticated;
grant execute on function public.revoke_household_invite(uuid) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, update on table public.households to authenticated;
grant select, update, delete on table public.household_members to authenticated;
grant select, insert, update, delete on table public.household_people to authenticated;
grant select on table public.household_invites to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_people enable row level security;
alter table public.household_invites enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_household(auth.uid(), id));

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy households_select on public.households
  for select to authenticated
  using (public.is_household_member(id));

create policy households_update on public.households
  for update to authenticated
  using (public.has_household_role(id, array['owner', 'admin']::public.household_role[]))
  with check (public.has_household_role(id, array['owner', 'admin']::public.household_role[]));

create policy household_members_select on public.household_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_household_member(household_id));

create policy household_members_update on public.household_members
  for update to authenticated
  using (public.has_household_role(household_id, array['owner']::public.household_role[]))
  with check (public.has_household_role(household_id, array['owner']::public.household_role[]));

create policy household_members_delete on public.household_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
  );

create policy household_people_all on public.household_people
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy household_invites_select on public.household_invites
  for select to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));
