-- Optional Google profile-photo avatars (server-managed).
-- profiles.avatar_url remains the selected preset (fallback).
-- avatar_source / avatar_google_url are writable only by service_role (API).
-- Short-lived single-use intents are service-role only (no authenticated policies).

-- ---------------------------------------------------------------------------
-- Profile columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists avatar_source text not null default 'preset';

alter table public.profiles
  add column if not exists avatar_google_url text;

alter table public.profiles
  drop constraint if exists profiles_avatar_source_check;

alter table public.profiles
  add constraint profiles_avatar_source_check
  check (avatar_source in ('preset', 'google'));

alter table public.profiles
  drop constraint if exists profiles_avatar_google_url_check;

alter table public.profiles
  add constraint profiles_avatar_google_url_check
  check (
    avatar_google_url is null
    or (
      char_length(avatar_google_url) between 12 and 2048
      and avatar_google_url like 'https://%'
    )
  );

-- Existing rows stay on presets; never auto-enable Google.
update public.profiles
set avatar_source = 'preset'
where avatar_source is distinct from 'preset'
  and avatar_google_url is null;

-- ---------------------------------------------------------------------------
-- Guard: clients cannot forge Google source/reference
-- ---------------------------------------------------------------------------

create or replace function public.profiles_avatar_google_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  role_name text;
begin
  role_name := coalesce(auth.role(), '');

  if tg_op = 'INSERT' then
    if role_name = 'service_role' then
      if new.avatar_source = 'google' and new.avatar_google_url is null then
        raise exception 'google avatar requires a photo url'
          using errcode = 'check_violation';
      end if;
      if new.avatar_source = 'preset' then
        new.avatar_google_url := null;
      end if;
      return new;
    end if;

    -- Authenticated / anon inserts: force preset-only defaults.
    new.avatar_source := 'preset';
    new.avatar_google_url := null;
    return new;
  end if;

  -- UPDATE
  if new.avatar_source is not distinct from old.avatar_source
     and new.avatar_google_url is not distinct from old.avatar_google_url
  then
    return new;
  end if;

  if role_name = 'service_role' then
    if new.avatar_source = 'google' and new.avatar_google_url is null then
      raise exception 'google avatar requires a photo url'
        using errcode = 'check_violation';
    end if;
    if new.avatar_source = 'preset' then
      new.avatar_google_url := null;
    end if;
    return new;
  end if;

  raise exception 'avatar google fields are server-managed'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists profiles_avatar_google_guard on public.profiles;
create trigger profiles_avatar_google_guard
  before insert or update of avatar_source, avatar_google_url on public.profiles
  for each row execute function public.profiles_avatar_google_guard();

-- Preset-only writes on avatar_url stay in force (existing trigger).

-- ---------------------------------------------------------------------------
-- Opt-in intents (service-role only)
-- ---------------------------------------------------------------------------

create table if not exists public.profile_avatar_google_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  google_sub text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profile_avatar_google_intents_sub_check
    check (char_length(trim(google_sub)) between 1 and 255),
  constraint profile_avatar_google_intents_expiry_check
    check (expires_at > created_at)
);

create index if not exists profile_avatar_google_intents_user_created_idx
  on public.profile_avatar_google_intents (user_id, created_at desc);

create index if not exists profile_avatar_google_intents_pending_idx
  on public.profile_avatar_google_intents (id)
  where consumed_at is null;

alter table public.profile_avatar_google_intents enable row level security;

-- No authenticated/anon policies: API service role only.

revoke all on table public.profile_avatar_google_intents from public, anon, authenticated;
grant select, insert, update, delete on table public.profile_avatar_google_intents to service_role;

-- ---------------------------------------------------------------------------
-- Acceptance checks (live policy + guard)
-- ---------------------------------------------------------------------------

do $$
declare
  probe_id uuid;
  saved_avatar text;
  saved_source text;
  saved_google text;
  forged boolean;
begin
  select id, avatar_url, avatar_source, avatar_google_url
  into probe_id, saved_avatar, saved_source, saved_google
  from public.profiles
  limit 1;

  if probe_id is null then
    raise notice 'avatar google write checks skipped (no profiles)';
    return;
  end if;

  -- Preset writes still work.
  update public.profiles
  set avatar_url = 'preset:today'
  where id = probe_id;

  if not exists (
    select 1 from public.profiles where id = probe_id and avatar_url = 'preset:today'
  ) then
    raise exception 'preset avatar write failed after google columns';
  end if;

  -- Authenticated role cannot forge Google source/reference.
  perform set_config('request.jwt.claim.sub', probe_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', probe_id::text, 'role', 'authenticated')::text,
    true
  );

  begin
    execute 'set local role authenticated';

    forged := false;
    begin
      update public.profiles
      set avatar_source = 'google',
          avatar_google_url = 'https://lh3.googleusercontent.com/a/forged'
      where id = probe_id;
      forged := true;
    exception
      when check_violation then
        forged := false;
      when others then
        if sqlerrm ilike '%server-managed%'
           or sqlerrm ilike '%avatar%'
           or sqlerrm ilike '%policy%'
           or sqlerrm ilike '%permission%'
        then
          forged := false;
        else
          raise;
        end if;
    end;

    if forged then
      raise exception 'authenticated client forged google avatar fields';
    end if;

    forged := false;
    begin
      update public.profiles
      set avatar_google_url = 'https://evil.example/x.png'
      where id = probe_id;
      forged := true;
    exception
      when check_violation then
        forged := false;
      when others then
        if sqlerrm ilike '%server-managed%'
           or sqlerrm ilike '%avatar%'
           or sqlerrm ilike '%policy%'
           or sqlerrm ilike '%permission%'
        then
          forged := false;
        else
          raise;
        end if;
    end;

    if forged then
      raise exception 'authenticated client forged avatar_google_url';
    end if;
  exception
    when insufficient_privilege then
      raise notice 'avatar google live role probe skipped (role simulation unavailable): %', sqlerrm;
    when others then
      if position('set local role' in lower(sqlerrm)) > 0
         or position('permission denied to set role' in lower(sqlerrm)) > 0
      then
        raise notice 'avatar google live role probe skipped: %', sqlerrm;
      else
        raise;
      end if;
  end;

  -- Reset JWT claim simulation before service_role probe.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );

  begin
    execute 'set local role service_role';

    update public.profiles
    set avatar_source = 'google',
        avatar_google_url = 'https://lh3.googleusercontent.com/a/ok'
    where id = probe_id;

    if not exists (
      select 1
      from public.profiles
      where id = probe_id
        and avatar_source = 'google'
        and avatar_google_url = 'https://lh3.googleusercontent.com/a/ok'
    ) then
      raise exception 'service_role google avatar write failed';
    end if;

    -- Switching back to preset clears the google url.
    update public.profiles
    set avatar_source = 'preset'
    where id = probe_id;

    if not exists (
      select 1
      from public.profiles
      where id = probe_id
        and avatar_source = 'preset'
        and avatar_google_url is null
    ) then
      raise exception 'preset switch did not clear avatar_google_url';
    end if;
  exception
    when insufficient_privilege then
      raise notice 'avatar google service_role probe skipped: %', sqlerrm;
    when others then
      if position('set local role' in lower(sqlerrm)) > 0
         or position('permission denied to set role' in lower(sqlerrm)) > 0
      then
        raise notice 'avatar google service_role probe skipped: %', sqlerrm;
      else
        raise;
      end if;
  end;

  -- Restore probed row (superuser path with service_role claim still set).
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );

  update public.profiles
  set
    avatar_url = case
      when public.is_profile_avatar_preset(saved_avatar) then saved_avatar
      else 'preset:today'
    end,
    avatar_source = coalesce(nullif(saved_source, ''), 'preset'),
    avatar_google_url = case
      when coalesce(nullif(saved_source, ''), 'preset') = 'google' then saved_google
      else null
    end
  where id = probe_id;
end;
$$;
