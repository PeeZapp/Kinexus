-- TRAIN RPC audit: second-user / non-creator rejection (after 20261109190000).
-- Replace UUIDs with real profile / household ids, then run (rolls back).
-- Owner must be an approved creator to cover publish_global_exercise.

begin;

select set_config('test.owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('test.other', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('test.household', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);
select set_config('test.stranger_hh', 'ffffffff-ffff-ffff-ffff-ffffffffffff', true);

do $$
declare
  owner uuid := current_setting('test.owner')::uuid;
  other uuid := current_setting('test.other')::uuid;
  hh uuid := current_setting('test.household')::uuid;
  stranger_hh uuid := current_setting('test.stranger_hh')::uuid;
  plan_a uuid;
  plan_b uuid;
  workout_a uuid;
  workout_private uuid;
  session_a uuid;
  session_b uuid;
  set_a uuid;
  day_a uuid;
  day_b uuid;
  group_id uuid;
  ex_id uuid;
  blocked boolean;
  day_status text;
  day_session uuid;
begin
  perform set_config('search_path', 'public, extensions', true);

  if not exists (select 1 from public.profiles where id = owner) then
    raise exception 'test.owner profile missing';
  end if;
  if not exists (select 1 from public.profiles where id = other) then
    raise exception 'test.other profile missing';
  end if;

  -- Shared household (cross-mark risk) + a foreign household for non-member checks.
  insert into public.household_members (household_id, user_id, role)
  values (hh, owner, 'adult')
  on conflict do nothing;
  insert into public.household_members (household_id, user_id, role)
  values (hh, other, 'adult')
  on conflict do nothing;
  delete from public.household_members
  where household_id = stranger_hh and user_id in (owner, other);

  -- ---------------------------------------------------------------------------
  -- can_create_shared / create_training_plan / create_private_workout
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', other::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    execute 'set local role authenticated';
  exception when others then
    null;
  end;

  if public.can_create_shared(stranger_hh) then
    raise exception 'non-member must not can_create_shared';
  end if;

  blocked := false;
  begin
    perform public.create_training_plan(stranger_hh, current_date, 'Nope', 'private');
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'non-member create_training_plan must be rejected';
  end if;

  blocked := false;
  begin
    perform public.create_private_workout(stranger_hh, 'Nope');
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'non-member create_private_workout must be rejected';
  end if;

  -- Owner creates plan + workout + session seed
  perform set_config('request.jwt.claim.sub', owner::text, true);
  plan_a := public.create_training_plan(hh, current_date, 'Owner plan', 'private');
  workout_a := public.create_private_workout(hh, 'Owner workout');
  workout_private := public.create_private_workout(hh, 'Owner private B');
  session_a := public.start_workout_session(hh, 'Owner session', workout_a, null, null, '[]'::jsonb);

  insert into public.training_plan_days (plan_id, day, position, workout_id, status)
  values (plan_a, 'monday', 0, workout_a, 'planned')
  returning id into day_a;

  perform public.append_workout_set(
    session_a,
    jsonb_build_array(
      jsonb_build_object(
        'exercise_id', null,
        'exercise_name', 'Squat',
        'position', 0,
        'set_index', 0,
        'weight', '100',
        'reps', '5',
        'done', false
      )
    )
  );
  select id into set_a from public.workout_sets where session_id = session_a limit 1;

  -- Other user: own plan day on the same workout_id (same household) + own session.
  perform set_config('request.jwt.claim.sub', other::text, true);
  plan_b := public.create_training_plan(hh, current_date, 'Other plan', 'private');
  insert into public.training_plan_days (plan_id, day, position, workout_id, status)
  values (plan_b, 'monday', 0, workout_a, 'planned')
  returning id into day_b;
  session_b := public.start_workout_session(hh, 'Other session', null, null, null, '[]'::jsonb);

  -- ---------------------------------------------------------------------------
  -- Session write RPCs: second user rejected
  -- ---------------------------------------------------------------------------
  blocked := false;
  begin
    perform public.append_workout_set(
      session_a,
      jsonb_build_array(
        jsonb_build_object(
          'exercise_name', 'Hack',
          'position', 1,
          'set_index', 0
        )
      )
    );
  exception when others then
    if sqlerrm ilike '%not allowed%' or sqlerrm ilike '%Not allowed%' then
      blocked := true;
    else
      raise;
    end if;
  end;
  if not blocked then
    raise exception 'append_workout_set must reject second user';
  end if;

  blocked := false;
  begin
    perform public.update_workout_set(set_a, '999', '1', true);
  exception when others then
    if sqlerrm ilike '%not allowed%' or sqlerrm ilike '%Not allowed%' then
      blocked := true;
    else
      raise;
    end if;
  end;
  if not blocked then
    raise exception 'update_workout_set must reject second user';
  end if;

  blocked := false;
  begin
    perform public.delete_workout_set(set_a);
  exception when others then
    if sqlerrm ilike '%not allowed%' or sqlerrm ilike '%Not allowed%' then
      blocked := true;
    else
      raise;
    end if;
  end;
  if not blocked then
    raise exception 'delete_workout_set must reject second user';
  end if;

  blocked := false;
  begin
    perform public.delete_workout_sets_at_position(session_a, 0);
  exception when others then
    if sqlerrm ilike '%not allowed%' or sqlerrm ilike '%Not allowed%' then
      blocked := true;
    else
      raise;
    end if;
  end;
  if not blocked then
    raise exception 'delete_workout_sets_at_position must reject second user';
  end if;

  blocked := false;
  begin
    perform public.move_session_exercise(session_a, 0, 1);
  exception when others then
    if sqlerrm ilike '%not allowed%' or sqlerrm ilike '%Not allowed%' then
      blocked := true;
    else
      raise;
    end if;
  end;
  if not blocked then
    raise exception 'move_session_exercise must reject second user';
  end if;

  blocked := false;
  begin
    perform public.replace_session_exercise(session_a, 0, null, 'Hack', '1');
  exception when others then
    if sqlerrm ilike '%not allowed%' or sqlerrm ilike '%Not allowed%' then
      blocked := true;
    else
      raise;
    end if;
  end;
  if not blocked then
    raise exception 'replace_session_exercise must reject second user';
  end if;

  blocked := false;
  begin
    perform public.rewrite_session_sets(session_a, '[]'::jsonb);
  exception when others then
    if sqlerrm ilike '%not allowed%' or sqlerrm ilike '%Not allowed%' then
      blocked := true;
    else
      raise;
    end if;
  end;
  if not blocked then
    raise exception 'rewrite_session_sets must reject second user';
  end if;

  blocked := false;
  begin
    perform public.link_workout_session(session_a, workout_private, 'Stolen');
  exception when others then
    if sqlerrm ilike '%not allowed%' or sqlerrm ilike '%Not allowed%' then
      blocked := true;
    else
      raise;
    end if;
  end;
  if not blocked then
    raise exception 'link_workout_session must reject second user on foreign session';
  end if;

  -- Other cannot link owner's private workout onto their own session
  blocked := false;
  begin
    perform public.link_workout_session(session_b, workout_private, 'Peek');
  exception when others then
    if sqlerrm ilike '%not allowed%' or sqlerrm ilike '%Not allowed%' or sqlerrm ilike '%not found%' then
      blocked := true;
    else
      raise;
    end if;
  end;
  if not blocked then
    raise exception 'link_workout_session must reject linking a private foreign workout';
  end if;

  -- Other cannot finish owner's session
  blocked := false;
  begin
    perform public.finish_workout_session(session_a);
  exception when others then
    if sqlerrm ilike '%not allowed%' or sqlerrm ilike '%Not allowed%' then
      blocked := true;
    else
      raise;
    end if;
  end;
  if not blocked then
    raise exception 'finish_workout_session must reject second user';
  end if;

  -- Non-member cannot start in stranger household
  blocked := false;
  begin
    perform public.start_workout_session(stranger_hh, 'Hack start', null, null, null, '[]'::jsonb);
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'start_workout_session must reject non-member household';
  end if;

  -- ---------------------------------------------------------------------------
  -- finish_workout_session: marks only caller's plan day; idempotent
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', owner::text, true);
  perform public.finish_workout_session(session_a);
  perform public.finish_workout_session(session_a); -- idempotent

  select status, session_id into day_status, day_session
  from public.training_plan_days where id = day_a;
  if day_status is distinct from 'done' or day_session is distinct from session_a then
    raise exception 'owner plan day should be marked done';
  end if;

  select status into day_status from public.training_plan_days where id = day_b;
  if day_status is distinct from 'planned' then
    raise exception 'other user plan day must stay planned';
  end if;

  -- ---------------------------------------------------------------------------
  -- exercise_records upsert: RLS blocks writing another user's row
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', other::text, true);
  insert into public.exercises (name, source, license, scope, owner_id, body_part)
  values ('Audit curl', 'user', 'user', 'private', other, 'biceps')
  returning id into ex_id;

  blocked := false;
  begin
    insert into public.exercise_records (
      user_id, exercise_id, last_weight, last_reps, best_weight, best_reps
    ) values (
      owner, ex_id, '10', '8', '10', '8'
    );
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'exercise_records insert for another user_id must be rejected';
  end if;

  -- ---------------------------------------------------------------------------
  -- publish_global_exercise: non-creator / non-owner rejected
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', owner::text, true);
  insert into public.exercises (name, source, license, scope, owner_id, body_part)
  values ('Owner press', 'user', 'user', 'private', owner, 'chest')
  returning id into ex_id;

  perform set_config('request.jwt.claim.sub', other::text, true);
  blocked := false;
  begin
    perform public.publish_global_exercise(ex_id);
  exception when others then
    if sqlerrm ilike '%creator%' or sqlerrm ilike '%owner%' or sqlerrm ilike '%Not allowed%' then
      blocked := true;
    else
      raise;
    end if;
  end;
  if not blocked then
    raise exception 'non-creator publish_global_exercise must be rejected';
  end if;

  blocked := false;
  begin
    update public.exercises
    set scope = 'global', source = 'creator'
    where id = ex_id;
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'direct scope=global update must be rejected for non-creator';
  end if;

  blocked := false;
  begin
    perform public.archive_exercise(ex_id);
  exception when others then
    if sqlerrm ilike '%not allowed%' or sqlerrm ilike '%Not allowed%' then
      blocked := true;
    else
      raise;
    end if;
  end;
  if not blocked then
    raise exception 'archive_exercise must reject non-owner';
  end if;

  -- ---------------------------------------------------------------------------
  -- exercise-group helpers: non-member / non-owner
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', owner::text, true);
  insert into public.exercise_groups (owner_id, name)
  values (owner, 'Audit crew')
  returning id into group_id;

  perform set_config('request.jwt.claim.sub', other::text, true);
  if public.is_exercise_group_member(group_id) then
    raise exception 'non-member must not be exercise group member';
  end if;
  if public.can_edit_exercise_group(group_id) then
    raise exception 'non-owner must not can_edit_exercise_group';
  end if;

  -- Former member: remove other from shared household
  delete from public.household_members
  where household_id = hh and user_id = other;
  if public.can_create_shared(hh) then
    raise exception 'former member must not can_create_shared';
  end if;
  blocked := false;
  begin
    perform public.create_training_plan(hh, current_date, 'Ghost', 'private');
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'former member create_training_plan must be rejected';
  end if;

  raise notice 'train_rpc_audit checks ok';
end;
$$;

rollback;
