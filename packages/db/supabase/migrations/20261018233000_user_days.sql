-- Personal day record for Today: tasks, journal, and the written workout.
-- One row per signed-in user per calendar day. The household does not share it.

create table public.user_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  tasks jsonb not null default '[]'::jsonb,
  journal text not null default '',
  workout_title text not null default '',
  workout_notes text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, day),
  constraint user_days_tasks_shape check (
    jsonb_typeof(tasks) = 'array'
    and jsonb_array_length(tasks) <= 30
  ),
  constraint user_days_journal_len check (char_length(journal) <= 8000),
  constraint user_days_workout_title_len check (char_length(workout_title) <= 80),
  constraint user_days_workout_notes_len check (char_length(workout_notes) <= 1200)
);

create trigger user_days_set_updated_at
  before update on public.user_days
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.user_days to authenticated;

alter table public.user_days enable row level security;

create policy user_days_select on public.user_days
  for select to authenticated
  using (user_id = auth.uid());

create policy user_days_insert on public.user_days
  for insert to authenticated
  with check (user_id = auth.uid());

create policy user_days_update on public.user_days
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_days_delete on public.user_days
  for delete to authenticated
  using (user_id = auth.uid());
