-- Who opted a workout into the personal Yours library.

alter table public.workouts
  add column if not exists added_by uuid null
    references public.profiles (id) on delete set null;

create index if not exists workouts_added_by_idx
  on public.workouts (household_id, added_by)
  where added_by is not null;

-- Existing library rows: treat creator as the person who added them.
update public.workouts
set added_by = created_by
where in_library = true
  and plan_only = false
  and added_by is null
  and created_by is not null;

create or replace function public.create_private_workout(
  p_household_id uuid,
  p_name text default 'Train',
  p_duration_min integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_household_id is null then
    raise exception 'household_id is required';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Not a member of this household';
  end if;

  insert into public.workouts (
    household_id,
    created_by,
    added_by,
    name,
    visibility,
    split_id,
    duration_min,
    level,
    goal,
    equipment
  ) values (
    p_household_id,
    v_uid,
    v_uid,
    left(coalesce(nullif(trim(p_name), ''), 'Train'), 120),
    'private',
    null,
    p_duration_min,
    null,
    null,
    '{}'::text[]
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.save_workout_to_library(p_workout_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_workout_id is null then
    raise exception 'workout_id is required';
  end if;

  if not exists (select 1 from public.workouts w where w.id = p_workout_id) then
    raise exception 'Workout not found';
  end if;

  if not public.can_edit_workout(p_workout_id) then
    raise exception 'Not allowed to save this workout';
  end if;

  update public.workouts
  set plan_only = false,
      in_library = true,
      added_by = coalesce(added_by, v_uid)
  where id = p_workout_id
    and (plan_only = true or in_library = false or added_by is null);
end;
$$;

revoke all on function public.create_private_workout(uuid, text, integer) from public;
grant execute on function public.create_private_workout(uuid, text, integer) to authenticated;

revoke all on function public.save_workout_to_library(uuid) from public;
revoke all on function public.save_workout_to_library(uuid) from anon;
grant execute on function public.save_workout_to_library(uuid) to authenticated;

notify pgrst, 'reload schema';
