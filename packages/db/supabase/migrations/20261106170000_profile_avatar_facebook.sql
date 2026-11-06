-- Optional Facebook profile-photo avatars (server-managed).
-- Facebook CDN picture URLs expire, so we persist the verified Facebook user id only
-- and resolve a fresh picture server-side via the Graph API.
-- Apply after 20261106140000 + 20261106160000. Never edit those migrations.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'avatar_source'
  ) then
    raise exception 'Apply 20261106140000_profile_avatar_google.sql before Facebook avatar columns';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists avatar_facebook_id text;

alter table public.profiles
  drop constraint if exists profiles_avatar_source_check;

alter table public.profiles
  add constraint profiles_avatar_source_check
  check (avatar_source in ('preset', 'google', 'facebook'));

alter table public.profiles
  drop constraint if exists profiles_avatar_facebook_id_check;

alter table public.profiles
  add constraint profiles_avatar_facebook_id_check
  check (
    avatar_facebook_id is null
    or char_length(trim(avatar_facebook_id)) between 1 and 64
  );

-- Existing rows stay on presets / Google; never auto-enable Facebook.
update public.profiles
set avatar_facebook_id = null
where avatar_source is distinct from 'facebook';

-- ---------------------------------------------------------------------------
-- Guard: clients cannot forge Google/Facebook source/reference
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
      if new.avatar_source = 'facebook' and new.avatar_facebook_id is null then
        raise exception 'facebook avatar requires a facebook id'
          using errcode = 'check_violation';
      end if;
      if new.avatar_source = 'preset' then
        new.avatar_google_url := null;
        new.avatar_facebook_id := null;
      elsif new.avatar_source = 'google' then
        new.avatar_facebook_id := null;
      elsif new.avatar_source = 'facebook' then
        new.avatar_google_url := null;
      end if;
      return new;
    end if;

    -- Authenticated / anon inserts: force preset-only defaults.
    new.avatar_source := 'preset';
    new.avatar_google_url := null;
    new.avatar_facebook_id := null;
    return new;
  end if;

  -- UPDATE
  if new.avatar_source is not distinct from old.avatar_source
     and new.avatar_google_url is not distinct from old.avatar_google_url
     and new.avatar_facebook_id is not distinct from old.avatar_facebook_id
  then
    return new;
  end if;

  if role_name = 'service_role' then
    if new.avatar_source = 'google' and new.avatar_google_url is null then
      raise exception 'google avatar requires a photo url'
        using errcode = 'check_violation';
    end if;
    if new.avatar_source = 'facebook' and new.avatar_facebook_id is null then
      raise exception 'facebook avatar requires a facebook id'
        using errcode = 'check_violation';
    end if;
    if new.avatar_source = 'preset' then
      new.avatar_google_url := null;
      new.avatar_facebook_id := null;
    elsif new.avatar_source = 'google' then
      new.avatar_facebook_id := null;
    elsif new.avatar_source = 'facebook' then
      new.avatar_google_url := null;
    end if;
    return new;
  end if;

  raise exception 'avatar provider fields are server-managed'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists profiles_avatar_google_guard on public.profiles;
create trigger profiles_avatar_google_guard
  before insert or update of avatar_source, avatar_google_url, avatar_facebook_id on public.profiles
  for each row execute function public.profiles_avatar_google_guard();

-- Preset writes clear optional Google + Facebook choices.
create or replace function public.profiles_avatar_preset_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.avatar_url is not distinct from old.avatar_url
  then
    return new;
  end if;

  if public.is_profile_avatar_preset(new.avatar_url) then
    new.avatar_source := 'preset';
    new.avatar_google_url := null;
    new.avatar_facebook_id := null;
    return new;
  end if;

  raise exception 'avatar_url must be a known preset id (or null)'
    using errcode = 'check_violation';
end;
$$;

-- ---------------------------------------------------------------------------
-- Opt-in intents (service-role only)
-- ---------------------------------------------------------------------------

create table if not exists public.profile_avatar_facebook_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  facebook_id text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profile_avatar_facebook_intents_id_check
    check (char_length(trim(facebook_id)) between 1 and 64),
  constraint profile_avatar_facebook_intents_expiry_check
    check (expires_at > created_at)
);

create index if not exists profile_avatar_facebook_intents_user_created_idx
  on public.profile_avatar_facebook_intents (user_id, created_at desc);

create index if not exists profile_avatar_facebook_intents_pending_idx
  on public.profile_avatar_facebook_intents (id)
  where consumed_at is null;

alter table public.profile_avatar_facebook_intents enable row level security;

revoke all on table public.profile_avatar_facebook_intents from public, anon, authenticated;
grant select, insert, update, delete on table public.profile_avatar_facebook_intents to service_role;

-- ---------------------------------------------------------------------------
-- Acceptance checks (live policy + guard)
-- ---------------------------------------------------------------------------

do $$
declare
  probe_id uuid;
  saved_avatar text;
  saved_source text;
  saved_google text;
  saved_facebook text;
  forged boolean;
begin
  select id, avatar_url, avatar_source, avatar_google_url, avatar_facebook_id
  into probe_id, saved_avatar, saved_source, saved_google, saved_facebook
  from public.profiles
  limit 1;

  if probe_id is null then
    raise notice 'avatar facebook write checks skipped (no profiles)';
    return;
  end if;

  -- Preset writes still work and clear provider refs.
  update public.profiles
  set avatar_url = 'preset:today'
  where id = probe_id;

  if not exists (
    select 1
    from public.profiles
    where id = probe_id
      and avatar_url = 'preset:today'
      and avatar_source = 'preset'
      and avatar_google_url is null
      and avatar_facebook_id is null
  ) then
    raise exception 'preset avatar write failed after facebook columns';
  end if;

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
      set avatar_source = 'facebook',
          avatar_facebook_id = '1234567890'
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
      raise exception 'authenticated client forged facebook avatar fields';
    end if;
  exception
    when insufficient_privilege then
      raise notice 'avatar facebook live role probe skipped (role simulation unavailable): %', sqlerrm;
    when others then
      if position('set local role' in lower(sqlerrm)) > 0
         or position('permission denied to set role' in lower(sqlerrm)) > 0
      then
        raise notice 'avatar facebook live role probe skipped: %', sqlerrm;
      else
        raise;
      end if;
  end;

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
    set avatar_source = 'facebook',
        avatar_facebook_id = '1234567890',
        avatar_google_url = 'https://lh3.googleusercontent.com/a/should-clear'
    where id = probe_id;

    if not exists (
      select 1
      from public.profiles
      where id = probe_id
        and avatar_source = 'facebook'
        and avatar_facebook_id = '1234567890'
        and avatar_google_url is null
    ) then
      raise exception 'service_role facebook avatar write failed';
    end if;

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
        and avatar_facebook_id is null
    ) then
      raise exception 'google switch did not clear avatar_facebook_id';
    end if;

    update public.profiles
    set avatar_source = 'preset'
    where id = probe_id;

    if not exists (
      select 1
      from public.profiles
      where id = probe_id
        and avatar_source = 'preset'
        and avatar_google_url is null
        and avatar_facebook_id is null
    ) then
      raise exception 'preset switch did not clear provider avatar refs';
    end if;
  exception
    when insufficient_privilege then
      raise notice 'avatar facebook service_role probe skipped: %', sqlerrm;
    when others then
      if position('set local role' in lower(sqlerrm)) > 0
         or position('permission denied to set role' in lower(sqlerrm)) > 0
      then
        raise notice 'avatar facebook service_role probe skipped: %', sqlerrm;
      else
        raise;
      end if;
  end;

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
    end,
    avatar_facebook_id = case
      when coalesce(nullif(saved_source, ''), 'preset') = 'facebook' then saved_facebook
      else null
    end
  where id = probe_id;
end;
$$;
