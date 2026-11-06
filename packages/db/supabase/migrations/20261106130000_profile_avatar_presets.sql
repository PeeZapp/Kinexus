-- Preset-only profile avatars.
-- Reuses profiles.avatar_url to store allowlisted preset IDs (e.g. preset:today).
-- Legacy URL/data-URL values are preserved in place but cannot be newly written.
-- Disables authenticated write access to the obsolete profile-avatars storage bucket.
-- Objects and public read remain for now (not deleted).

-- ---------------------------------------------------------------------------
-- Allowlist helper
-- ---------------------------------------------------------------------------

create or replace function public.is_profile_avatar_preset(p_value text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_value is null
    or p_value in (
      'preset:today',
      'preset:calendar',
      'preset:meals',
      'preset:lists',
      'preset:finances',
      'preset:nutrition',
      'preset:train',
      'preset:settings'
    );
$$;

revoke all on function public.is_profile_avatar_preset(text) from public;
grant execute on function public.is_profile_avatar_preset(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Enforce preset-only writes (preserve unchanged legacy values)
-- ---------------------------------------------------------------------------

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
    return new;
  end if;

  raise exception 'avatar_url must be a known preset id (or null)'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists profiles_avatar_preset_only on public.profiles;
create trigger profiles_avatar_preset_only
  before insert or update of avatar_url on public.profiles
  for each row execute function public.profiles_avatar_preset_only();

-- New accounts: no OAuth/picture URL written into avatar_url.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, email, global_handle)
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
    null,
    new.email,
    public.generate_unique_permanent_handle()
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lock down profile-avatars client writes (keep objects + public read)
-- ---------------------------------------------------------------------------

drop policy if exists profile_avatars_owner_insert on storage.objects;
drop policy if exists profile_avatars_owner_update on storage.objects;
drop policy if exists profile_avatars_owner_delete on storage.objects;

-- ---------------------------------------------------------------------------
-- Acceptance checks
-- ---------------------------------------------------------------------------

do $$
declare
  write_pols int;
  probe_id uuid;
  saved_avatar text;
  saved_display text;
begin
  -- No authenticated/anon write policies remain that target profile-avatars.
  -- Safe if 20261106120000 was never applied (DROP POLICY IF EXISTS above is a no-op).
  select count(*)::int into write_pols
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and (
      coalesce(qual, '') ilike '%profile-avatars%'
      or coalesce(with_check, '') ilike '%profile-avatars%'
    );
  if write_pols <> 0 then
    raise exception 'profile-avatars still has % write policies', write_pols;
  end if;

  if exists (
    select 1 from storage.buckets where id = 'profile-avatars'
  ) and not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'profile_avatars_public_read'
  ) then
    raise notice 'profile-avatars public read policy missing (objects may be private)';
  end if;

  select id, avatar_url, display_name
  into probe_id, saved_avatar, saved_display
  from public.profiles
  order by created_at asc, id asc
  limit 1;

  if probe_id is null then
    raise notice 'avatar preset write checks skipped (no profiles)';
    return;
  end if;

  -- Preset writes allowed.
  update public.profiles
  set avatar_url = 'preset:today'
  where id = probe_id;

  if not exists (
    select 1 from public.profiles where id = probe_id and avatar_url = 'preset:today'
  ) then
    raise exception 'preset avatar write failed';
  end if;

  begin
    update public.profiles
    set avatar_url = 'https://evil.example/x.png'
    where id = probe_id;
    raise exception 'arbitrary avatar URL was accepted';
  exception
    when check_violation then
      null;
    when others then
      if sqlerrm ilike '%preset%' or sqlerrm ilike '%avatar_url%' then
        null;
      else
        raise;
      end if;
  end;

  begin
    update public.profiles
    set avatar_url = 'data:image/png;base64,aaa'
    where id = probe_id;
    raise exception 'data URL avatar was accepted';
  exception
    when check_violation then
      null;
    when others then
      if sqlerrm ilike '%preset%' or sqlerrm ilike '%avatar_url%' then
        null;
      else
        raise;
      end if;
  end;

  -- Unchanged avatar_url must survive an unrelated column update
  -- (same path that preserves legacy URL/data-URL values without rewriting them).
  update public.profiles
  set display_name = coalesce(saved_display, display_name, 'Avatar Probe')
  where id = probe_id;

  if not exists (
    select 1 from public.profiles where id = probe_id and avatar_url = 'preset:today'
  ) then
    raise exception 'unchanged avatar_url was not preserved across unrelated update';
  end if;

  -- Restore the probed row to a legal value (preset or null only — no superuser bypass).
  update public.profiles
  set avatar_url = case
        when public.is_profile_avatar_preset(saved_avatar) then saved_avatar
        else null
      end,
      display_name = saved_display
  where id = probe_id;
end;
$$;
