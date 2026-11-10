-- Manual SQL checks for creator public profiles (after applying 20261110100000_creator_public_profiles).
-- Replace the UUIDs below with real profile / household ids, then run (rolls back).
-- User A must already be an approved creator (for global workout publish).

begin;

select set_config('test.user_a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('test.user_b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('test.household', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);

do $$
declare
  a uuid := current_setting('test.user_a')::uuid;
  b uuid := current_setting('test.user_b')::uuid;
  hh uuid := current_setting('test.household')::uuid;
  a_handle text;
  private_workout uuid;
  global_workout uuid;
  household_list uuid;
  global_list uuid;
  visible int;
  hit int;
  meta_bio text;
begin
  perform set_config('search_path', 'public, extensions', true);

  select public.profile_display_handle(p.username::text, p.global_handle::text) into a_handle
  from public.profiles p
  where p.id = a;
  if a_handle is null or a_handle = '' then
    raise exception 'test user A needs a profile handle';
  end if;

  delete from public.profile_blocks
  where (blocker_id, blocked_id) in ((a, b), (b, a));
  delete from public.public_profiles_meta where user_id in (a, b);

  -- Owner can upsert meta; stranger cannot mutate A's row via RLS
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    execute 'set local role authenticated';
  exception when others then
    null;
  end;

  perform public.upsert_my_profile_meta('Hello from A', '[]'::jsonb);

  perform set_config('request.jwt.claim.sub', b::text, true);
  update public.public_profiles_meta
  set bio = 'hijacked'
  where user_id = a;

  select m.bio into meta_bio
  from public.public_profiles_meta m
  where m.user_id = a;
  -- B cannot select A's meta under RLS; read via security definer profile RPC as A
  perform set_config('request.jwt.claim.sub', a::text, true);
  select bio into meta_bio from public.get_public_profile(a_handle);
  if meta_bio is distinct from 'Hello from A' then
    raise exception 'second user edited someone else meta: %', meta_bio;
  end if;

  -- Hidden profile invisible to others, visible to owner
  update public.public_profiles_meta
  set is_hidden = true
  where user_id = a;

  perform set_config('request.jwt.claim.sub', b::text, true);
  select count(*) into visible from public.get_public_profile(a_handle);
  if visible <> 0 then
    raise exception 'hidden profile should be invisible to others';
  end if;

  perform set_config('request.jwt.claim.sub', a::text, true);
  select count(*) into visible from public.get_public_profile(a_handle);
  if visible <> 1 then
    raise exception 'owner should still see hidden profile';
  end if;

  update public.public_profiles_meta set is_hidden = false where user_id = a;

  -- Private / household items never returned; global items do
  if not public.is_approved_creator() then
    raise exception 'test.user_a must be an approved creator for this script';
  end if;

  insert into public.workouts (
    household_id, created_by, name, visibility, level, goal, equipment
  ) values (
    hh, a, 'Private only', 'private', 'beginner', 'strength', array['bodyweight']::text[]
  )
  returning id into private_workout;

  insert into public.workouts (
    household_id, created_by, name, visibility, level, goal, equipment
  ) values (
    hh, a, 'Everyone workout', 'global', 'beginner', 'strength', array['dumbbells']::text[]
  )
  returning id into global_workout;

  insert into public.watchlist_lists (household_id, created_by, name, visibility)
  values (hh, a, 'Family list', 'household')
  returning id into household_list;

  insert into public.watchlist_lists (household_id, created_by, name, visibility)
  values (hh, a, 'Public list', 'global')
  returning id into global_list;

  perform set_config('request.jwt.claim.sub', b::text, true);

  select count(*) into visible
  from public.get_profile_items(a_handle, 'workout', 50, null)
  where id = private_workout;
  if visible <> 0 then
    raise exception 'private workout leaked on profile items';
  end if;

  select count(*) into visible
  from public.get_profile_items(a_handle, 'workout', 50, null)
  where id = global_workout;
  if visible <> 1 then
    raise exception 'global workout missing from profile items';
  end if;

  select count(*) into visible
  from public.get_profile_items(a_handle, 'watchlist', 50, null)
  where id = household_list;
  if visible <> 0 then
    raise exception 'household watchlist leaked on profile items';
  end if;

  select count(*) into visible
  from public.get_profile_items(a_handle, 'watchlist', 50, null)
  where id = global_list;
  if visible <> 1 then
    raise exception 'global watchlist missing from profile items';
  end if;

  -- Blocked users excluded from search + profile
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.block_profile(b::text);

  perform set_config('request.jwt.claim.sub', b::text, true);
  select count(*) into visible from public.get_public_profile(a_handle);
  if visible <> 0 then
    raise exception 'blocked viewer should not see profile';
  end if;

  select count(*) into hit
  from public.search_creators(a_handle, 10)
  where permanent_id = a;
  if hit <> 0 then
    raise exception 'blocked target should be excluded from search';
  end if;

  raise notice 'creator_public_profiles checks ok';
end;
$$;

rollback;
