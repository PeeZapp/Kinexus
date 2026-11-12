-- Group workouts part 3: member copies stay off the personal library until opted in.
-- Additive. build_group_workout keeps the same signature / grants / idempotency.

alter table public.workouts
  add column if not exists group_workout_id uuid null
    references public.group_workouts (id) on delete set null,
  add column if not exists in_library boolean not null default true;

create index if not exists workouts_group_workout_id_idx
  on public.workouts (group_workout_id)
  where group_workout_id is not null;

drop index if exists workouts_library_idx;
create index workouts_library_idx
  on public.workouts (household_id, updated_at desc)
  where plan_only = false and in_library = true;

-- Existing built copies (if any) should match the new semantics.
update public.workouts w
set
  group_workout_id = m.group_workout_id,
  in_library = false
from public.group_workout_members m
where m.workout_id = w.id
  and (
    w.group_workout_id is distinct from m.group_workout_id
    or w.in_library is distinct from false
  );

create or replace function public.build_group_workout(
  p_group_workout_id uuid,
  p_ordered_pick_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_gw public.group_workouts%rowtype;
  v_member record;
  v_household uuid;
  v_workout_id uuid;
  v_name text;
  v_pos integer;
  v_pick_id uuid;
  v_pick public.group_workout_picks%rowtype;
  v_ex_name text;
  v_unit text;
  v_tracking text;
  v_expected integer;
  v_ordered uuid[];
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  perform public.close_group_workout_if_due(p_group_workout_id);

  select * into v_gw
  from public.group_workouts
  where id = p_group_workout_id
  for update;

  if not found then
    raise exception 'Group workout not found';
  end if;

  if v_gw.status not in ('closed', 'built') then
    raise exception 'Group workout is not ready to build';
  end if;

  if not exists (
    select 1
    from public.group_workout_members m
    where m.group_workout_id = p_group_workout_id
      and m.user_id = v_uid
  ) then
    raise exception 'Not a member';
  end if;

  v_ordered := coalesce(p_ordered_pick_ids, '{}'::uuid[]);

  select count(*)::integer into v_expected
  from public.group_workout_picks p
  where p.group_workout_id = p_group_workout_id;

  if cardinality(v_ordered) <> v_expected then
    raise exception 'ordered_pick_ids must include every pick exactly once';
  end if;

  if exists (
    select 1
    from unnest(v_ordered) as oid(id)
    left join public.group_workout_picks p
      on p.id = oid.id
     and p.group_workout_id = p_group_workout_id
    where p.id is null
  ) then
    raise exception 'ordered_pick_ids contains unknown picks';
  end if;

  if (
    select count(distinct x)
    from unnest(v_ordered) as t(x)
  ) <> cardinality(v_ordered) then
    raise exception 'ordered_pick_ids must be unique';
  end if;

  v_name := left(trim(v_gw.title), 120);

  for v_member in
    select m.*
    from public.group_workout_members m
    where m.group_workout_id = p_group_workout_id
    order by m.joined_at, m.user_id
  loop
    if v_member.workout_id is not null then
      continue;
    end if;

    v_household := public.primary_household_for_user(v_member.user_id);
    if v_household is null then
      raise exception 'Member has no household';
    end if;

    insert into public.workouts (
      household_id,
      created_by,
      name,
      visibility,
      split_id,
      duration_min,
      level,
      goal,
      equipment,
      group_workout_id,
      in_library
    ) values (
      v_household,
      v_member.user_id,
      v_name,
      'private',
      null,
      null,
      null,
      null,
      '{}'::text[],
      p_group_workout_id,
      false
    )
    returning id into v_workout_id;

    v_pos := 0;
    foreach v_pick_id in array v_ordered
    loop
      select * into v_pick
      from public.group_workout_picks
      where id = v_pick_id;

      select left(coalesce(nullif(trim(e.name), ''), 'Exercise'), 160)
        into v_ex_name
      from public.exercises e
      where e.id = v_pick.exercise_id;

      v_unit := coalesce(v_pick.target_unit, 'reps');
      v_tracking := public.group_workout_unit_to_tracking(v_unit);

      insert into public.workout_exercises (
        workout_id,
        household_id,
        exercise_id,
        name,
        position,
        tracking,
        target_unit,
        target_sets,
        target_reps,
        target_duration_sec,
        target_distance_km
      ) values (
        v_workout_id,
        v_household,
        v_pick.exercise_id,
        coalesce(v_ex_name, 'Exercise'),
        v_pos,
        v_tracking,
        v_unit,
        v_pick.target_sets,
        v_pick.target_reps,
        v_pick.target_duration_sec,
        v_pick.target_distance_km
      );

      v_pos := v_pos + 1;
    end loop;

    update public.group_workout_members
    set workout_id = v_workout_id
    where group_workout_id = p_group_workout_id
      and user_id = v_member.user_id;
  end loop;

  update public.group_workouts
  set status = 'built',
      built_at = coalesce(built_at, now()),
      closed_at = coalesce(closed_at, now())
  where id = p_group_workout_id
    and status in ('closed', 'built');
end;
$$;

-- Plan-linked and group copies share one "save to library" path.
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
      in_library = true
  where id = p_workout_id
    and (plan_only = true or in_library = false);
end;
$$;

revoke all on function public.build_group_workout(uuid, uuid[]) from public;
revoke all on function public.build_group_workout(uuid, uuid[]) from anon;
grant execute on function public.build_group_workout(uuid, uuid[]) to authenticated;

revoke all on function public.save_workout_to_library(uuid) from public;
revoke all on function public.save_workout_to_library(uuid) from anon;
grant execute on function public.save_workout_to_library(uuid) to authenticated;

notify pgrst, 'reload schema';
