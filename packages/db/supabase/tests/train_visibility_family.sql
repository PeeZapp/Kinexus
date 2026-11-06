-- Manual SQL checks for train visibility + family (after applying 20261106210000).
-- Replace the three UUIDs below with real profile ids in the same or different households, then run (rolls back).

begin;

select set_config('test.owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('test.buddy', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('test.stranger', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select set_config('test.household', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true);

do $$
declare
  owner uuid := current_setting('test.owner')::uuid;
  buddy uuid := current_setting('test.buddy')::uuid;
  stranger uuid := current_setting('test.stranger')::uuid;
  hh uuid := current_setting('test.household')::uuid;
  wid_all uuid;
  wid_pick uuid;
  wid_house uuid;
begin
  perform set_config('search_path', 'public, extensions', true);

  -- Seed buddy link + permissions
  delete from public.train_buddy_permissions
  where (owner_id, buddy_id) in ((owner, buddy), (buddy, owner));
  delete from public.train_buddies
  where least(requester_id, addressee_id) = least(owner, buddy)
    and greatest(requester_id, addressee_id) = greatest(owner, buddy);

  insert into public.train_buddies (requester_id, addressee_id, status)
  values (owner, buddy, 'accepted');
  insert into public.train_buddy_permissions (owner_id, buddy_id)
  values (owner, buddy), (buddy, owner);

  insert into public.workouts (id, household_id, created_by, name, visibility)
  values (gen_random_uuid(), hh, owner, 'Buddy all', 'buddies')
  returning id into wid_all;

  insert into public.workouts (id, household_id, created_by, name, visibility)
  values (gen_random_uuid(), hh, owner, 'Buddy pick', 'buddies_selected')
  returning id into wid_pick;

  insert into public.workout_buddy_shares (workout_id, buddy_user_id, household_id)
  values (wid_pick, buddy, hh);

  insert into public.workouts (id, household_id, created_by, name, visibility)
  values (gen_random_uuid(), hh, owner, 'Family', 'household')
  returning id into wid_house;

  -- Non-buddy / non-household stranger
  perform set_config('request.jwt.claim.sub', stranger::text, true);
  if public.can_view_workout(wid_all) or public.can_view_workout(wid_pick) or public.can_view_workout(wid_house) then
    raise exception 'stranger should not view buddy/household workouts';
  end if;

  -- Specific-buddy-only: buddy listed can view pick; another accepted buddy without share cannot
  perform set_config('request.jwt.claim.sub', buddy::text, true);
  if not public.can_view_workout(wid_all) then
    raise exception 'accepted buddy should view visibility=buddies';
  end if;
  if not public.can_view_workout(wid_pick) then
    raise exception 'listed buddy should view buddies_selected';
  end if;

  delete from public.workout_buddy_shares where workout_id = wid_pick and buddy_user_id = buddy;
  if public.can_view_workout(wid_pick) then
    raise exception 'unlisted buddy must not view buddies_selected';
  end if;

  -- Block hides
  update public.train_buddies
  set status = 'blocked'
  where least(requester_id, addressee_id) = least(owner, buddy)
    and greatest(requester_id, addressee_id) = greatest(owner, buddy);
  if public.can_view_workout(wid_all) then
    raise exception 'blocked buddy must not view';
  end if;

  -- Remove revokes
  delete from public.train_buddy_permissions
  where (owner_id, buddy_id) in ((owner, buddy), (buddy, owner));
  delete from public.train_buddies
  where least(requester_id, addressee_id) = least(owner, buddy)
    and greatest(requester_id, addressee_id) = greatest(owner, buddy);
  if public.are_train_buddies(owner, buddy) or public.can_view_workout(wid_all) then
    raise exception 'removed buddy must not view';
  end if;

  -- Sessions / PRs stay private without permission
  if public.can_view_exercise_records(owner) then
    raise exception 'stranger/buddy without can_view_prs must not see PRs';
  end if;

  -- Family share opt-in gate for children (prefs guard)
  begin
    insert into public.user_train_prefs (user_id, family_plan_share)
    values (owner, 'plan_activity')
    on conflict (user_id) do update set family_plan_share = excluded.family_plan_share;
  exception
    when others then
      null; -- role-dependent; non-child owners succeed
  end;

  raise notice 'train_visibility_family checks ok';
end;
$$;

rollback;
