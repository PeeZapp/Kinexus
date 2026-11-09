-- When starting a template workout, seed live sets from workout_exercises if
-- the client sent an empty p_sets payload (or resumed an empty session).

create or replace function public.start_workout_session(
  p_household_id uuid,
  p_name text default 'Train',
  p_workout_id uuid default null,
  p_remix_spec text default null,
  p_duration_min integer default null,
  p_sets jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_household_id uuid := p_household_id;
  v_name text := left(coalesce(nullif(trim(p_name), ''), 'Train'), 160);
  v_session_id uuid;
  v_set jsonb;
  v_position integer;
  v_set_index integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_workout_id is not null then
    select w.household_id, coalesce(nullif(trim(w.name), ''), v_name)
      into v_household_id, v_name
    from public.workouts w
    where w.id = p_workout_id;

    if v_household_id is null then
      raise exception 'Workout not found';
    end if;

    if not (
      exists (
        select 1 from public.workouts w
        where w.id = p_workout_id
          and w.created_by is not distinct from v_uid
      )
      or public.can_view_workout(p_workout_id)
    ) then
      raise exception 'Not allowed to start this workout';
    end if;
  elsif v_household_id is null then
    raise exception 'household_id is required';
  end if;

  if not public.is_household_member(v_household_id) then
    raise exception 'Not a member of this household';
  end if;

  -- Resume an unfinished session for this workout when present.
  if p_workout_id is not null then
    select s.id
      into v_session_id
    from public.workout_sessions s
    where s.user_id = v_uid
      and s.workout_id = p_workout_id
      and s.finished_at is null
    order by s.started_at desc
    limit 1;
  end if;

  if v_session_id is null then
    insert into public.workout_sessions (
      household_id,
      user_id,
      workout_id,
      name,
      remix_spec,
      duration_min
    ) values (
      v_household_id,
      v_uid,
      p_workout_id,
      v_name,
      nullif(trim(coalesce(p_remix_spec, '')), ''),
      p_duration_min
    )
    returning id into v_session_id;
  else
    update public.workout_sessions
    set name = v_name
    where id = v_session_id;
  end if;

  -- Seed sets only when the live session is still empty.
  if not exists (
    select 1 from public.workout_sets ws where ws.session_id = v_session_id
  ) then
    if coalesce(jsonb_array_length(p_sets), 0) > 0 then
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
          v_session_id,
          v_household_id,
          v_uid,
          nullif(v_set ->> 'exercise_id', '')::uuid,
          left(coalesce(nullif(trim(v_set ->> 'exercise_name'), ''), 'Exercise'), 160),
          v_position,
          v_set_index,
          left(coalesce(v_set ->> 'weight', ''), 40),
          left(coalesce(v_set ->> 'reps', ''), 40),
          false
        )
        on conflict (session_id, position, set_index) do nothing;
      end loop;
    elsif p_workout_id is not null then
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
      )
      select
        v_session_id,
        v_household_id,
        v_uid,
        we.exercise_id,
        left(coalesce(nullif(trim(we.name), ''), 'Exercise'), 160),
        we.position,
        gs.set_index,
        left(coalesce(we.target_weight::text, ''), 40),
        left(coalesce(we.target_reps, ''), 40),
        false
      from public.workout_exercises we
      cross join lateral generate_series(
        0,
        greatest(coalesce(we.target_sets, 1), 1) - 1
      ) as gs(set_index)
      where we.workout_id = p_workout_id
      on conflict (session_id, position, set_index) do nothing;
    end if;
  end if;

  return v_session_id;
end;
$$;

revoke all on function public.start_workout_session(uuid, text, uuid, text, integer, jsonb) from public;
revoke all on function public.start_workout_session(uuid, text, uuid, text, integer, jsonb) from anon;
grant execute on function public.start_workout_session(uuid, text, uuid, text, integer, jsonb) to authenticated;

notify pgrst, 'reload schema';
