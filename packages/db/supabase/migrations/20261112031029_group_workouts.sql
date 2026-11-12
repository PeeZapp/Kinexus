-- Group workouts part 1: shared buddy gym sessions (pick → close → build personal copies).
-- Additive only. Category on each pick: prefer exercises.category, else body_part/target_muscle
-- mapping, else the picker-supplied category (validated against group.categories).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.group_workouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  workout_date date not null,
  categories text[] not null,
  picks_per_person integer not null check (picks_per_person between 1 and 10),
  closes_at timestamptz not null,
  join_mode text not null check (join_mode in ('buddies', 'code')),
  join_code text unique,
  status text not null default 'picking'
    check (status in ('picking', 'closed', 'built', 'cancelled')),
  closed_at timestamptz,
  built_at timestamptz,
  created_at timestamptz not null default now(),
  constraint group_workouts_categories_nonempty check (cardinality(categories) >= 1),
  constraint group_workouts_join_code_format check (
    join_code is null
    or (
      char_length(join_code) = 6
      and join_code = upper(join_code)
      and join_code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$'
    )
  ),
  constraint group_workouts_join_code_mode check (
    (join_mode = 'code' and join_code is not null)
    or (join_mode = 'buddies' and join_code is null)
  )
);

create index group_workouts_creator_idx
  on public.group_workouts (creator_id, created_at desc);

create index group_workouts_status_closes_idx
  on public.group_workouts (status, closes_at)
  where status = 'picking';

create table public.group_workout_members (
  group_workout_id uuid not null references public.group_workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  workout_id uuid references public.workouts (id) on delete set null,
  primary key (group_workout_id, user_id)
);

create index group_workout_members_user_idx
  on public.group_workout_members (user_id, joined_at desc);

create table public.group_workout_picks (
  id uuid primary key default gen_random_uuid(),
  group_workout_id uuid not null references public.group_workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  category text not null check (char_length(trim(category)) > 0),
  target_sets integer not null default 3 check (target_sets between 1 and 20),
  target_reps text not null default '10',
  target_unit text null check (target_unit is null or target_unit in ('reps', 'sec', 'min', 'km', 'm')),
  target_duration_sec integer null
    check (target_duration_sec is null or (target_duration_sec > 0 and target_duration_sec <= 86400)),
  target_distance_km numeric(8, 3) null
    check (target_distance_km is null or target_distance_km >= 0),
  created_at timestamptz not null default now(),
  unique (group_workout_id, exercise_id)
);

create index group_workout_picks_group_user_idx
  on public.group_workout_picks (group_workout_id, user_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_group_workout_member(_group_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _group_workout_id is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.group_workout_members m
      where m.group_workout_id = _group_workout_id
        and m.user_id = auth.uid()
    );
$$;

create or replace function public.group_workout_unit_to_tracking(p_unit text)
returns text
language sql
immutable
as $$
  select case p_unit
    when 'sec' then 'intervals'
    when 'min' then 'time'
    when 'km' then 'distance'
    when 'm' then 'distance'
    else 'reps'
  end;
$$;

create or replace function public.generate_group_workout_join_code()
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code text;
  v_i integer;
  v_attempts integer := 0;
begin
  loop
    v_code := '';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_alphabet, (get_byte(gen_random_bytes(1), 0) % 32) + 1, 1);
    end loop;
    exit when not exists (
      select 1 from public.group_workouts g where g.join_code = v_code
    );
    v_attempts := v_attempts + 1;
    if v_attempts > 20 then
      raise exception 'Could not allocate a join code';
    end if;
  end loop;
  return v_code;
end;
$$;

-- Prefer exercises.category; else map body_part / target_muscle; else picker category.
create or replace function public.resolve_group_workout_pick_category(
  p_exercise public.exercises,
  p_picker_category text,
  p_allowed text[]
)
returns text
language plpgsql
stable
as $$
declare
  v_cat text;
  v_body text;
  v_muscle text;
begin
  v_cat := nullif(trim(coalesce(p_exercise.category, '')), '');
  if v_cat is not null and v_cat = any (p_allowed) then
    return v_cat;
  end if;

  v_muscle := lower(trim(coalesce(p_exercise.target_muscle, '')));
  if v_muscle = 'glutes' and 'Glutes' = any (p_allowed) then
    return 'Glutes';
  end if;

  v_body := lower(trim(coalesce(p_exercise.body_part, '')));
  v_cat := case v_body
    when 'chest' then 'Chest'
    when 'triceps' then 'Triceps'
    when 'back' then 'Back'
    when 'biceps' then 'Biceps'
    when 'shoulders' then 'Shoulders'
    when 'core' then 'Core'
    when 'cardio' then 'Cardio'
    when 'legs' then 'Legs'
    else null
  end;
  if v_cat is not null and v_cat = any (p_allowed) then
    return v_cat;
  end if;

  v_cat := nullif(trim(coalesce(p_picker_category, '')), '');
  if v_cat is not null and v_cat = any (p_allowed) then
    return v_cat;
  end if;

  raise exception 'Exercise category is not allowed for this group workout';
end;
$$;

create or replace function public.primary_household_for_user(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.household_id
  from public.household_members m
  where m.user_id = _user_id
  order by m.joined_at asc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_group_workout(
  p_title text,
  p_workout_date date,
  p_categories text[],
  p_picks_per_person integer,
  p_closes_at timestamptz,
  p_join_mode text
)
returns table (id uuid, join_code text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_code text := null;
  v_cats text[];
  v_mode text := lower(trim(coalesce(p_join_mode, '')));
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'Title is required';
  end if;

  if p_workout_date is null then
    raise exception 'Workout date is required';
  end if;

  select array_agg(distinct trim(c))
    into v_cats
  from unnest(coalesce(p_categories, '{}'::text[])) as c
  where char_length(trim(c)) > 0;

  if v_cats is null or cardinality(v_cats) < 1 then
    raise exception 'At least one category is required';
  end if;

  if p_picks_per_person is null
     or p_picks_per_person < 1
     or p_picks_per_person > 10
  then
    raise exception 'picks_per_person must be between 1 and 10';
  end if;

  if p_closes_at is null then
    raise exception 'closes_at is required';
  end if;

  if v_mode not in ('buddies', 'code') then
    raise exception 'join_mode must be buddies or code';
  end if;

  if v_mode = 'code' then
    v_code := public.generate_group_workout_join_code();
  end if;

  insert into public.group_workouts (
    creator_id,
    title,
    workout_date,
    categories,
    picks_per_person,
    closes_at,
    join_mode,
    join_code,
    status
  ) values (
    v_uid,
    left(trim(p_title), 120),
    p_workout_date,
    v_cats,
    p_picks_per_person,
    p_closes_at,
    v_mode,
    v_code,
    'picking'
  )
  returning group_workouts.id into v_id;

  insert into public.group_workout_members (group_workout_id, user_id)
  values (v_id, v_uid);

  return query select v_id, v_code;
end;
$$;

create or replace function public.invite_group_workout_buddy(
  p_group_workout_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.group_workouts%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.group_workouts
  where id = p_group_workout_id
  for update;

  if not found then
    raise exception 'Group workout not found';
  end if;

  if v_row.creator_id is distinct from v_uid then
    raise exception 'Only the creator can invite';
  end if;

  if v_row.status is distinct from 'picking' then
    raise exception 'Picking is closed';
  end if;

  if p_user_id is null or p_user_id = v_uid then
    raise exception 'Invalid buddy';
  end if;

  if not public.are_train_buddies(v_uid, p_user_id) then
    raise exception 'Invitee must be an accepted train buddy';
  end if;

  insert into public.group_workout_members (group_workout_id, user_id)
  values (p_group_workout_id, p_user_id)
  on conflict do nothing;
end;
$$;

create or replace function public.join_group_workout_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_row public.group_workouts%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(v_code) <> 6 then
    raise exception 'Invalid join code';
  end if;

  select * into v_row
  from public.group_workouts
  where join_mode = 'code'
    and join_code = v_code
  for update;

  if not found then
    raise exception 'Group workout not found';
  end if;

  if v_row.status is distinct from 'picking' then
    raise exception 'Picking is closed';
  end if;

  insert into public.group_workout_members (group_workout_id, user_id)
  values (v_row.id, v_uid)
  on conflict do nothing;

  return v_row.id;
end;
$$;

create or replace function public.leave_group_workout(p_group_workout_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.group_workouts%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.group_workouts
  where id = p_group_workout_id
  for update;

  if not found then
    raise exception 'Group workout not found';
  end if;

  if v_row.creator_id = v_uid then
    if v_row.status = 'cancelled' then
      return;
    end if;
    update public.group_workouts
    set status = 'cancelled',
        closed_at = coalesce(closed_at, now())
    where id = v_row.id;
    return;
  end if;

  if not exists (
    select 1
    from public.group_workout_members m
    where m.group_workout_id = p_group_workout_id
      and m.user_id = v_uid
  ) then
    return;
  end if;

  delete from public.group_workout_picks
  where group_workout_id = p_group_workout_id
    and user_id = v_uid;

  delete from public.group_workout_members
  where group_workout_id = p_group_workout_id
    and user_id = v_uid;
end;
$$;

create or replace function public.add_group_workout_pick(
  p_group_workout_id uuid,
  p_exercise_id uuid,
  p_target_sets integer,
  p_target_reps text,
  p_target_unit text,
  p_target_duration_sec integer,
  p_target_distance_km numeric,
  p_category text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_gw public.group_workouts%rowtype;
  v_ex public.exercises%rowtype;
  v_cat text;
  v_unit text;
  v_pick_id uuid;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_gw
  from public.group_workouts
  where id = p_group_workout_id
  for update;

  if not found then
    raise exception 'Group workout not found';
  end if;

  if v_gw.status is distinct from 'picking' then
    raise exception 'Picking is closed';
  end if;

  if v_gw.closes_at <= now() then
    perform public.close_group_workout_if_due(p_group_workout_id);
    raise exception 'Picking is closed';
  end if;

  if not exists (
    select 1
    from public.group_workout_members m
    where m.group_workout_id = p_group_workout_id
      and m.user_id = v_uid
  ) then
    raise exception 'Not a member';
  end if;

  select * into v_ex
  from public.exercises
  where id = p_exercise_id;

  if not found then
    raise exception 'Exercise not found';
  end if;

  -- Catalogue (global active) or the picker's own custom exercise.
  if not (
    (v_ex.scope = 'global' and v_ex.status = 'active')
    or (v_ex.owner_id = v_uid and v_ex.status = 'active')
  ) then
    raise exception 'Exercise is not visible to you';
  end if;

  v_cat := public.resolve_group_workout_pick_category(v_ex, p_category, v_gw.categories);

  select count(*)::integer into v_count
  from public.group_workout_picks p
  where p.group_workout_id = p_group_workout_id
    and p.user_id = v_uid;

  if v_count >= v_gw.picks_per_person then
    raise exception 'All picks used';
  end if;

  v_unit := nullif(trim(coalesce(p_target_unit, '')), '');
  if v_unit is not null and v_unit not in ('reps', 'sec', 'min', 'km', 'm') then
    raise exception 'Invalid target_unit';
  end if;
  if v_unit is null then
    v_unit := 'reps';
  end if;

  insert into public.group_workout_picks (
    group_workout_id,
    user_id,
    exercise_id,
    category,
    target_sets,
    target_reps,
    target_unit,
    target_duration_sec,
    target_distance_km
  ) values (
    p_group_workout_id,
    v_uid,
    p_exercise_id,
    v_cat,
    greatest(1, least(20, coalesce(p_target_sets, 3))),
    left(coalesce(nullif(trim(p_target_reps), ''), '10'), 40),
    v_unit,
    case
      when p_target_duration_sec is null then null
      else greatest(1, least(86400, p_target_duration_sec))
    end,
    case
      when p_target_distance_km is null then null
      else greatest(0, p_target_distance_km)::numeric(8, 3)
    end
  )
  returning id into v_pick_id;

  perform public.close_group_workout_if_due(p_group_workout_id);

  return v_pick_id;
end;
$$;

create or replace function public.remove_group_workout_pick(p_pick_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pick public.group_workout_picks%rowtype;
  v_status text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_pick
  from public.group_workout_picks
  where id = p_pick_id
  for update;

  if not found then
    raise exception 'Pick not found';
  end if;

  if v_pick.user_id is distinct from v_uid then
    raise exception 'Not your pick';
  end if;

  select status into v_status
  from public.group_workouts
  where id = v_pick.group_workout_id;

  if v_status is distinct from 'picking' then
    raise exception 'Picking is closed';
  end if;

  delete from public.group_workout_picks where id = p_pick_id;
end;
$$;

create or replace function public.close_group_workout_if_due(p_group_workout_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gw public.group_workouts%rowtype;
  v_due boolean := false;
  v_member_count integer;
  v_full_count integer;
begin
  select * into v_gw
  from public.group_workouts
  where id = p_group_workout_id
  for update;

  if not found then
    raise exception 'Group workout not found';
  end if;

  if v_gw.status is distinct from 'picking' then
    return v_gw.status in ('closed', 'built');
  end if;

  if v_gw.closes_at <= now() then
    v_due := true;
  else
    select count(*)::integer into v_member_count
    from public.group_workout_members m
    where m.group_workout_id = p_group_workout_id;

    select count(*)::integer into v_full_count
    from (
      select m.user_id
      from public.group_workout_members m
      left join public.group_workout_picks p
        on p.group_workout_id = m.group_workout_id
       and p.user_id = m.user_id
      where m.group_workout_id = p_group_workout_id
      group by m.user_id
      having count(p.id) >= v_gw.picks_per_person
    ) filled;

    if v_member_count > 0 and v_full_count >= v_member_count then
      v_due := true;
    end if;
  end if;

  if not v_due then
    return false;
  end if;

  update public.group_workouts
  set status = 'closed',
      closed_at = coalesce(closed_at, now())
  where id = p_group_workout_id
    and status = 'picking';

  return true;
end;
$$;

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
      equipment
    ) values (
      v_household,
      v_member.user_id,
      v_name,
      'private',
      null,
      null,
      null,
      null,
      '{}'::text[]
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

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table public.group_workouts to authenticated;
grant select, insert, update, delete on table public.group_workout_members to authenticated;
grant select, insert, update, delete on table public.group_workout_picks to authenticated;

revoke all on function public.is_group_workout_member(uuid) from public;
revoke all on function public.group_workout_unit_to_tracking(text) from public;
revoke all on function public.generate_group_workout_join_code() from public;
revoke all on function public.resolve_group_workout_pick_category(public.exercises, text, text[]) from public;
revoke all on function public.primary_household_for_user(uuid) from public;
revoke all on function public.create_group_workout(text, date, text[], integer, timestamptz, text) from public;
revoke all on function public.invite_group_workout_buddy(uuid, uuid) from public;
revoke all on function public.join_group_workout_by_code(text) from public;
revoke all on function public.leave_group_workout(uuid) from public;
revoke all on function public.add_group_workout_pick(uuid, uuid, integer, text, text, integer, numeric, text) from public;
revoke all on function public.remove_group_workout_pick(uuid) from public;
revoke all on function public.close_group_workout_if_due(uuid) from public;
revoke all on function public.build_group_workout(uuid, uuid[]) from public;

grant execute on function public.is_group_workout_member(uuid) to authenticated;
grant execute on function public.create_group_workout(text, date, text[], integer, timestamptz, text) to authenticated;
grant execute on function public.invite_group_workout_buddy(uuid, uuid) to authenticated;
grant execute on function public.join_group_workout_by_code(text) to authenticated;
grant execute on function public.leave_group_workout(uuid) to authenticated;
grant execute on function public.add_group_workout_pick(uuid, uuid, integer, text, text, integer, numeric, text) to authenticated;
grant execute on function public.remove_group_workout_pick(uuid) to authenticated;
grant execute on function public.close_group_workout_if_due(uuid) to authenticated;
grant execute on function public.build_group_workout(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.group_workouts enable row level security;
alter table public.group_workout_members enable row level security;
alter table public.group_workout_picks enable row level security;

create policy group_workouts_select on public.group_workouts
  for select to authenticated
  using (public.is_group_workout_member(id));

create policy group_workouts_update on public.group_workouts
  for update to authenticated
  using (
    creator_id = auth.uid()
    and status = 'picking'
  )
  with check (
    creator_id = auth.uid()
    and status = 'picking'
  );

create policy group_workout_members_select on public.group_workout_members
  for select to authenticated
  using (public.is_group_workout_member(group_workout_id));

create policy group_workout_picks_select on public.group_workout_picks
  for select to authenticated
  using (public.is_group_workout_member(group_workout_id));

create policy group_workout_picks_insert on public.group_workout_picks
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_group_workout_member(group_workout_id)
    and exists (
      select 1
      from public.group_workouts g
      where g.id = group_workout_id
        and g.status = 'picking'
        and g.closes_at > now()
    )
  );

create policy group_workout_picks_delete on public.group_workout_picks
  for delete to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.group_workouts g
      where g.id = group_workout_id
        and g.status = 'picking'
    )
  );

notify pgrst, 'reload schema';
