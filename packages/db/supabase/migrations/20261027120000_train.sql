-- Train: exercise catalog, shared workouts, personal session logs, optional rest games.

create table public.exercises (
  id uuid primary key,
  canonical_key text not null unique,
  name text not null,
  body_part text not null default '',
  equipment text not null default '',
  target_muscle text not null default '',
  secondary_muscles text[] not null default '{}',
  instructions text[] not null default '{}',
  media_url text,
  media_kind text,
  source text not null,
  license text not null,
  license_author text,
  created_at timestamptz not null default now(),
  constraint exercises_media_kind check (media_kind is null or media_kind in ('gif', 'image')),
  constraint exercises_source check (source in ('exercisedb', 'public_domain', 'wger'))
);

create index exercises_body_part_idx on public.exercises (body_part);
create index exercises_name_idx on public.exercises (lower(name));

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  visibility text not null default 'private' check (visibility in ('private', 'household', 'people')),
  split_id text,
  duration_min integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workouts_household_idx on public.workouts (household_id, updated_at desc);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete set null,
  name text not null,
  position integer not null check (position >= 0),
  target_sets integer not null default 3 check (target_sets between 1 and 20),
  target_reps text not null default '10',
  unique (workout_id, position)
);

create index workout_exercises_workout_idx on public.workout_exercises (workout_id);

create table public.workout_people (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  person_id uuid not null references public.household_people (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  primary key (workout_id, person_id)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  workout_id uuid references public.workouts (id) on delete set null,
  name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index workout_sessions_user_idx on public.workout_sessions (user_id, started_at desc);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name text not null,
  position integer not null,
  set_index integer not null,
  weight text not null default '',
  reps text not null default '',
  done boolean not null default false,
  unique (session_id, position, set_index)
);

create index workout_sets_session_idx on public.workout_sets (session_id);

create table public.exercise_records (
  user_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  last_weight text not null default '',
  last_reps text not null default '',
  best_weight text not null default '',
  best_reps text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create table public.user_train_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  rest_extra text not null default 'off' check (rest_extra in ('off', 'quiz', 'memory'))
);

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

create or replace function public.workout_shared_with_me(_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workout_people wp
    join public.household_people hp on hp.id = wp.person_id
    where wp.workout_id = _workout_id
      and hp.user_id = auth.uid()
  );
$$;

create or replace function public.can_view_workout(_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workouts w
    where w.id = _workout_id
      and public.can_view_shared(
        w.household_id,
        w.created_by,
        w.visibility,
        public.workout_shared_with_me(w.id)
      )
  );
$$;

create or replace function public.can_edit_workout(_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workouts w
    where w.id = _workout_id
      and public.can_edit_shared(
        w.household_id,
        w.created_by,
        w.visibility,
        public.workout_shared_with_me(w.id),
        false
      )
  );
$$;

create or replace function public.workout_exercise_guard()
returns trigger
language plpgsql
as $$
declare
  v_household uuid;
begin
  select household_id into v_household from public.workouts where id = new.workout_id;
  if v_household is null or v_household is distinct from new.household_id then
    raise exception 'Exercise must belong to the workout household';
  end if;
  return new;
end;
$$;

create trigger workout_exercises_guard
  before insert or update on public.workout_exercises
  for each row execute function public.workout_exercise_guard();

create or replace function public.workout_person_guard()
returns trigger
language plpgsql
as $$
declare
  v_household uuid;
  v_person_household uuid;
begin
  select household_id into v_household from public.workouts where id = new.workout_id;
  select household_id into v_person_household from public.household_people where id = new.person_id;
  if v_household is null or v_household is distinct from new.household_id or v_person_household is distinct from new.household_id then
    raise exception 'Shared person must belong to the workout household';
  end if;
  return new;
end;
$$;

create trigger workout_people_guard
  before insert or update on public.workout_people
  for each row execute function public.workout_person_guard();

create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select on table public.exercises to authenticated;
grant select, insert, update, delete on table public.workouts to authenticated;
grant select, insert, update, delete on table public.workout_exercises to authenticated;
grant select, insert, update, delete on table public.workout_people to authenticated;
grant select, insert, update, delete on table public.workout_sessions to authenticated;
grant select, insert, update, delete on table public.workout_sets to authenticated;
grant select, insert, update, delete on table public.exercise_records to authenticated;
grant select, insert, update, delete on table public.user_train_prefs to authenticated;

revoke all on function public.workout_shared_with_me(uuid) from public;
revoke all on function public.can_view_workout(uuid) from public;
revoke all on function public.can_edit_workout(uuid) from public;
grant execute on function public.workout_shared_with_me(uuid) to authenticated;
grant execute on function public.can_view_workout(uuid) to authenticated;
grant execute on function public.can_edit_workout(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_people enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;
alter table public.exercise_records enable row level security;
alter table public.user_train_prefs enable row level security;

create policy exercises_select on public.exercises
  for select to authenticated
  using (true);

create policy workouts_select on public.workouts
  for select to authenticated
  using (
    public.can_view_shared(
      household_id,
      created_by,
      visibility,
      public.workout_shared_with_me(id)
    )
  );

create policy workouts_insert on public.workouts
  for insert to authenticated
  with check (
    public.can_create_shared(household_id)
    and created_by = auth.uid()
    and (
      visibility = 'household'
      or visibility = 'people'
      or (visibility = 'private' and created_by = auth.uid())
    )
  );

create policy workouts_update on public.workouts
  for update to authenticated
  using (public.can_edit_workout(id))
  with check (
    public.can_create_shared(household_id)
    and (
      visibility = 'household'
      or visibility = 'people'
      or (visibility = 'private' and created_by = auth.uid())
    )
  );

create policy workouts_delete on public.workouts
  for delete to authenticated
  using (public.can_edit_workout(id));

create policy workout_exercises_select on public.workout_exercises
  for select to authenticated
  using (public.can_view_workout(workout_id));

create policy workout_exercises_insert on public.workout_exercises
  for insert to authenticated
  with check (public.can_edit_workout(workout_id));

create policy workout_exercises_update on public.workout_exercises
  for update to authenticated
  using (public.can_edit_workout(workout_id))
  with check (public.can_edit_workout(workout_id));

create policy workout_exercises_delete on public.workout_exercises
  for delete to authenticated
  using (public.can_edit_workout(workout_id));

create policy workout_people_select on public.workout_people
  for select to authenticated
  using (public.can_view_workout(workout_id));

create policy workout_people_insert on public.workout_people
  for insert to authenticated
  with check (public.can_edit_workout(workout_id));

create policy workout_people_delete on public.workout_people
  for delete to authenticated
  using (public.can_edit_workout(workout_id));

create policy workout_sessions_all on public.workout_sessions
  for all to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id))
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create policy workout_sets_all on public.workout_sets
  for all to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id))
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create policy exercise_records_all on public.exercise_records
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_train_prefs_all on public.user_train_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
