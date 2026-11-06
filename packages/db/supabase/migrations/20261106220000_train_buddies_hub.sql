-- Train social part 3: Buddies hub — train-together invites + activity feed (high-fives).
-- Depends on 20261106200000 (buddies) and 20261106210000 (visibility / workout_buddy_shares).

-- ---------------------------------------------------------------------------
-- Train together
-- ---------------------------------------------------------------------------

create table public.train_together_invites (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  scheduled_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint train_together_invites_no_self check (inviter_id <> invitee_id)
);

create index train_together_invites_invitee_idx
  on public.train_together_invites (invitee_id, status, created_at desc);

create index train_together_invites_inviter_idx
  on public.train_together_invites (inviter_id, status, created_at desc);

create index train_together_invites_scheduled_idx
  on public.train_together_invites (scheduled_at)
  where scheduled_at is not null and status = 'accepted';

create trigger train_together_invites_set_updated_at
  before update on public.train_together_invites
  for each row execute function public.set_updated_at();

create or replace function public.train_together_invite_guard()
returns trigger
language plpgsql
as $$
declare
  v_household uuid;
  v_owner uuid;
begin
  select household_id, created_by into v_household, v_owner
  from public.workouts
  where id = new.workout_id;

  if v_household is null or v_household is distinct from new.household_id then
    raise exception 'Train-together invite must belong to the workout household';
  end if;

  if v_owner is null or v_owner is distinct from new.inviter_id then
    raise exception 'Only the workout owner can send a train-together invite';
  end if;

  if not public.are_train_buddies(new.inviter_id, new.invitee_id) then
    raise exception 'Train-together requires an accepted train buddy connection';
  end if;

  return new;
end;
$$;

create trigger train_together_invites_guard
  before insert or update on public.train_together_invites
  for each row execute function public.train_together_invite_guard();

create or replace function public.can_view_train_together_invite(_invite_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.train_together_invites i
    where i.id = _invite_id
      and auth.uid() is not null
      and (i.inviter_id = auth.uid() or i.invitee_id = auth.uid())
      and public.are_train_buddies(i.inviter_id, i.invitee_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Activity feed
-- ---------------------------------------------------------------------------

create table public.train_buddy_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null
    check (event_type in ('completed_workout', 'new_pr', 'shared_workout')),
  workout_id uuid references public.workouts (id) on delete set null,
  session_id uuid references public.workout_sessions (id) on delete set null,
  exercise_id uuid references public.exercises (id) on delete set null,
  title text not null default '',
  created_at timestamptz not null default now()
);

create index train_buddy_events_actor_idx
  on public.train_buddy_events (actor_id, created_at desc);

create index train_buddy_events_created_idx
  on public.train_buddy_events (created_at desc);

create table public.train_buddy_event_high_fives (
  event_id uuid not null references public.train_buddy_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index train_buddy_event_high_fives_user_idx
  on public.train_buddy_event_high_fives (user_id, created_at desc);

create or replace function public.train_buddy_event_permission(_event_type text)
returns text
language sql
immutable
as $$
  select case _event_type
    when 'completed_workout' then 'can_view_sessions'
    when 'new_pr' then 'can_view_prs'
    when 'shared_workout' then 'can_view_workouts'
    else null
  end;
$$;

create or replace function public.can_view_train_buddy_event(_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.train_buddy_events e
    where e.id = _event_id
      and auth.uid() is not null
      and (
        e.actor_id = auth.uid()
        or (
          public.are_train_buddies(e.actor_id, auth.uid())
          and public.buddy_can(
            e.actor_id,
            auth.uid(),
            public.train_buddy_event_permission(e.event_type)
          )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Event generators (server-side)
-- ---------------------------------------------------------------------------

create or replace function public.train_buddy_emit_completed_workout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.finished_at is not null
     and (tg_op = 'INSERT' or old.finished_at is null)
  then
    insert into public.train_buddy_events (actor_id, event_type, workout_id, session_id, title)
    values (
      new.user_id,
      'completed_workout',
      new.workout_id,
      new.id,
      coalesce(nullif(trim(new.name), ''), 'Workout')
    );
  end if;
  return new;
end;
$$;

create trigger train_buddy_emit_completed_workout
  after insert or update of finished_at on public.workout_sessions
  for each row execute function public.train_buddy_emit_completed_workout();

create or replace function public.train_buddy_emit_new_pr()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_improved boolean := false;
begin
  if tg_op = 'INSERT' then
    v_improved :=
      nullif(trim(new.best_weight), '') is not null
      or nullif(trim(new.best_reps), '') is not null;
  else
    v_improved :=
      (nullif(trim(new.best_weight), '') is distinct from nullif(trim(old.best_weight), ''))
      or (nullif(trim(new.best_reps), '') is distinct from nullif(trim(old.best_reps), ''));
  end if;

  if not v_improved then
    return new;
  end if;

  select coalesce(nullif(trim(e.name), ''), 'Exercise') into v_name
  from public.exercises e
  where e.id = new.exercise_id;

  insert into public.train_buddy_events (actor_id, event_type, exercise_id, title)
  values (
    new.user_id,
    'new_pr',
    new.exercise_id,
    coalesce(v_name, 'Exercise')
  );
  return new;
end;
$$;

create trigger train_buddy_emit_new_pr
  after insert or update of best_weight, best_reps on public.exercise_records
  for each row execute function public.train_buddy_emit_new_pr();

create or replace function public.train_buddy_emit_shared_workout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_name text;
begin
  select created_by, coalesce(nullif(trim(name), ''), 'Workout')
    into v_owner, v_name
  from public.workouts
  where id = new.workout_id;

  if v_owner is null then
    return new;
  end if;

  insert into public.train_buddy_events (actor_id, event_type, workout_id, title)
  values (v_owner, 'shared_workout', new.workout_id, v_name);
  return new;
end;
$$;

create trigger train_buddy_emit_shared_workout
  after insert on public.workout_buddy_shares
  for each row execute function public.train_buddy_emit_shared_workout();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.invite_train_together(
  p_workout_id uuid,
  p_invitee_ids uuid[],
  p_scheduled_at timestamptz default null
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid;
  v_owner uuid;
  v_visibility text;
  v_invitee uuid;
  v_ids uuid[] := '{}';
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_workout_id is null then
    raise exception 'Workout is required';
  end if;

  if p_invitee_ids is null or cardinality(p_invitee_ids) = 0 then
    raise exception 'Pick at least one buddy';
  end if;

  select household_id, created_by, visibility
    into v_household, v_owner, v_visibility
  from public.workouts
  where id = p_workout_id;

  if v_household is null then
    raise exception 'Workout not found';
  end if;

  if v_owner is distinct from v_uid then
    raise exception 'Only the workout owner can invite';
  end if;

  if v_visibility not in ('buddies', 'buddies_selected', 'global') then
    update public.workouts
    set visibility = 'buddies_selected'
    where id = p_workout_id;
  end if;

  foreach v_invitee in array p_invitee_ids
  loop
    if v_invitee is null or v_invitee = v_uid then
      continue;
    end if;

    if not public.are_train_buddies(v_uid, v_invitee) then
      raise exception 'Not buddies with one of the selected people';
    end if;

    insert into public.workout_buddy_shares (workout_id, buddy_user_id, household_id)
    values (p_workout_id, v_invitee, v_household)
    on conflict do nothing;

    insert into public.train_together_invites (
      workout_id,
      inviter_id,
      invitee_id,
      household_id,
      scheduled_at,
      status
    )
    values (
      p_workout_id,
      v_uid,
      v_invitee,
      v_household,
      p_scheduled_at,
      'pending'
    )
    returning id into v_id;

    v_ids := array_append(v_ids, v_id);
  end loop;

  if cardinality(v_ids) = 0 then
    raise exception 'No invites created';
  end if;

  return v_ids;
end;
$$;

create or replace function public.respond_train_together(
  p_invite_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.train_together_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.train_together_invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;

  if v_row.invitee_id is distinct from v_uid then
    raise exception 'Only the invitee can respond';
  end if;

  if v_row.status is distinct from 'pending' then
    raise exception 'Invite is not pending';
  end if;

  if not public.are_train_buddies(v_row.inviter_id, v_row.invitee_id) then
    raise exception 'Buddy connection required';
  end if;

  if not coalesce(p_accept, false) then
    update public.train_together_invites
    set status = 'declined'
    where id = v_row.id;
    return;
  end if;

  update public.train_together_invites
  set status = 'accepted'
  where id = v_row.id;

  -- Ensure share remains; scheduled items surface via train_together_invites on Plan
  -- (cross-household workouts cannot be written onto the invitee's train_plan_days).
  insert into public.workout_buddy_shares (workout_id, buddy_user_id, household_id)
  values (v_row.workout_id, v_row.invitee_id, v_row.household_id)
  on conflict do nothing;
end;
$$;

create or replace function public.cancel_train_together(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.train_together_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.train_together_invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;

  if v_row.inviter_id is distinct from v_uid then
    raise exception 'Only the inviter can cancel';
  end if;

  if v_row.status is distinct from 'pending' then
    raise exception 'Invite is not pending';
  end if;

  update public.train_together_invites
  set status = 'cancelled'
  where id = v_row.id;
end;
$$;

create or replace function public.high_five_train_buddy_event(p_event_id uuid)
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

  if not public.can_view_train_buddy_event(p_event_id) then
    raise exception 'Event not found';
  end if;

  insert into public.train_buddy_event_high_fives (event_id, user_id)
  values (p_event_id, v_uid)
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table public.train_together_invites to authenticated;
grant select on table public.train_buddy_events to authenticated;
grant select, insert, delete on table public.train_buddy_event_high_fives to authenticated;

revoke all on function public.can_view_train_together_invite(uuid) from public;
revoke all on function public.train_buddy_event_permission(text) from public;
revoke all on function public.can_view_train_buddy_event(uuid) from public;
revoke all on function public.invite_train_together(uuid, uuid[], timestamptz) from public;
revoke all on function public.respond_train_together(uuid, boolean) from public;
revoke all on function public.cancel_train_together(uuid) from public;
revoke all on function public.high_five_train_buddy_event(uuid) from public;

grant execute on function public.can_view_train_together_invite(uuid) to authenticated;
grant execute on function public.train_buddy_event_permission(text) to authenticated;
grant execute on function public.can_view_train_buddy_event(uuid) to authenticated;
grant execute on function public.invite_train_together(uuid, uuid[], timestamptz) to authenticated;
grant execute on function public.respond_train_together(uuid, boolean) to authenticated;
grant execute on function public.cancel_train_together(uuid) to authenticated;
grant execute on function public.high_five_train_buddy_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.train_together_invites enable row level security;
alter table public.train_buddy_events enable row level security;
alter table public.train_buddy_event_high_fives enable row level security;

create policy train_together_invites_select on public.train_together_invites
  for select to authenticated
  using (public.can_view_train_together_invite(id));

create policy train_together_invites_insert on public.train_together_invites
  for insert to authenticated
  with check (
    inviter_id = auth.uid()
    and public.are_train_buddies(inviter_id, invitee_id)
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id
        and w.created_by = auth.uid()
        and w.household_id = household_id
    )
  );

create policy train_together_invites_update on public.train_together_invites
  for update to authenticated
  using (
    (inviter_id = auth.uid() or invitee_id = auth.uid())
    and public.are_train_buddies(inviter_id, invitee_id)
  )
  with check (
    (inviter_id = auth.uid() or invitee_id = auth.uid())
    and public.are_train_buddies(inviter_id, invitee_id)
  );

create policy train_buddy_events_select on public.train_buddy_events
  for select to authenticated
  using (public.can_view_train_buddy_event(id));

create policy train_buddy_event_high_fives_select on public.train_buddy_event_high_fives
  for select to authenticated
  using (public.can_view_train_buddy_event(event_id));

create policy train_buddy_event_high_fives_insert on public.train_buddy_event_high_fives
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.can_view_train_buddy_event(event_id)
  );

create policy train_buddy_event_high_fives_delete on public.train_buddy_event_high_fives
  for delete to authenticated
  using (user_id = auth.uid());
