-- Personal notes on a workout or one of its exercises. Only the author can read them.

create table public.workout_user_notes (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  exercise_position integer not null default -1,
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (workout_id, user_id, exercise_position),
  constraint workout_user_notes_position check (exercise_position >= -1),
  constraint workout_user_notes_len check (char_length(body) <= 280)
);

create index workout_user_notes_household_idx on public.workout_user_notes (household_id);

create or replace function public.workout_user_note_guard()
returns trigger
language plpgsql
as $$
declare
  v_household uuid;
begin
  select household_id into v_household from public.workouts where id = new.workout_id;
  if v_household is null or v_household is distinct from new.household_id then
    raise exception 'Note must belong to the workout household';
  end if;
  if new.user_id is distinct from auth.uid() then
    raise exception 'You can only write your own workout note';
  end if;
  return new;
end;
$$;

create trigger workout_user_notes_guard
  before insert or update on public.workout_user_notes
  for each row execute function public.workout_user_note_guard();

grant select, insert, update, delete on table public.workout_user_notes to authenticated;

alter table public.workout_user_notes enable row level security;

create policy workout_user_notes_select on public.workout_user_notes
  for select to authenticated
  using (user_id = auth.uid() and public.can_view_workout(workout_id));

create policy workout_user_notes_insert on public.workout_user_notes
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_workout(workout_id));

create policy workout_user_notes_update on public.workout_user_notes
  for update to authenticated
  using (user_id = auth.uid() and public.can_view_workout(workout_id))
  with check (user_id = auth.uid() and public.can_view_workout(workout_id));

create policy workout_user_notes_delete on public.workout_user_notes
  for delete to authenticated
  using (user_id = auth.uid() and public.can_view_workout(workout_id));
