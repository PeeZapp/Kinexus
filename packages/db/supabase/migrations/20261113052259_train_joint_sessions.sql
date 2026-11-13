-- Joint buddy sessions: session-type options + optional workouts + voting.
-- Invitees need only be buddies with the inviter (not each other).

create table public.train_joint_sessions (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  inviter_household_id uuid not null references public.households (id) on delete cascade,
  scheduled_at timestamptz not null,
  offered_session_type_ids text[] not null
    check (
      cardinality(offered_session_type_ids) between 1 and 3
    ),
  offered_workout_ids uuid[] not null default '{}'::uuid[]
    check (cardinality(offered_workout_ids) <= 3),
  inviter_session_type_id text not null,
  inviter_workout_id uuid references public.workouts (id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'resolved', 'cancelled')),
  resolved_session_type_id text,
  resolved_workout_id uuid references public.workouts (id) on delete set null,
  needs_inviter_decision boolean not null default false,
  decision_reason text
    check (decision_reason is null or decision_reason in ('tie', 'no_picks')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint train_joint_sessions_inviter_type_offered check (
    inviter_session_type_id = any (offered_session_type_ids)
  )
);

create index train_joint_sessions_inviter_idx
  on public.train_joint_sessions (inviter_id, scheduled_at desc);

create index train_joint_sessions_scheduled_idx
  on public.train_joint_sessions (scheduled_at)
  where status <> 'cancelled';

create trigger train_joint_sessions_set_updated_at
  before update on public.train_joint_sessions
  for each row execute function public.set_updated_at();

create table public.train_joint_session_members (
  session_id uuid not null references public.train_joint_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  role text not null check (role in ('inviter', 'invitee')),
  invite_status text not null default 'pending'
    check (invite_status in ('pending', 'accepted', 'declined', 'cancelled')),
  picked_session_type_id text,
  picked_workout_id uuid references public.workouts (id) on delete set null,
  plan_day_id uuid references public.training_plan_days (id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index train_joint_session_members_user_idx
  on public.train_joint_session_members (user_id, invite_status);

alter table public.train_joint_sessions enable row level security;
alter table public.train_joint_session_members enable row level security;

create or replace function public.can_view_train_joint_session(_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.train_joint_session_members m
    where m.session_id = _session_id
      and m.user_id = auth.uid()
  );
$$;

create policy train_joint_sessions_select on public.train_joint_sessions
  for select to authenticated
  using (public.can_view_train_joint_session(id));

create policy train_joint_session_members_select on public.train_joint_session_members
  for select to authenticated
  using (public.can_view_train_joint_session(session_id));

create policy train_joint_session_members_update_own on public.train_joint_session_members
  for update to authenticated
  using (user_id = auth.uid() or public.can_view_train_joint_session(session_id))
  with check (user_id = auth.uid() or public.can_view_train_joint_session(session_id));

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
    raise exception 'Pick at least one buddy';
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
    if not public.are_train_buddies(v_uid, v_invitee) then
      raise exception 'Not buddies with one of the selected people';
    end if;

    insert into public.train_joint_session_members (
      session_id, user_id, role, invite_status
    ) values (
      v_id, v_invitee, 'invitee', 'pending'
    )
    on conflict do nothing;

    -- Share offered workouts with each invitee when present.
    if cardinality(v_workouts) > 0 then
      insert into public.workout_buddy_shares (workout_id, buddy_user_id, household_id)
      select w_id, v_invitee, p_inviter_household_id
      from unnest(v_workouts) as w_id
      on conflict do nothing;
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

  if not public.are_train_buddies(v_session.inviter_id, v_uid) then
    raise exception 'Buddy connection required';
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

create or replace function public.decide_train_joint_session(
  p_session_id uuid,
  p_session_type_id text,
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
  v_type text := nullif(trim(p_session_type_id), '');
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

  if v_session.inviter_id is distinct from v_uid then
    raise exception 'Only the inviter can decide';
  end if;

  if v_session.status = 'cancelled' then
    raise exception 'Session cancelled';
  end if;

  if v_type is null or not (v_type = any (v_session.offered_session_type_ids)) then
    raise exception 'Pick one of the offered session types';
  end if;

  if p_workout_id is not null and not (p_workout_id = any (v_session.offered_workout_ids)) then
    raise exception 'Pick one of the offered workouts';
  end if;

  update public.train_joint_sessions
  set status = 'resolved',
      resolved_session_type_id = v_type,
      resolved_workout_id = p_workout_id,
      needs_inviter_decision = false,
      decision_reason = null
  where id = p_session_id;
end;
$$;

create or replace function public.mark_train_joint_session_needs_decision(
  p_session_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.train_joint_sessions%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_reason is null or p_reason not in ('tie', 'no_picks') then
    raise exception 'Invalid decision reason';
  end if;

  select * into v_session
  from public.train_joint_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Session not found';
  end if;

  if v_session.status = 'cancelled' or v_session.status = 'resolved' then
    return;
  end if;

  if not public.can_view_train_joint_session(p_session_id) then
    raise exception 'Not allowed';
  end if;

  update public.train_joint_sessions
  set needs_inviter_decision = true,
      decision_reason = p_reason
  where id = p_session_id;
end;
$$;

create or replace function public.cancel_train_joint_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.train_joint_sessions%rowtype;
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

  if v_session.inviter_id is distinct from v_uid then
    raise exception 'Only the inviter can cancel';
  end if;

  update public.train_joint_sessions
  set status = 'cancelled',
      needs_inviter_decision = false
  where id = p_session_id;

  update public.train_joint_session_members
  set invite_status = 'cancelled'
  where session_id = p_session_id
    and invite_status = 'pending';
end;
$$;

grant select on table public.train_joint_sessions to authenticated;
grant select on table public.train_joint_session_members to authenticated;

revoke all on function public.can_view_train_joint_session(uuid) from public;
revoke all on function public.create_train_joint_session(uuid, timestamptz, uuid[], text[], uuid[], text, uuid) from public;
revoke all on function public.respond_train_joint_session(uuid, boolean, uuid, text, uuid) from public;
revoke all on function public.decide_train_joint_session(uuid, text, uuid) from public;
revoke all on function public.cancel_train_joint_session(uuid) from public;
revoke all on function public.mark_train_joint_session_needs_decision(uuid, text) from public;

grant execute on function public.can_view_train_joint_session(uuid) to authenticated;
grant execute on function public.create_train_joint_session(uuid, timestamptz, uuid[], text[], uuid[], text, uuid) to authenticated;
grant execute on function public.respond_train_joint_session(uuid, boolean, uuid, text, uuid) to authenticated;
grant execute on function public.decide_train_joint_session(uuid, text, uuid) to authenticated;
grant execute on function public.cancel_train_joint_session(uuid) to authenticated;
grant execute on function public.mark_train_joint_session_needs_decision(uuid, text) to authenticated;

notify pgrst, 'reload schema';
