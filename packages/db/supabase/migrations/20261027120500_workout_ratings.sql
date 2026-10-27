-- One optional score per user per workout. 1 to 10.

create table public.workout_ratings (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  score smallint not null check (score between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (workout_id, user_id)
);

create index workout_ratings_household_idx on public.workout_ratings (household_id);

create or replace function public.workout_rating_guard()
returns trigger
language plpgsql
as $$
declare
  v_household uuid;
begin
  select household_id into v_household from public.workouts where id = new.workout_id;
  if v_household is null or v_household is distinct from new.household_id then
    raise exception 'Rating must belong to the workout household';
  end if;
  if new.user_id is distinct from auth.uid() then
    raise exception 'You can only score a workout for yourself';
  end if;
  return new;
end;
$$;

create trigger workout_ratings_guard
  before insert or update on public.workout_ratings
  for each row execute function public.workout_rating_guard();

grant select, insert, update, delete on table public.workout_ratings to authenticated;

alter table public.workout_ratings enable row level security;

create policy workout_ratings_select on public.workout_ratings
  for select to authenticated
  using (public.can_view_workout(workout_id));

create policy workout_ratings_insert on public.workout_ratings
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_workout(workout_id));

create policy workout_ratings_update on public.workout_ratings
  for update to authenticated
  using (user_id = auth.uid() and public.can_view_workout(workout_id))
  with check (user_id = auth.uid() and public.can_view_workout(workout_id));

create policy workout_ratings_delete on public.workout_ratings
  for delete to authenticated
  using (user_id = auth.uid() and public.can_view_workout(workout_id));
