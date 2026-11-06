-- Train social part 4: global creator workout library.
-- Depends on 3c (is_approved_creator) and 6b (visibility incl. global + creator-gated RLS).
-- Publishing to Everyone requires approved creator + level/goal/equipment tags (RLS + guard).

-- ---------------------------------------------------------------------------
-- Tags + attribution on workouts / plans
-- ---------------------------------------------------------------------------

alter table public.workouts
  add column if not exists level text,
  add column if not exists goal text,
  add column if not exists equipment text[] not null default '{}',
  add column if not exists source_workout_id uuid references public.workouts (id) on delete set null,
  add column if not exists source_creator_id uuid references public.profiles (id) on delete set null;

alter table public.workouts drop constraint if exists workouts_level_check;
alter table public.workouts
  add constraint workouts_level_check
  check (level is null or level in ('beginner', 'intermediate', 'advanced'));

alter table public.workouts drop constraint if exists workouts_goal_check;
alter table public.workouts
  add constraint workouts_goal_check
  check (
    goal is null
    or goal in ('strength', 'hypertrophy', 'conditioning', 'mobility', 'fat_loss')
  );

alter table public.workouts drop constraint if exists workouts_equipment_check;
alter table public.workouts
  add constraint workouts_equipment_check
  check (
    equipment <@ array[
      'bodyweight',
      'dumbbells',
      'barbell',
      'kettlebell',
      'bands',
      'machines',
      'cable',
      'other'
    ]::text[]
  );

alter table public.workouts drop constraint if exists workouts_global_tags_check;
alter table public.workouts
  add constraint workouts_global_tags_check
  check (
    visibility <> 'global'
    or (
      level is not null
      and goal is not null
      and cardinality(equipment) > 0
    )
  );

create index if not exists workouts_global_library_idx
  on public.workouts (updated_at desc)
  where visibility = 'global';

create index if not exists workouts_global_level_idx
  on public.workouts (level)
  where visibility = 'global';

create index if not exists workouts_global_goal_idx
  on public.workouts (goal)
  where visibility = 'global';

alter table public.train_plans
  add column if not exists level text,
  add column if not exists goal text,
  add column if not exists equipment text[] not null default '{}';

alter table public.train_plans drop constraint if exists train_plans_level_check;
alter table public.train_plans
  add constraint train_plans_level_check
  check (level is null or level in ('beginner', 'intermediate', 'advanced'));

alter table public.train_plans drop constraint if exists train_plans_goal_check;
alter table public.train_plans
  add constraint train_plans_goal_check
  check (
    goal is null
    or goal in ('strength', 'hypertrophy', 'conditioning', 'mobility', 'fat_loss')
  );

alter table public.train_plans drop constraint if exists train_plans_equipment_check;
alter table public.train_plans
  add constraint train_plans_equipment_check
  check (
    equipment <@ array[
      'bodyweight',
      'dumbbells',
      'barbell',
      'kettlebell',
      'bands',
      'machines',
      'cable',
      'other'
    ]::text[]
  );

alter table public.train_plans drop constraint if exists train_plans_global_tags_check;
alter table public.train_plans
  add constraint train_plans_global_tags_check
  check (
    visibility <> 'global'
    or (
      level is not null
      and goal is not null
      and cardinality(equipment) > 0
    )
  );

-- ---------------------------------------------------------------------------
-- Guard: only owner + approved creator may publish/unpublish Everyone;
-- tags required when visibility = global.
-- ---------------------------------------------------------------------------

create or replace function public.workout_global_publish_guard()
returns trigger
language plpgsql
as $$
begin
  if new.visibility = 'global' then
    if new.created_by is distinct from auth.uid() then
      raise exception 'Only the workout owner can publish to Everyone';
    end if;
    if not public.is_approved_creator() then
      raise exception 'Only verified creators can publish to Everyone';
    end if;
    if new.level is null or new.goal is null or coalesce(cardinality(new.equipment), 0) = 0 then
      raise exception 'Everyone publish requires level, goal, and equipment tags';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and old.visibility = 'global'
    and new.visibility is distinct from 'global'
    and old.created_by is distinct from auth.uid()
  then
    raise exception 'Only the workout owner can unpublish from Everyone';
  end if;

  return new;
end;
$$;

drop trigger if exists workouts_global_publish_guard on public.workouts;
create trigger workouts_global_publish_guard
  before insert or update on public.workouts
  for each row execute function public.workout_global_publish_guard();

create or replace function public.train_plan_global_publish_guard()
returns trigger
language plpgsql
as $$
begin
  if new.visibility = 'global' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'Only the plan owner can publish to Everyone';
    end if;
    if not public.is_approved_creator() then
      raise exception 'Only verified creators can publish to Everyone';
    end if;
    if new.level is null or new.goal is null or coalesce(cardinality(new.equipment), 0) = 0 then
      raise exception 'Everyone publish requires level, goal, and equipment tags';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and old.visibility = 'global'
    and new.visibility is distinct from 'global'
    and old.user_id is distinct from auth.uid()
  then
    raise exception 'Only the plan owner can unpublish from Everyone';
  end if;

  return new;
end;
$$;

drop trigger if exists train_plans_global_publish_guard on public.train_plans;
create trigger train_plans_global_publish_guard
  before insert or update on public.train_plans
  for each row execute function public.train_plan_global_publish_guard();

-- ---------------------------------------------------------------------------
-- RLS: owner-only global writes (in addition to is_approved_creator)
-- ---------------------------------------------------------------------------

drop policy if exists workouts_insert on public.workouts;
create policy workouts_insert on public.workouts
  for insert to authenticated
  with check (
    public.can_create_shared(household_id)
    and created_by = auth.uid()
    and (
      visibility = 'household'
      or visibility = 'people'
      or visibility = 'buddies'
      or visibility = 'buddies_selected'
      or (visibility = 'private' and created_by = auth.uid())
      or (
        visibility = 'global'
        and created_by = auth.uid()
        and public.is_approved_creator()
      )
    )
  );

drop policy if exists workouts_update on public.workouts;
create policy workouts_update on public.workouts
  for update to authenticated
  using (public.can_edit_workout(id))
  with check (
    public.can_create_shared(household_id)
    and (
      visibility = 'household'
      or visibility = 'people'
      or visibility = 'buddies'
      or visibility = 'buddies_selected'
      or (visibility = 'private' and created_by = auth.uid())
      or (
        visibility = 'global'
        and created_by = auth.uid()
        and public.is_approved_creator()
      )
    )
  );

drop policy if exists train_plans_insert on public.train_plans;
create policy train_plans_insert on public.train_plans
  for insert to authenticated
  with check (
    public.can_create_shared(household_id)
    and user_id = auth.uid()
    and (
      visibility = 'household'
      or visibility = 'people'
      or visibility = 'buddies'
      or visibility = 'buddies_selected'
      or (visibility = 'private' and user_id = auth.uid())
      or (
        visibility = 'global'
        and user_id = auth.uid()
        and public.is_approved_creator()
      )
    )
  );

drop policy if exists train_plans_update on public.train_plans;
create policy train_plans_update on public.train_plans
  for update to authenticated
  using (public.can_edit_train_plan(id))
  with check (
    public.can_create_shared(household_id)
    and (
      visibility = 'household'
      or visibility = 'people'
      or visibility = 'buddies'
      or visibility = 'buddies_selected'
      or (visibility = 'private' and user_id = auth.uid())
      or (
        visibility = 'global'
        and user_id = auth.uid()
        and public.is_approved_creator()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Global workout ratings (one score per user per workout; watchlist pattern)
-- ---------------------------------------------------------------------------

create table public.train_global_workout_ratings (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score smallint not null check (score between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (workout_id, user_id)
);

create index train_global_workout_ratings_workout_idx
  on public.train_global_workout_ratings (workout_id, updated_at desc);

create index train_global_workout_ratings_user_idx
  on public.train_global_workout_ratings (user_id, updated_at desc);

create or replace function public.train_global_workout_rating_guard()
returns trigger
language plpgsql
as $$
declare
  v_visibility text;
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'You can only rate a workout for yourself';
  end if;

  select visibility into v_visibility
  from public.workouts
  where id = new.workout_id;

  if v_visibility is distinct from 'global' then
    raise exception 'Only Everyone workouts can receive global ratings';
  end if;

  return new;
end;
$$;

drop trigger if exists train_global_workout_ratings_guard on public.train_global_workout_ratings;
create trigger train_global_workout_ratings_guard
  before insert or update on public.train_global_workout_ratings
  for each row execute function public.train_global_workout_rating_guard();

drop trigger if exists train_global_workout_ratings_set_updated_at on public.train_global_workout_ratings;
create trigger train_global_workout_ratings_set_updated_at
  before update on public.train_global_workout_ratings
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.train_global_workout_ratings to authenticated;

alter table public.train_global_workout_ratings enable row level security;

create policy train_global_workout_ratings_select on public.train_global_workout_ratings
  for select to authenticated
  using (
    exists (
      select 1
      from public.workouts w
      where w.id = workout_id
        and w.visibility = 'global'
    )
  );

create policy train_global_workout_ratings_insert on public.train_global_workout_ratings
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.workouts w
      where w.id = workout_id
        and w.visibility = 'global'
    )
  );

create policy train_global_workout_ratings_update on public.train_global_workout_ratings
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.workouts w
      where w.id = workout_id
        and w.visibility = 'global'
    )
  );

create policy train_global_workout_ratings_delete on public.train_global_workout_ratings
  for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.train_global_workout_score(_workout_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(avg(score)::numeric, 1)
  from public.train_global_workout_ratings
  where workout_id = _workout_id;
$$;

revoke all on function public.train_global_workout_score(uuid) from public;
grant execute on function public.train_global_workout_score(uuid) to authenticated;
