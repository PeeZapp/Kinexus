-- Forward repair: re-assert preset-era profile-avatars write lockdown.
-- Needed if 20261106120000_profile_avatars_storage.sql was applied after
-- 20261106130000_profile_avatar_presets.sql (recreating owner insert/update/delete).
-- Idempotent when order was already correct (DROP POLICY IF EXISTS + assert).
-- Does not change profiles data, RLS on profiles, or public read on the bucket.

-- ---------------------------------------------------------------------------
-- Storage: no authenticated/anon client writes to profile-avatars
-- ---------------------------------------------------------------------------

drop policy if exists profile_avatars_owner_insert on storage.objects;
drop policy if exists profile_avatars_owner_update on storage.objects;
drop policy if exists profile_avatars_owner_delete on storage.objects;

-- ---------------------------------------------------------------------------
-- Acceptance: preset trigger still present; no write policies remain
-- ---------------------------------------------------------------------------

do $$
declare
  write_pols int;
  has_fn boolean;
  has_tg boolean;
begin
  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'profiles_avatar_preset_only'
  ) into has_fn;

  select exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profiles'
      and t.tgname = 'profiles_avatar_preset_only'
      and not t.tgisinternal
  ) into has_tg;

  if not has_fn or not has_tg then
    raise exception
      'preset avatar enforcement missing (fn=%, tg=%); apply 20261106130000_profile_avatar_presets.sql first',
      has_fn, has_tg;
  end if;

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
    raise exception 'profile-avatars still has % write policies after lockdown repair', write_pols;
  end if;
end;
$$;
