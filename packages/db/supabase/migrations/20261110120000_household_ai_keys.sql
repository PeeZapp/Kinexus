-- Household bring-your-own AI key (17a): Vault storage + member access gates.
-- Keys are stored encrypted; not used for AI calls until 17b.

create extension if not exists supabase_vault with schema vault;

create type public.ai_key_status as enum ('valid', 'invalid', 'unchecked');
create type public.ai_key_audit_action as enum ('set', 'replace', 'remove', 'access_change');
create type public.ai_provider as enum ('anthropic', 'deepseek', 'openai', 'gemini', 'perplexity');

create table public.household_ai_keys (
  household_id uuid primary key references public.households (id) on delete cascade,
  provider public.ai_provider not null,
  vault_secret_id uuid not null,
  last4 text not null check (char_length(last4) >= 1 and char_length(last4) <= 4),
  key_status public.ai_key_status not null default 'unchecked',
  last_checked_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_ai_key_access (
  household_id uuid not null references public.household_ai_keys (household_id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  allowed boolean not null default false,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_ai_key_access_user_id_idx
  on public.household_ai_key_access (user_id);

create table public.ai_key_audit (
  id bigint generated always as identity primary key,
  actor uuid references public.profiles (id) on delete set null,
  household_id uuid not null,
  provider public.ai_provider,
  action public.ai_key_audit_action not null,
  target_user uuid references public.profiles (id) on delete set null,
  at timestamptz not null default now()
);

create index ai_key_audit_household_id_idx on public.ai_key_audit (household_id, at desc);

alter table public.household_ai_keys enable row level security;
alter table public.household_ai_key_access enable row level security;
alter table public.ai_key_audit enable row level security;
-- No client policies: deny all for authenticated/anon. Service role bypasses RLS.

create or replace function public.household_ai_key_default_allowed(
  p_household_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.household_role;
  v_person_type public.person_type;
  v_birthday date;
  v_age integer;
begin
  select m.role into v_role
  from public.household_members m
  where m.household_id = p_household_id
    and m.user_id = p_user_id;

  if v_role is null then
    return false;
  end if;

  if v_role in ('owner', 'admin') then
    return true;
  end if;

  select p.person_type, p.birthday
    into v_person_type, v_birthday
  from public.household_people p
  where p.household_id = p_household_id
    and p.user_id = p_user_id
  order by p.created_at asc
  limit 1;

  if v_person_type = 'child' then
    return false;
  end if;

  if v_person_type = 'adult' then
    return true;
  end if;

  if v_birthday is not null then
    v_age := date_part('year', age(current_date, v_birthday))::integer;
    if v_age < 18 then
      return false;
    end if;
    return true;
  end if;

  -- No linked person_type/birthday: non-admins default off.
  return false;
end;
$$;

revoke all on function public.household_ai_key_default_allowed(uuid, uuid) from public;

create or replace function public.seed_household_ai_key_access(
  p_household_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_ai_key_access (household_id, user_id, allowed, updated_by, updated_at)
  select
    p_household_id,
    m.user_id,
    public.household_ai_key_default_allowed(p_household_id, m.user_id),
    p_actor,
    now()
  from public.household_members m
  where m.household_id = p_household_id
  on conflict (household_id, user_id) do nothing;
end;
$$;

revoke all on function public.seed_household_ai_key_access(uuid, uuid) from public;

create or replace function public.internal_delete_household_ai_key(
  p_household_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- BEFORE DELETE trigger removes the Vault secret.
  delete from public.household_ai_keys where household_id = p_household_id;
end;
$$;

revoke all on function public.internal_delete_household_ai_key(uuid) from public;
grant execute on function public.internal_delete_household_ai_key(uuid) to service_role;

create or replace function public.internal_store_household_ai_key(
  p_household_id uuid,
  p_provider public.ai_provider,
  p_secret text,
  p_last4 text,
  p_key_status public.ai_key_status,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_existing uuid;
  v_new uuid;
  v_action public.ai_key_audit_action;
begin
  if p_secret is null or length(trim(p_secret)) = 0 then
    raise exception 'API key is required';
  end if;

  select vault_secret_id into v_existing
  from public.household_ai_keys
  where household_id = p_household_id;

  if v_existing is null then
    v_action := 'set';
    v_new := vault.create_secret(
      trim(p_secret),
      'household_ai_key:' || p_household_id::text,
      'Household BYOK AI key'
    );
    insert into public.household_ai_keys (
      household_id, provider, vault_secret_id, last4, key_status, last_checked_at, created_by, created_at, updated_at
    ) values (
      p_household_id, p_provider, v_new, p_last4, p_key_status, now(), p_actor, now(), now()
    );
    perform public.seed_household_ai_key_access(p_household_id, p_actor);
  else
    v_action := 'replace';
    perform vault.update_secret(v_existing, trim(p_secret));
    update public.household_ai_keys
    set provider = p_provider,
        last4 = p_last4,
        key_status = p_key_status,
        last_checked_at = now(),
        updated_at = now()
    where household_id = p_household_id;
    perform public.seed_household_ai_key_access(p_household_id, p_actor);
  end if;

  insert into public.ai_key_audit (actor, household_id, provider, action, target_user, at)
  values (p_actor, p_household_id, p_provider, v_action, null, now());
end;
$$;

revoke all on function public.internal_store_household_ai_key(uuid, public.ai_provider, text, text, public.ai_key_status, uuid) from public;
grant execute on function public.internal_store_household_ai_key(uuid, public.ai_provider, text, text, public.ai_key_status, uuid) to service_role;

create or replace function public.can_use_household_ai_key(
  p_user_id uuid,
  p_household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_ai_keys k
    join public.household_ai_key_access a
      on a.household_id = k.household_id
     and a.user_id = p_user_id
    where k.household_id = p_household_id
      and k.key_status = 'valid'
      and a.allowed = true
  );
$$;

revoke all on function public.can_use_household_ai_key(uuid, uuid) from public;
grant execute on function public.can_use_household_ai_key(uuid, uuid) to service_role;

create or replace function public.my_household_ai_key(p_household_id uuid)
returns table (
  provider public.ai_provider,
  last4 text,
  key_status public.ai_key_status,
  last_checked_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  allowed boolean,
  has_key boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.household_members m
    where m.household_id = p_household_id and m.user_id = v_uid
  ) then
    raise exception 'Not a member of this household';
  end if;

  return query
  select
    k.provider,
    k.last4,
    k.key_status,
    k.last_checked_at,
    k.created_at,
    k.updated_at,
    coalesce(a.allowed, false) as allowed,
    true as has_key
  from public.household_ai_keys k
  left join public.household_ai_key_access a
    on a.household_id = k.household_id
   and a.user_id = v_uid
  where k.household_id = p_household_id;

  if not found then
    return query
    select
      null::public.ai_provider,
      null::text,
      null::public.ai_key_status,
      null::timestamptz,
      null::timestamptz,
      null::timestamptz,
      false,
      false;
  end if;
end;
$$;

revoke all on function public.my_household_ai_key(uuid) from public;
revoke all on function public.my_household_ai_key(uuid) from anon;
grant execute on function public.my_household_ai_key(uuid) to authenticated;

create or replace function public.household_ai_key_access_list(p_household_id uuid)
returns table (
  user_id uuid,
  display_name text,
  handle text,
  allowed boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_household_role(p_household_id, array['owner', 'admin']::public.household_role[]) then
    raise exception 'Only an owner or admin can manage AI key access';
  end if;

  if not exists (select 1 from public.household_ai_keys k where k.household_id = p_household_id) then
    return;
  end if;

  return query
  select
    m.user_id,
    coalesce(p.display_name, 'Member')::text,
    public.profile_display_handle(p.username::text, p.global_handle::text),
    coalesce(a.allowed, public.household_ai_key_default_allowed(p_household_id, m.user_id))
  from public.household_members m
  join public.profiles p on p.id = m.user_id
  left join public.household_ai_key_access a
    on a.household_id = m.household_id
   and a.user_id = m.user_id
  where m.household_id = p_household_id
  order by coalesce(p.display_name, ''), m.user_id;
end;
$$;

revoke all on function public.household_ai_key_access_list(uuid) from public;
revoke all on function public.household_ai_key_access_list(uuid) from anon;
grant execute on function public.household_ai_key_access_list(uuid) to authenticated;

create or replace function public.set_household_ai_key_access(
  p_household_id uuid,
  p_user_id uuid,
  p_allowed boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_provider public.ai_provider;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_household_role(p_household_id, array['owner', 'admin']::public.household_role[]) then
    raise exception 'Only an owner or admin can manage AI key access';
  end if;

  select provider into v_provider
  from public.household_ai_keys
  where household_id = p_household_id;

  if v_provider is null then
    raise exception 'No AI key is set for this household';
  end if;

  if not exists (
    select 1 from public.household_members m
    where m.household_id = p_household_id and m.user_id = p_user_id
  ) then
    raise exception 'That person is not in this household';
  end if;

  insert into public.household_ai_key_access (household_id, user_id, allowed, updated_by, updated_at)
  values (p_household_id, p_user_id, p_allowed, v_uid, now())
  on conflict (household_id, user_id) do update
  set allowed = excluded.allowed,
      updated_by = excluded.updated_by,
      updated_at = now();

  insert into public.ai_key_audit (actor, household_id, provider, action, target_user, at)
  values (v_uid, p_household_id, v_provider, 'access_change', p_user_id, now());
end;
$$;

revoke all on function public.set_household_ai_key_access(uuid, uuid, boolean) from public;
revoke all on function public.set_household_ai_key_access(uuid, uuid, boolean) from anon;
grant execute on function public.set_household_ai_key_access(uuid, uuid, boolean) to authenticated;

-- Drop vault secret when the key row is removed (household delete cascade, last-admin cleanup).
create or replace function public.household_ai_keys_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  delete from vault.secrets where id = old.vault_secret_id;
  return old;
end;
$$;

drop trigger if exists household_ai_keys_before_delete on public.household_ai_keys;
create trigger household_ai_keys_before_delete
  before delete on public.household_ai_keys
  for each row
  execute function public.household_ai_keys_before_delete();

-- Members joining get a default access row when a key exists.
create or replace function public.household_members_ai_key_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.household_ai_keys k where k.household_id = new.household_id) then
    insert into public.household_ai_key_access (household_id, user_id, allowed, updated_by, updated_at)
    values (
      new.household_id,
      new.user_id,
      public.household_ai_key_default_allowed(new.household_id, new.user_id),
      new.user_id,
      now()
    )
    on conflict (household_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists household_members_ai_key_after_insert on public.household_members;
create trigger household_members_ai_key_after_insert
  after insert on public.household_members
  for each row
  execute function public.household_members_ai_key_after_insert();

-- Leaving / removed members lose access; last owner/admin leaving removes the key.
create or replace function public.household_members_ai_key_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admins integer;
begin
  delete from public.household_ai_key_access
  where household_id = old.household_id
    and user_id = old.user_id;

  select count(*) into v_admins
  from public.household_members m
  where m.household_id = old.household_id
    and m.role in ('owner', 'admin');

  if v_admins = 0 then
    delete from public.household_ai_keys where household_id = old.household_id;
  end if;

  return old;
end;
$$;

drop trigger if exists household_members_ai_key_after_delete on public.household_members;
create trigger household_members_ai_key_after_delete
  after delete on public.household_members
  for each row
  execute function public.household_members_ai_key_after_delete();

-- Ensure delete_household still cascades (FK already on household_ai_keys).
-- Audit remove when key deleted via API helper:
create or replace function public.internal_remove_household_ai_key(
  p_household_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider public.ai_provider;
begin
  select provider into v_provider
  from public.household_ai_keys
  where household_id = p_household_id;

  if v_provider is null then
    return;
  end if;

  delete from public.household_ai_keys where household_id = p_household_id;

  insert into public.ai_key_audit (actor, household_id, provider, action, target_user, at)
  values (p_actor, p_household_id, v_provider, 'remove', null, now());
end;
$$;

revoke all on function public.internal_remove_household_ai_key(uuid, uuid) from public;
grant execute on function public.internal_remove_household_ai_key(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
