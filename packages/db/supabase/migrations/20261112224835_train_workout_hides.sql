-- Per-user workout hides: default visible; hidden rows stay out of Workouts UI and plan generate.

create table public.train_workout_hides (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workout_id, user_id)
);

create index train_workout_hides_user_idx
  on public.train_workout_hides (user_id, created_at desc);

create index train_workout_hides_workout_idx
  on public.train_workout_hides (workout_id);

grant select, insert, delete on table public.train_workout_hides to authenticated;

alter table public.train_workout_hides enable row level security;

create policy train_workout_hides_select on public.train_workout_hides
  for select to authenticated
  using (user_id = auth.uid());

create policy train_workout_hides_insert on public.train_workout_hides
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.can_view_workout(workout_id)
  );

create policy train_workout_hides_delete on public.train_workout_hides
  for delete to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
