-- Allow joint-session invites to household family members (not only train buddies).

create or replace function public.create_train_joint_session(
  p_inviter_household_id uuid,
  p_scheduled_at timestamptz,
  p_invitee_ids uuid[],
  p_offered_session_type_ids text[],
  p_offered_workout_ids uuid[] default '{}'::uuid[],
  p_inviter_session_type_id text default null,
  p_inviter_workout_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_invitee uuid;
  v_types text[];
  v_workouts uuid[];
  v_pref text;
  v_is_buddy boolean;
  v_is_family boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_inviter_household_id is null or not public.is_household_member(p_inviter_household_id) then
    raise exception 'Household required';
  end if;

  if p_scheduled_at is null then
    raise exception 'Schedule required';
  end if;

  if p_invitee_ids is null or cardinality(p_invitee_ids) = 0 then
    raise exception 'Pick at least one person';
  end if;

  v_types := coalesce(p_offered_session_type_ids, '{}'::text[]);
  if cardinality(v_types) < 1 or cardinality(v_types) > 3 then
    raise exception 'Pick 1 to 3 session types';
  end if;

  v_workouts := coalesce(p_offered_workout_ids, '{}'::uuid[]);
  if cardinality(v_workouts) > 3 then
    raise exception 'Pick up to 3 workouts';
  end if;

  v_pref := coalesce(nullif(trim(p_inviter_session_type_id), ''), v_types[1]);
  if not (v_pref = any (v_types)) then
    raise exception 'Preference must be one of the offered session types';
  end if;

  if p_inviter_workout_id is not null and not (p_inviter_workout_id = any (v_workouts)) then
    raise exception 'Preferred workout must be one of the offered workouts';
  end if;

  insert into public.train_joint_sessions (
    inviter_id,
    inviter_household_id,
    scheduled_at,
    offered_session_type_ids,
    offered_workout_ids,
    inviter_session_type_id,
    inviter_workout_id
  ) values (
    v_uid,
    p_inviter_household_id,
    p_scheduled_at,
    v_types,
    v_workouts,
    v_pref,
    p_inviter_workout_id
  )
  returning id into v_id;

  insert into public.train_joint_session_members (
    session_id, user_id, household_id, role, invite_status, responded_at
  ) values (
    v_id, v_uid, p_inviter_household_id, 'inviter', 'accepted', now()
  );

  foreach v_invitee in array p_invitee_ids
  loop
    if v_invitee is null or v_invitee = v_uid then
      continue;
    end if;

    v_is_buddy := public.are_train_buddies(v_uid, v_invitee);
    v_is_family := exists (
      select 1
      from public.household_members hm
      where hm.household_id = p_inviter_household_id
        and hm.user_id = v_invitee
    );

    if not v_is_buddy and not v_is_family then
      raise exception 'Invitees must be family or buddies';
    end if;

    insert into public.train_joint_session_members (
      session_id, user_id, role, invite_status,
      household_id
    ) values (
      v_id, v_invitee, 'invitee', 'pending',
      case when v_is_family then p_inviter_household_id else null end
    )
    on conflict do nothing;

    -- Buddy shares only for actual buddies (family uses household visibility).
    if v_is_buddy and cardinality(v_workouts) > 0 then
      insert into public.workout_buddy_shares (workout_id, buddy_user_id, household_id)
      select w_id, v_invitee, p_inviter_household_id
      from unnest(v_workouts) as w_id
      on conflict do nothing;
    end if;

    if v_is_family and cardinality(v_workouts) > 0 then
      update public.workouts
      set visibility = 'household'
      where id = any (v_workouts)
        and visibility = 'private'
        and created_by = v_uid
        and household_id = p_inviter_household_id;
    end if;
  end loop;

  return v_id;
end;
$$;

create or replace function public.respond_train_joint_session(
  p_session_id uuid,
  p_accept boolean,
  p_household_id uuid default null,
  p_session_type_id text default null,
  p_workout_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.train_joint_sessions%rowtype;
  v_pick_type text;
  v_pick_workout uuid;
  v_allowed boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_session
  from public.train_joint_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Session not found';
  end if;

  if v_session.status = 'cancelled' then
    raise exception 'Session cancelled';
  end if;

  if not exists (
    select 1 from public.train_joint_session_members
    where session_id = p_session_id and user_id = v_uid and role = 'invitee'
  ) then
    raise exception 'Only invitees can respond';
  end if;

  v_allowed := public.are_train_buddies(v_session.inviter_id, v_uid)
    or exists (
      select 1
      from public.household_members hm
      where hm.household_id = v_session.inviter_household_id
        and hm.user_id = v_uid
    );

  if not v_allowed then
    raise exception 'Family or buddy connection required';
  end if;

  if not coalesce(p_accept, false) then
    update public.train_joint_session_members
    set invite_status = 'declined',
        responded_at = now(),
        picked_session_type_id = null,
        picked_workout_id = null,
        household_id = coalesce(p_household_id, household_id)
    where session_id = p_session_id and user_id = v_uid;
    return;
  end if;

  v_pick_type := nullif(trim(p_session_type_id), '');
  if v_pick_type is not null and not (v_pick_type = any (v_session.offered_session_type_ids)) then
    raise exception 'Pick one of the offered session types';
  end if;

  v_pick_workout := p_workout_id;
  if v_pick_workout is not null and not (v_pick_workout = any (v_session.offered_workout_ids)) then
    raise exception 'Pick one of the offered workouts';
  end if;

  update public.train_joint_session_members
  set invite_status = 'accepted',
      responded_at = now(),
      household_id = coalesce(p_household_id, household_id),
      picked_session_type_id = v_pick_type,
      picked_workout_id = v_pick_workout
  where session_id = p_session_id and user_id = v_uid;
end;
$$;

revoke all on function public.create_train_joint_session(uuid, timestamptz, uuid[], text[], uuid[], text, uuid) from public;
revoke all on function public.respond_train_joint_session(uuid, boolean, uuid, text, uuid) from public;
grant execute on function public.create_train_joint_session(uuid, timestamptz, uuid[], text[], uuid[], text, uuid) to authenticated;
grant execute on function public.respond_train_joint_session(uuid, boolean, uuid, text, uuid) to authenticated;

notify pgrst, 'reload schema';
