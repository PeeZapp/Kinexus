-- TRAIN RPC audit: ownership scoping + execute grants.
-- finish_workout_session must only mark the caller's own plan days.
-- link_workout_session must verify workout access before attaching.
-- Harden execute grants (revoke public/anon; authenticated only).

-- ---------------------------------------------------------------------------
-- link_workout_session: verify workout ownership / view before linking
-- ---------------------------------------------------------------------------

create or replace function public.link_workout_session(
  p_session_id uuid,
  p_workout_id uuid,
  p_name text default 'Train'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.workout_sessions;
  v_uid uuid := auth.uid();
begin
  v_session := public.assert_owns_workout_session(p_session_id);

  if p_workout_id is null then
    raise exception 'workout_id is required';
  end if;

  if not exists (select 1 from public.workouts w where w.id = p_workout_id) then
    raise exception 'Workout not found';
  end if;

  if not (
    exists (
      select 1
      from public.workouts w
      where w.id = p_workout_id
        and w.created_by is not distinct from v_uid
    )
    or public.can_view_workout(p_workout_id)
  ) then
    raise exception 'Not allowed to link this workout';
  end if;

  update public.workout_sessions
  set
    workout_id = p_workout_id,
    name = left(coalesce(nullif(trim(p_name), ''), 'Train'), 160)
  where id = p_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- finish_workout_session: only the caller's owned plan days; idempotent
-- ---------------------------------------------------------------------------

create or replace function public.finish_workout_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.workout_sessions;
begin
  v_session := public.assert_owns_workout_session(p_session_id);

  if v_session.finished_at is null then
    update public.workout_sessions
    set finished_at = now()
    where id = p_session_id
      and finished_at is null;
  end if;

  if v_session.workout_id is null then
    return;
  end if;

  -- Only mark plan days on plans owned by the session user (auth.uid()).
  update public.training_plan_days d
  set
    status = 'done',
    session_id = p_session_id
  from public.training_plans p
  where d.plan_id = p.id
    and p.owner_id = v_session.user_id
    and d.workout_id = v_session.workout_id
    and d.status = 'planned';
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute grants: authenticated only (share-token readers stay API/service-role)
-- ---------------------------------------------------------------------------

revoke all on function public.can_create_shared(uuid) from public;
revoke all on function public.can_create_shared(uuid) from anon;
grant execute on function public.can_create_shared(uuid) to authenticated;

revoke all on function public.can_edit_training_plan(uuid) from public;
revoke all on function public.can_edit_training_plan(uuid) from anon;
grant execute on function public.can_edit_training_plan(uuid) to authenticated;

revoke all on function public.create_training_plan(uuid, date, text, text, uuid[], jsonb) from public;
revoke all on function public.create_training_plan(uuid, date, text, text, uuid[], jsonb) from anon;
grant execute on function public.create_training_plan(uuid, date, text, text, uuid[], jsonb) to authenticated;

revoke all on function public.create_private_workout(uuid, text, integer) from public;
revoke all on function public.create_private_workout(uuid, text, integer) from anon;
grant execute on function public.create_private_workout(uuid, text, integer) to authenticated;

revoke all on function public.start_workout_session(uuid, text, uuid, text, integer, jsonb) from public;
revoke all on function public.start_workout_session(uuid, text, uuid, text, integer, jsonb) from anon;
grant execute on function public.start_workout_session(uuid, text, uuid, text, integer, jsonb) to authenticated;

revoke all on function public.append_workout_set(uuid, jsonb) from public;
revoke all on function public.append_workout_set(uuid, jsonb) from anon;
grant execute on function public.append_workout_set(uuid, jsonb) to authenticated;

revoke all on function public.update_workout_set(uuid, text, text, boolean) from public;
revoke all on function public.update_workout_set(uuid, text, text, boolean) from anon;
grant execute on function public.update_workout_set(uuid, text, text, boolean) to authenticated;

revoke all on function public.delete_workout_set(uuid) from public;
revoke all on function public.delete_workout_set(uuid) from anon;
grant execute on function public.delete_workout_set(uuid) to authenticated;

revoke all on function public.delete_workout_sets_at_position(uuid, integer) from public;
revoke all on function public.delete_workout_sets_at_position(uuid, integer) from anon;
grant execute on function public.delete_workout_sets_at_position(uuid, integer) to authenticated;

revoke all on function public.move_session_exercise(uuid, integer, integer) from public;
revoke all on function public.move_session_exercise(uuid, integer, integer) from anon;
grant execute on function public.move_session_exercise(uuid, integer, integer) to authenticated;

revoke all on function public.replace_session_exercise(uuid, integer, uuid, text, text) from public;
revoke all on function public.replace_session_exercise(uuid, integer, uuid, text, text) from anon;
grant execute on function public.replace_session_exercise(uuid, integer, uuid, text, text) to authenticated;

revoke all on function public.rewrite_session_sets(uuid, jsonb) from public;
revoke all on function public.rewrite_session_sets(uuid, jsonb) from anon;
grant execute on function public.rewrite_session_sets(uuid, jsonb) to authenticated;

revoke all on function public.link_workout_session(uuid, uuid, text) from public;
revoke all on function public.link_workout_session(uuid, uuid, text) from anon;
grant execute on function public.link_workout_session(uuid, uuid, text) to authenticated;

revoke all on function public.finish_workout_session(uuid) from public;
revoke all on function public.finish_workout_session(uuid) from anon;
grant execute on function public.finish_workout_session(uuid) to authenticated;

revoke all on function public.publish_global_exercise(uuid) from public;
revoke all on function public.publish_global_exercise(uuid) from anon;
grant execute on function public.publish_global_exercise(uuid) to authenticated;

revoke all on function public.archive_exercise(uuid) from public;
revoke all on function public.archive_exercise(uuid) from anon;
grant execute on function public.archive_exercise(uuid) to authenticated;

revoke all on function public.is_exercise_group_member(uuid) from public;
revoke all on function public.is_exercise_group_member(uuid) from anon;
grant execute on function public.is_exercise_group_member(uuid) to authenticated;

revoke all on function public.can_edit_exercise_group(uuid) from public;
revoke all on function public.can_edit_exercise_group(uuid) from anon;
grant execute on function public.can_edit_exercise_group(uuid) to authenticated;

revoke all on function public.exercise_referenced_by_me(uuid) from public;
revoke all on function public.exercise_referenced_by_me(uuid) from anon;
grant execute on function public.exercise_referenced_by_me(uuid) to authenticated;

notify pgrst, 'reload schema';
