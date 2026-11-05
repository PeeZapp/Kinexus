-- Effort / RPE targets on workout exercises, numeric-only target_weight,
-- and per-user weight + measurement unit prefs on profiles.

alter table public.workout_exercises
  add column if not exists target_effort text,
  add column if not exists target_rpe numeric;

-- Move effort labels that were stored in target_weight.
update public.workout_exercises
set
  target_effort = lower(trim(target_weight)),
  target_weight = ''
where target_effort is null
  and lower(trim(target_weight)) in ('light', 'moderate', 'heavy', 'max');

-- Drop any remaining non-numeric target_weight values.
update public.workout_exercises
set target_weight = ''
where trim(target_weight) !~ '^\d+(\.\d+)?$';

alter table public.workout_exercises
  alter column target_weight drop default;

alter table public.workout_exercises
  alter column target_weight type numeric
  using nullif(trim(target_weight), '')::numeric;

alter table public.workout_exercises
  drop constraint if exists workout_exercises_target_effort_known;

alter table public.workout_exercises
  add constraint workout_exercises_target_effort_known
  check (target_effort is null or target_effort in ('light', 'moderate', 'heavy', 'max'));

alter table public.workout_exercises
  drop constraint if exists workout_exercises_target_rpe_steps;

alter table public.workout_exercises
  add constraint workout_exercises_target_rpe_steps
  check (
    target_rpe is null
    or (
      target_rpe >= 1
      and target_rpe <= 10
      and (target_rpe * 2) = floor(target_rpe * 2)
    )
  );

alter table public.profiles
  add column if not exists weight_unit text,
  add column if not exists measurement_system text;

alter table public.profiles
  drop constraint if exists profiles_weight_unit_known;

alter table public.profiles
  add constraint profiles_weight_unit_known
  check (weight_unit is null or weight_unit in ('kg', 'lb'));

alter table public.profiles
  drop constraint if exists profiles_measurement_system_known;

alter table public.profiles
  add constraint profiles_measurement_system_known
  check (measurement_system is null or measurement_system in ('metric', 'imperial'));
