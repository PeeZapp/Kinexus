-- Planned weight and a short note for each exercise in a workout.
alter table public.workout_exercises
  add column if not exists target_weight text not null default '',
  add column if not exists note text not null default '';

alter table public.workout_exercises
  drop constraint if exists workout_exercises_note_len;

alter table public.workout_exercises
  add constraint workout_exercises_note_len check (char_length(note) <= 160);
