-- Allow workout_exercises.household_id to be null for official system workouts.
-- Fixes seed failure: workout_exercise_guard raised when workouts.household_id is null.

alter table public.workout_exercises
  alter column household_id drop not null;

create or replace function public.workout_exercise_guard()
returns trigger
language plpgsql
as $$
declare
  v_household uuid;
  v_is_system boolean;
begin
  select household_id, is_system
    into v_household, v_is_system
  from public.workouts
  where id = new.workout_id;

  if coalesce(v_is_system, false) then
    if new.household_id is not null then
      raise exception 'Exercise must belong to the workout household';
    end if;
    return new;
  end if;

  if v_household is null or v_household is distinct from new.household_id then
    raise exception 'Exercise must belong to the workout household';
  end if;
  return new;
end;
$$;
