-- Manual SQL checks for custom exercises (after applying 20261107020000_custom_exercises).
-- Replace UUIDs with real profile / household ids, then run (rolls back).
-- Creator owner must already be approved (creators.status = 'approved').

begin;

select set_config('test.owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('test.member', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('test.buddy', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select set_config('test.stranger', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true);
select set_config('test.household', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);

do $$
declare
  owner uuid := current_setting('test.owner')::uuid;
  member uuid := current_setting('test.member')::uuid;
  buddy uuid := current_setting('test.buddy')::uuid;
  stranger uuid := current_setting('test.stranger')::uuid;
  hh uuid := current_setting('test.household')::uuid;
  private_id uuid;
  household_id uuid;
  group_id uuid;
  group_ex uuid;
  archived_id uuid;
  published_id uuid;
  result text;
  visible boolean;
  blocked boolean;
begin
  perform set_config('search_path', 'public, extensions', true);

  -- Private invisible to others
  perform set_config('request.jwt.claim.sub', owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    execute 'set local role authenticated';
  exception when others then
    null;
  end;

  insert into public.exercises (
    name, source, license, scope, owner_id, body_part, equipment, target_muscle
  ) values (
    'Private curl', 'user', 'user', 'private', owner, 'biceps', 'dumbbell', 'biceps'
  )
  returning id into private_id;

  perform set_config('request.jwt.claim.sub', stranger::text, true);
  select exists(select 1 from public.exercises where id = private_id) into visible;
  if visible then
    raise exception 'private exercise must be invisible to strangers';
  end if;

  -- Household visible to members only
  perform set_config('request.jwt.claim.sub', owner::text, true);
  insert into public.exercises (
    name, source, license, scope, owner_id, household_id, body_part, equipment
  ) values (
    'Family press', 'user', 'user', 'household', owner, hh, 'chest', 'barbell'
  )
  returning id into household_id;

  perform set_config('request.jwt.claim.sub', member::text, true);
  select exists(select 1 from public.exercises where id = household_id) into visible;
  if not visible then
    raise exception 'household member should see household exercise';
  end if;

  perform set_config('request.jwt.claim.sub', stranger::text, true);
  select exists(select 1 from public.exercises where id = household_id) into visible;
  if visible then
    raise exception 'non-member must not see household exercise';
  end if;

  -- Group visible to accepted-buddy members only
  perform set_config('request.jwt.claim.sub', owner::text, true);
  insert into public.exercise_groups (owner_id, name)
  values (owner, 'Gym crew')
  returning id into group_id;

  begin
    insert into public.exercise_group_members (group_id, user_id)
    values (group_id, stranger);
    raise exception 'non-buddy member insert should fail';
  exception
    when others then
      if sqlerrm not ilike '%train buddies%' then
        raise;
      end if;
  end;

  if not public.are_train_buddies(owner, buddy) then
    insert into public.train_buddies (requester_id, addressee_id, status)
    values (owner, buddy, 'accepted');
  end if;
  insert into public.exercise_group_members (group_id, user_id)
  values (group_id, buddy);

  insert into public.exercises (
    name, source, license, scope, owner_id, group_id, body_part, equipment, category
  ) values (
    'Crew row', 'user', 'user', 'group', owner, group_id, 'back', 'cable', 'Back'
  )
  returning id into group_ex;

  perform set_config('request.jwt.claim.sub', buddy::text, true);
  select exists(select 1 from public.exercises where id = group_ex) into visible;
  if not visible then
    raise exception 'accepted buddy group member should see group exercise';
  end if;

  perform set_config('request.jwt.claim.sub', stranger::text, true);
  select exists(select 1 from public.exercises where id = group_ex) into visible;
  if visible then
    raise exception 'non-member must not see group exercise';
  end if;

  -- Non-creator cannot insert global or call publish
  perform set_config('request.jwt.claim.sub', stranger::text, true);
  blocked := false;
  begin
    insert into public.exercises (
      name, source, license, scope, owner_id
    ) values (
      'Nope global', 'user', 'user', 'global', stranger
    );
    raise exception 'direct global insert should fail';
  exception
    when others then
      if sqlerrm ilike '%publish_global_exercise%'
         or sqlerrm ilike '%global%'
         or sqlerrm ilike '%policy%'
      then
        blocked := true;
      else
        raise;
      end if;
  end;
  if not blocked then
    raise exception 'expected non-creator global insert to be rejected';
  end if;

  blocked := false;
  begin
    perform public.publish_global_exercise(private_id);
    raise exception 'stranger publish should fail';
  exception
    when others then
      if sqlerrm ilike '%creator%' or sqlerrm ilike '%owner%' or sqlerrm ilike '%Not authenticated%' then
        blocked := true;
      else
        raise;
      end if;
  end;
  if not blocked then
    raise exception 'expected non-creator publish to be rejected';
  end if;

  -- Creator can publish
  perform set_config('request.jwt.claim.sub', owner::text, true);
  if not public.is_approved_creator() then
    raise exception 'test.owner must be an approved creator for this script';
  end if;

  insert into public.exercises (
    name, source, license, scope, owner_id, body_part, equipment, category, is_compound
  ) values (
    'Creator thruster', 'user', 'user', 'private', owner, 'other', 'barbell', 'Full Body', true
  )
  returning id into published_id;

  perform public.publish_global_exercise(published_id);
  if not exists (
    select 1
    from public.exercises
    where id = published_id
      and scope = 'global'
      and source = 'creator'
      and canonical_key like 'creator_%'
  ) then
    raise exception 'publish_global_exercise should promote to global creator row';
  end if;

  perform set_config('request.jwt.claim.sub', stranger::text, true);
  select exists(select 1 from public.exercises where id = published_id) into visible;
  if not visible then
    raise exception 'published global exercise should be readable by all';
  end if;

  -- Archive keeps history readable
  perform set_config('request.jwt.claim.sub', owner::text, true);
  insert into public.exercises (
    name, source, license, scope, owner_id, body_part
  ) values (
    'Archive me', 'user', 'user', 'private', owner, 'core'
  )
  returning id into archived_id;

  insert into public.exercise_records (user_id, exercise_id, last_weight, last_reps, best_weight, best_reps)
  values (owner, archived_id, '20', '10', '20', '10');

  result := public.archive_exercise(archived_id);
  if result is distinct from 'hidden' then
    raise exception 'referenced archive should hide, got %', result;
  end if;

  perform set_config('request.jwt.claim.sub', owner::text, true);
  select exists(
    select 1 from public.exercises where id = archived_id and status = 'hidden'
  ) into visible;
  if not visible then
    raise exception 'owner with history must still read archived exercise';
  end if;

  perform set_config('request.jwt.claim.sub', stranger::text, true);
  select exists(select 1 from public.exercises where id = archived_id) into visible;
  if visible then
    raise exception 'stranger must not see archived private exercise';
  end if;

  raise notice 'custom_exercises checks ok';
end;
$$;

rollback;
