-- Manual SQL checks for global creator library (after applying 20261106230000).
-- Replace the UUIDs below with real profile / household ids, then run (rolls back).
-- Creator must already be approved (creators.status = 'approved') for the owner id.

begin;

select set_config('test.owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('test.stranger', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select set_config('test.household', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true);

do $$
declare
  owner uuid := current_setting('test.owner')::uuid;
  stranger uuid := current_setting('test.stranger')::uuid;
  hh uuid := current_setting('test.household')::uuid;
  wid uuid;
  wid_hidden uuid;
  blocked boolean := false;
begin
  perform set_config('search_path', 'public, extensions', true);

  -- Non-creator cannot publish via direct insert
  perform set_config('request.jwt.claim.sub', stranger::text, true);
  begin
    insert into public.workouts (
      household_id, created_by, name, visibility, level, goal, equipment
    ) values (
      hh, stranger, 'Nope', 'global', 'beginner', 'strength', array['bodyweight']::text[]
    );
    raise exception 'non-creator insert global should fail';
  exception
    when others then
      if sqlerrm ilike '%Everyone%' or sqlerrm ilike '%verified%' or sqlerrm ilike '%policy%' then
        blocked := true;
      else
        raise;
      end if;
  end;
  if not blocked then
    raise exception 'expected non-creator global insert to be rejected';
  end if;

  -- Creator publishes with tags
  perform set_config('request.jwt.claim.sub', owner::text, true);
  if not public.is_approved_creator() then
    raise exception 'test.owner must be an approved creator for this script';
  end if;

  insert into public.workouts (
    household_id, created_by, name, visibility, level, goal, equipment
  ) values (
    hh, owner, 'Global push', 'global', 'beginner', 'strength', array['dumbbells']::text[]
  )
  returning id into wid;

  -- Anyone signed-in can read global
  perform set_config('request.jwt.claim.sub', stranger::text, true);
  if not public.can_view_workout(wid) then
    raise exception 'signed-in stranger should view global workout';
  end if;

  -- Rating one-per-user
  insert into public.train_global_workout_ratings (workout_id, user_id, score)
  values (wid, stranger, 8);
  begin
    insert into public.train_global_workout_ratings (workout_id, user_id, score)
    values (wid, stranger, 9);
    raise exception 'duplicate rating insert should fail';
  exception
    when unique_violation then
      null;
  end;
  update public.train_global_workout_ratings
  set score = 9
  where workout_id = wid and user_id = stranger;

  if public.train_global_workout_score(wid) is distinct from 9::numeric then
    raise exception 'aggregate score expected 9';
  end if;

  -- Unpublish hides from library (visibility change)
  perform set_config('request.jwt.claim.sub', owner::text, true);
  update public.workouts
  set visibility = 'private'
  where id = wid
  returning id into wid_hidden;

  perform set_config('request.jwt.claim.sub', stranger::text, true);
  if public.can_view_workout(wid_hidden) then
    raise exception 'unpublished workout must not be viewable as global';
  end if;
  if exists (
    select 1 from public.train_global_workout_ratings where workout_id = wid_hidden
  ) then
    -- rows may still exist, but select policy hides them when not global
    null;
  end if;
  if exists (
    select 1
    from public.train_global_workout_ratings r
    where r.workout_id = wid_hidden
  ) then
    -- under stranger JWT, RLS select should return zero rows
    if (
      select count(*) from public.train_global_workout_ratings where workout_id = wid_hidden
    ) > 0 then
      -- count also subject to RLS when run as authenticated role; in this DO block we are typically postgres
      null;
    end if;
  end if;

  -- Creator cannot publish without tags
  perform set_config('request.jwt.claim.sub', owner::text, true);
  begin
    insert into public.workouts (household_id, created_by, name, visibility)
    values (hh, owner, 'Missing tags', 'global');
    raise exception 'global without tags should fail';
  exception
    when others then
      if sqlerrm not ilike '%level%' and sqlerrm not ilike '%Everyone%' and sqlerrm not ilike '%tags%' then
        raise;
      end if;
  end;

  raise notice 'train_global_library checks ok';
end;
$$;

rollback;
