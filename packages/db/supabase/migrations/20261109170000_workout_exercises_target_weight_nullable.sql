-- target_weight became numeric with empty strings coerced to null, but the
-- original NOT NULL from the text column was never dropped. Saving workouts
-- without a prescribed weight inserts null and fails that constraint.

alter table public.workout_exercises
  alter column target_weight drop not null;
