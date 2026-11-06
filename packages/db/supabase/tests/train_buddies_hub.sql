-- Manual SQL checks for Buddies hub (after applying 20261106220000_train_buddies_hub).
-- Replace the four UUIDs below with real profile / household ids, then run (rolls back).

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
  wid uuid;
  invite_id uuid;
  session_id uuid;
  event_completed uuid;
  event_pr uuid;
  event_shared uuid;
  invite_ids uuid[];
begin
  perform set_config('search_path', 'public, extensions', true);

  delete from public.train_buddy_event_high_fives
  where user_id in (owner, buddy, stranger);
  delete from public.train_buddy_events
  where actor_id in (owner, buddy, stranger);
  delete from public.train_together_invites
  where inviter_id in (owner, buddy) or invitee_id in (owner, buddy);
  delete from public.workout_buddy_shares
  where buddy_user_id in (owner, buddy);
  delete from public.train_buddy_permissions
  where (owner_id, buddy_id) in ((owner, buddy), (buddy, owner));
  delete from public.train_buddies
  where least(requester_id, addressee_id) = least(owner, buddy)
    and greatest(requester_id, addressee_id) = greatest(owner, buddy);

  insert into public.train_buddies (requester_id, addressee_id, status)
  values (owner, buddy, 'accepted');
  insert into public.train_buddy_permissions (owner_id, buddy_id, can_view_sessions, can_view_prs)
  values
    (owner, buddy, true, true),
    (buddy, owner, false, false);

  insert into public.workouts (id, household_id, created_by, name, visibility)
  values (gen_random_uuid(), hh, owner, 'Together day', 'private')
  returning id into wid;

  -- Train-together: both participants see pending invite; stranger does not
  perform set_config('request.jwt.claim.sub', owner::text, true);
  invite_ids := public.invite_train_together(wid, array[buddy], now() + interval '1 day');
  invite_id := invite_ids[1];

  if invite_id is null then
    raise exception 'invite_train_together should return an id';
  end if;

  if not public.can_view_train_together_invite(invite_id) then
    raise exception 'inviter should view train-together invite';
  end if;

  perform set_config('request.jwt.claim.sub', buddy::text, true);
  if not public.can_view_train_together_invite(invite_id) then
    raise exception 'invitee should view train-together invite';
  end if;
  if not public.can_view_workout(wid) then
    raise exception 'invitee should view workout via buddy share';
  end if;

  perform set_config('request.jwt.claim.sub', stranger::text, true);
  if public.can_view_train_together_invite(invite_id) or public.can_view_workout(wid) then
    raise exception 'stranger must not see train-together or workout';
  end if;

  perform set_config('request.jwt.claim.sub', buddy::text, true);
  perform public.respond_train_together(invite_id, true);
  if (select status from public.train_together_invites where id = invite_id) is distinct from 'accepted' then
    raise exception 'invitee accept should set accepted';
  end if;

  -- Feed: emit events; hub visibility follows buddy_can
  insert into public.workout_sessions (household_id, user_id, workout_id, name, finished_at)
  values (hh, owner, wid, 'Together day', now())
  returning id into session_id;

  select id into event_completed
  from public.train_buddy_events
  where actor_id = owner and event_type = 'completed_workout' and session_id = session_id
  order by created_at desc
  limit 1;

  insert into public.exercise_records (user_id, exercise_id, best_weight, best_reps, last_weight, last_reps)
  select owner, e.id, '100', '5', '100', '5'
  from public.exercises e
  limit 1
  on conflict (user_id, exercise_id) do update
    set best_weight = '101', best_reps = '5';

  select id into event_pr
  from public.train_buddy_events
  where actor_id = owner and event_type = 'new_pr'
  order by created_at desc
  limit 1;

  select id into event_shared
  from public.train_buddy_events
  where actor_id = owner and event_type = 'shared_workout' and workout_id = wid
  order by created_at desc
  limit 1;

  if event_completed is null or event_pr is null or event_shared is null then
    raise exception 'server-side feed events should be generated';
  end if;

  perform set_config('request.jwt.claim.sub', buddy::text, true);
  if not public.can_view_train_buddy_event(event_completed) then
    raise exception 'buddy with can_view_sessions should see completed event';
  end if;
  if not public.can_view_train_buddy_event(event_pr) then
    raise exception 'buddy with can_view_prs should see PR event';
  end if;
  if not public.can_view_train_buddy_event(event_shared) then
    raise exception 'buddy with default can_view_workouts should see shared event';
  end if;

  -- Hub: without sessions/prs flags, completed/PR hidden
  update public.train_buddy_permissions
  set can_view_sessions = false, can_view_prs = false
  where owner_id = owner and buddy_id = buddy;

  if public.can_view_train_buddy_event(event_completed)
     or public.can_view_train_buddy_event(event_pr) then
    raise exception 'hub must hide sessions/PRs without permission';
  end if;
  if not public.can_view_train_buddy_event(event_shared) then
    raise exception 'shared workout event should remain visible with can_view_workouts';
  end if;

  -- Block / remove: feed + train-together vanish
  update public.train_buddies
  set status = 'blocked'
  where least(requester_id, addressee_id) = least(owner, buddy)
    and greatest(requester_id, addressee_id) = greatest(owner, buddy);

  if public.can_view_train_buddy_event(event_shared)
     or public.can_view_train_together_invite(invite_id)
     or public.can_view_workout(wid) then
    raise exception 'blocked buddy must see nothing in feed/hub/train-together';
  end if;

  delete from public.train_buddy_permissions
  where (owner_id, buddy_id) in ((owner, buddy), (buddy, owner));
  delete from public.train_buddies
  where least(requester_id, addressee_id) = least(owner, buddy)
    and greatest(requester_id, addressee_id) = greatest(owner, buddy);

  if public.can_view_train_buddy_event(event_shared)
     or public.can_view_train_together_invite(invite_id) then
    raise exception 'removed buddy must see nothing';
  end if;

  raise notice 'train_buddies_hub checks ok';
end;
$$;

rollback;
