-- Exercises that share a superset_id are performed together.
alter table public.workout_exercises
  add column if not exists superset_id text;
