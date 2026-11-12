-- Per-exercise target unit (reps / sec / min / km / m) plus distance tracking.
-- Additive on top of 20261111154500_workout_tracking_types.

alter table public.workout_exercises
  add column if not exists target_unit text null;

alter table public.workout_exercises
  drop constraint if exists workout_exercises_tracking_check,
  drop constraint if exists workout_exercises_target_unit_check,
  drop constraint if exists workout_exercises_target_distance_km_check;

alter table public.workout_exercises
  add constraint workout_exercises_tracking_check
    check (tracking in ('reps', 'time', 'intervals', 'distance')),
  add constraint workout_exercises_target_unit_check
    check (target_unit is null or target_unit in ('reps', 'sec', 'min', 'km', 'm')),
  add constraint workout_exercises_target_distance_km_check
    check (target_distance_km is null or target_distance_km >= 0);

alter table public.workout_exercises
  alter column target_distance_km type numeric(8, 3)
  using target_distance_km::numeric(8, 3);

alter table public.workout_sets
  drop constraint if exists workout_sets_distance_km_check;

alter table public.workout_sets
  alter column distance_km type numeric(8, 3)
  using distance_km::numeric(8, 3);

alter table public.workout_sets
  add constraint workout_sets_distance_km_check
    check (distance_km is null or distance_km >= 0);

-- Backfill target_unit from tracking for rows created before this column.
update public.workout_exercises
set target_unit = case tracking
  when 'reps' then 'reps'
  when 'intervals' then 'sec'
  when 'time' then 'min'
  else target_unit
end
where target_unit is null
  and tracking in ('reps', 'intervals', 'time');

-- Seed live sets from template tracking/duration/distance when client sends an empty payload.
-- Time, intervals, and distance all seed target_sets rows (time typically has sets = 1).
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
          done,
          duration_sec,
          distance_km
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
          false,
          case
            when nullif(v_set ->> 'duration_sec', '') is null then null
            else greatest(1, least(86400, (v_set ->> 'duration_sec')::integer))
          end,
          case
            when nullif(v_set ->> 'distance_km', '') is null then null
            else greatest(0, (v_set ->> 'distance_km')::numeric(8, 3))
          end
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
        done,
        duration_sec,
        distance_km
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
        false,
        case
          when coalesce(we.tracking, 'reps') in ('time', 'intervals') then we.target_duration_sec
          else null
        end,
        case
          when coalesce(we.tracking, 'reps') in ('time', 'distance') then we.target_distance_km
          else null
        end
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
