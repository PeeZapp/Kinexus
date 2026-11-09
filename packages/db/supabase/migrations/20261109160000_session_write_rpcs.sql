-- Live session writes via security definer RPCs.
-- Direct workout_sets / workout_sessions updates were denied by RLS for some members
-- (userId mismatch, household mismatch, select-after-write). Ownership is always auth.uid().

create or replace function public.assert_owns_workout_session(p_session_id uuid)
returns public.workout_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.workout_sessions;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_session
  from public.workout_sessions s
  where s.id = p_session_id;

  if v_session.id is null then
    raise exception 'Session not found';
  end if;

  if v_session.user_id is distinct from v_uid then
    raise exception 'Not allowed to modify this session';
  end if;

  return v_session;
end;
$$;

revoke all on function public.assert_owns_workout_session(uuid) from public;
revoke all on function public.assert_owns_workout_session(uuid) from anon;
revoke all on function public.assert_owns_workout_session(uuid) from authenticated;

-- Append one or more sets to a live session owned by auth.uid().
create or replace function public.append_workout_set(
  p_session_id uuid,
  p_sets jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.workout_sessions;
  v_set jsonb;
  v_position integer;
  v_set_index integer;
begin
  v_session := public.assert_owns_workout_session(p_session_id);

  if coalesce(jsonb_array_length(p_sets), 0) = 0 then
    return;
  end if;

  for v_set in select * from jsonb_array_elements(p_sets)
  loop
    v_position := greatest(0, coalesce((v_set ->> 'position')::integer, 0));
    v_set_index := greatest(0, coalesce((v_set ->> 'set_index')::integer, 0));
    insert into public.workout_sets (
      session_id,
      household_id,
      user_id,
      exercise_id,
      exercise_name,
      position,
      set_index,
      weight,
      reps,
      done
    ) values (
      v_session.id,
      v_session.household_id,
      v_session.user_id,
      nullif(v_set ->> 'exercise_id', '')::uuid,
      left(coalesce(nullif(trim(v_set ->> 'exercise_name'), ''), 'Exercise'), 160),
      v_position,
      v_set_index,
      left(coalesce(v_set ->> 'weight', ''), 40),
      left(coalesce(v_set ->> 'reps', ''), 40),
      coalesce((v_set ->> 'done')::boolean, false)
    )
    on conflict (session_id, position, set_index) do nothing;
  end loop;
end;
$$;

create or replace function public.update_workout_set(
  p_set_id uuid,
  p_weight text default null,
  p_reps text default null,
  p_done boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_set public.workout_sets;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_set from public.workout_sets where id = p_set_id;
  if v_set.id is null then
    raise exception 'Set not found';
  end if;
  if v_set.user_id is distinct from v_uid then
    raise exception 'Not allowed to update this set';
  end if;

  update public.workout_sets
  set
    weight = case when p_weight is null then weight else left(p_weight, 40) end,
    reps = case when p_reps is null then reps else left(p_reps, 40) end,
    done = case when p_done is null then done else p_done end
  where id = p_set_id;
end;
$$;

create or replace function public.delete_workout_set(p_set_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_set public.workout_sets;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_set from public.workout_sets where id = p_set_id;
  if v_set.id is null then
    return;
  end if;
  if v_set.user_id is distinct from v_uid then
    raise exception 'Not allowed to delete this set';
  end if;

  delete from public.workout_sets where id = p_set_id;
end;
$$;

create or replace function public.delete_workout_sets_at_position(
  p_session_id uuid,
  p_position integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_owns_workout_session(p_session_id);
  delete from public.workout_sets
  where session_id = p_session_id
    and position = p_position;
end;
$$;

create or replace function public.move_session_exercise(
  p_session_id uuid,
  p_position integer,
  p_direction integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_positions integer[];
  v_index integer;
  v_target integer;
  v_from integer;
  v_to integer;
  v_temp integer;
begin
  perform public.assert_owns_workout_session(p_session_id);

  if p_direction is distinct from -1 and p_direction is distinct from 1 then
    raise exception 'direction must be -1 or 1';
  end if;

  select coalesce(array_agg(distinct position order by position), '{}'::integer[])
    into v_positions
  from public.workout_sets
  where session_id = p_session_id;

  v_index := array_position(v_positions, p_position);
  if v_index is null then
    return;
  end if;

  v_target := v_index + p_direction;
  if v_target < 1 or v_target > coalesce(cardinality(v_positions), 0) then
    return;
  end if;

  v_from := v_positions[v_index];
  v_to := v_positions[v_target];
  v_temp := -1000000 - v_from;

  update public.workout_sets
  set position = v_temp
  where session_id = p_session_id and position = v_from;

  update public.workout_sets
  set position = v_from
  where session_id = p_session_id and position = v_to;

  update public.workout_sets
  set position = v_to
  where session_id = p_session_id and position = v_temp;
end;
$$;

create or replace function public.replace_session_exercise(
  p_session_id uuid,
  p_position integer,
  p_exercise_id uuid,
  p_name text,
  p_weight text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_owns_workout_session(p_session_id);

  update public.workout_sets
  set
    exercise_id = p_exercise_id,
    exercise_name = left(coalesce(nullif(trim(p_name), ''), 'Exercise'), 160),
    weight = left(coalesce(p_weight, ''), 40),
    done = false
  where session_id = p_session_id
    and position = p_position;
end;
$$;

create or replace function public.rewrite_session_sets(
  p_session_id uuid,
  p_sets jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_owns_workout_session(p_session_id);
  delete from public.workout_sets where session_id = p_session_id;
  perform public.append_workout_set(p_session_id, p_sets);
end;
$$;

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
begin
  perform public.assert_owns_workout_session(p_session_id);

  update public.workout_sessions
  set
    workout_id = p_workout_id,
    name = left(coalesce(nullif(trim(p_name), ''), 'Train'), 160)
  where id = p_session_id;
end;
$$;

-- Finish a session and mark matching plan days done (idempotent).
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
    where id = p_session_id;
  end if;

  if v_session.workout_id is null then
    return;
  end if;

  update public.training_plan_days d
  set
    status = 'done',
    session_id = p_session_id
  where d.workout_id = v_session.workout_id
    and d.status = 'planned';
end;
$$;

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

notify pgrst, 'reload schema';
