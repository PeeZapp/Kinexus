-- Train social part 2: per-item visibility (buddies / specific buddies) + family plan sharing.
-- Justification for workout_buddy_shares (new table, not extending workout_people):
--   workout_people FKs household_people (same-household only). Buddies are cross-household
--   profile ids, so a separate share table keeps household 'people' sharing intact and RLS clear.
-- Global/'Everyone' discovery hub is 6d; this migration only keeps enum + creator gate.

-- ---------------------------------------------------------------------------
-- Visibility enum expansion (workouts)
-- ---------------------------------------------------------------------------

alter table public.workouts drop constraint if exists workouts_visibility_check;
alter table public.workouts
  add constraint workouts_visibility_check
  check (
    visibility in (
      'private',
      'household',
      'people',
      'buddies',
      'buddies_selected',
      'global'
    )
  );

-- ---------------------------------------------------------------------------
-- Specific-buddy shares
-- ---------------------------------------------------------------------------

create table public.workout_buddy_shares (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  buddy_user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  primary key (workout_id, buddy_user_id)
);

create index workout_buddy_shares_buddy_idx
  on public.workout_buddy_shares (buddy_user_id);

create or replace function public.workout_buddy_share_guard()
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
    raise exception 'Buddy share must belong to the workout household';
  end if;

  if v_owner is null or v_owner = new.buddy_user_id then
    raise exception 'Invalid buddy share target';
  end if;

  if not public.are_train_buddies(v_owner, new.buddy_user_id) then
    raise exception 'Buddy share requires an accepted train buddy connection';
  end if;

  return new;
end;
$$;

create trigger workout_buddy_shares_guard
  before insert or update on public.workout_buddy_shares
  for each row execute function public.workout_buddy_share_guard();

-- ---------------------------------------------------------------------------
-- Training plans (weekly split) + buddy shares
-- ---------------------------------------------------------------------------

create table public.train_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'My plan',
  visibility text not null default 'private'
    check (
      visibility in (
        'private',
        'household',
        'people',
        'buddies',
        'buddies_selected',
        'global'
      )
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index train_plans_household_idx on public.train_plans (household_id, updated_at desc);

create trigger train_plans_set_updated_at
  before update on public.train_plans
  for each row execute function public.set_updated_at();

create table public.train_plan_days (
  plan_id uuid not null references public.train_plans (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  position integer not null default 0 check (position >= 0),
  workout_id uuid references public.workouts (id) on delete set null,
  label text not null default '',
  primary key (plan_id, weekday, position)
);

create index train_plan_days_workout_idx on public.train_plan_days (workout_id)
  where workout_id is not null;

create table public.train_plan_people (
  plan_id uuid not null references public.train_plans (id) on delete cascade,
  person_id uuid not null references public.household_people (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  primary key (plan_id, person_id)
);

create table public.train_plan_buddy_shares (
  plan_id uuid not null references public.train_plans (id) on delete cascade,
  buddy_user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  primary key (plan_id, buddy_user_id)
);

create index train_plan_buddy_shares_buddy_idx
  on public.train_plan_buddy_shares (buddy_user_id);

create or replace function public.train_plan_person_guard()
returns trigger
language plpgsql
as $$
declare
  v_household uuid;
  v_person_household uuid;
begin
  select household_id into v_household from public.train_plans where id = new.plan_id;
  select household_id into v_person_household from public.household_people where id = new.person_id;
  if v_household is null
     or v_household is distinct from new.household_id
     or v_person_household is distinct from new.household_id
  then
    raise exception 'Shared person must belong to the plan household';
  end if;
  return new;
end;
$$;

create trigger train_plan_people_guard
  before insert or update on public.train_plan_people
  for each row execute function public.train_plan_person_guard();

create or replace function public.train_plan_buddy_share_guard()
returns trigger
language plpgsql
as $$
declare
  v_household uuid;
  v_owner uuid;
begin
  select household_id, user_id into v_household, v_owner
  from public.train_plans
  where id = new.plan_id;

  if v_household is null or v_household is distinct from new.household_id then
    raise exception 'Buddy share must belong to the plan household';
  end if;

  if v_owner is null or v_owner = new.buddy_user_id then
    raise exception 'Invalid buddy share target';
  end if;

  if not public.are_train_buddies(v_owner, new.buddy_user_id) then
    raise exception 'Buddy share requires an accepted train buddy connection';
  end if;

  return new;
end;
$$;

create trigger train_plan_buddy_shares_guard
  before insert or update on public.train_plan_buddy_shares
  for each row execute function public.train_plan_buddy_share_guard();

create or replace function public.train_plan_day_guard()
returns trigger
language plpgsql
as $$
declare
  v_plan_household uuid;
  v_workout_household uuid;
begin
  select household_id into v_plan_household from public.train_plans where id = new.plan_id;
  if v_plan_household is null then
    raise exception 'Plan not found';
  end if;

  if new.workout_id is not null then
    select household_id into v_workout_household from public.workouts where id = new.workout_id;
    if v_workout_household is distinct from v_plan_household then
      raise exception 'Plan day workout must belong to the same household';
    end if;
  end if;

  return new;
end;
$$;

create trigger train_plan_days_guard
  before insert or update on public.train_plan_days
  for each row execute function public.train_plan_day_guard();

-- ---------------------------------------------------------------------------
-- User prefs: default visibility + family plan share
-- ---------------------------------------------------------------------------

alter table public.user_train_prefs
  add column if not exists default_workout_visibility text not null default 'private',
  add column if not exists family_plan_share text not null default 'off';

alter table public.user_train_prefs
  drop constraint if exists user_train_prefs_default_visibility_check;
alter table public.user_train_prefs
  add constraint user_train_prefs_default_visibility_check
  check (
    default_workout_visibility in (
      'private',
      'household',
      'people',
      'buddies',
      'buddies_selected',
      'global'
    )
  );

alter table public.user_train_prefs
  drop constraint if exists user_train_prefs_family_plan_share_check;
alter table public.user_train_prefs
  add constraint user_train_prefs_family_plan_share_check
  check (family_plan_share in ('off', 'plan', 'plan_activity'));

create or replace function public.user_train_prefs_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.household_role;
begin
  if new.default_workout_visibility = 'global' and not public.is_approved_creator() then
    raise exception 'Only verified creators can default to Everyone';
  end if;

  -- Children may share plan outline with family, not activity/weights.
  if new.family_plan_share = 'plan_activity' then
    select m.role into v_role
    from public.household_members m
    where m.user_id = new.user_id
    order by case m.role
      when 'owner' then 1
      when 'admin' then 2
      when 'adult' then 3
      when 'teen' then 4
      else 5
    end
    limit 1;

    if v_role is not distinct from 'child' then
      raise exception 'Children cannot share training activity with family';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists user_train_prefs_guard on public.user_train_prefs;
create trigger user_train_prefs_guard
  before insert or update on public.user_train_prefs
  for each row execute function public.user_train_prefs_guard();

-- ---------------------------------------------------------------------------
-- Share helpers
-- ---------------------------------------------------------------------------

create or replace function public.workout_buddy_shared_with_me(_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workout_buddy_shares s
    where s.workout_id = _workout_id
      and s.buddy_user_id = auth.uid()
  );
$$;

create or replace function public.train_plan_shared_with_me(_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.train_plan_people pp
    join public.household_people hp on hp.id = pp.person_id
    where pp.plan_id = _plan_id
      and hp.user_id = auth.uid()
  );
$$;

create or replace function public.train_plan_buddy_shared_with_me(_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.train_plan_buddy_shares s
    where s.plan_id = _plan_id
      and s.buddy_user_id = auth.uid()
  );
$$;

create or replace function public.workout_visibility_ok(_visibility text)
returns boolean
language sql
immutable
as $$
  select _visibility in (
    'private',
    'household',
    'people',
    'buddies',
    'buddies_selected',
    'global'
  );
$$;

-- ---------------------------------------------------------------------------
-- can_view_workout / can_edit_workout (buddy-aware; keep household people)
-- ---------------------------------------------------------------------------

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
      and (
        w.created_by is not distinct from auth.uid()
        or (
          w.visibility = 'global'
          and auth.uid() is not null
        )
        or public.can_view_shared(
          w.household_id,
          w.created_by,
          case
            when w.visibility in ('buddies', 'buddies_selected', 'global') then 'private'
            else w.visibility
          end,
          public.workout_shared_with_me(w.id)
        )
        or (
          w.visibility = 'buddies'
          and w.created_by is not null
          and public.buddy_can(w.created_by, auth.uid(), 'can_view_workouts')
        )
        or (
          w.visibility = 'buddies_selected'
          and w.created_by is not null
          and public.workout_buddy_shared_with_me(w.id)
          and public.buddy_can(w.created_by, auth.uid(), 'can_view_workouts')
        )
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
      and (
        public.can_edit_shared(
          w.household_id,
          w.created_by,
          case
            when w.visibility in ('buddies', 'buddies_selected', 'global') then 'private'
            else w.visibility
          end,
          public.workout_shared_with_me(w.id),
          false
        )
        or (
          w.created_by is not null
          and w.visibility in ('buddies', 'buddies_selected')
          and (
            (w.visibility = 'buddies' and public.buddy_can(w.created_by, auth.uid(), 'can_coedit_shared'))
            or (
              w.visibility = 'buddies_selected'
              and public.workout_buddy_shared_with_me(w.id)
              and public.buddy_can(w.created_by, auth.uid(), 'can_coedit_shared')
            )
          )
        )
      )
  );
$$;

create or replace function public.can_view_train_plan(_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.train_plans p
    where p.id = _plan_id
      and (
        p.user_id is not distinct from auth.uid()
        or (
          p.visibility = 'global'
          and auth.uid() is not null
        )
        or public.can_view_shared(
          p.household_id,
          p.user_id,
          case
            when p.visibility in ('buddies', 'buddies_selected', 'global') then 'private'
            else p.visibility
          end,
          public.train_plan_shared_with_me(p.id)
        )
        or (
          p.visibility = 'buddies'
          and public.buddy_can(p.user_id, auth.uid(), 'can_view_plan')
        )
        or (
          p.visibility = 'buddies_selected'
          and public.train_plan_buddy_shared_with_me(p.id)
          and public.buddy_can(p.user_id, auth.uid(), 'can_view_plan')
        )
        or (
          -- Family opt-in: household members see plan when owner enabled family share
          public.is_household_member(p.household_id)
          and exists (
            select 1
            from public.user_train_prefs prefs
            where prefs.user_id = p.user_id
              and prefs.family_plan_share in ('plan', 'plan_activity')
          )
        )
      )
  );
$$;

create or replace function public.can_edit_train_plan(_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.train_plans p
    where p.id = _plan_id
      and (
        public.can_edit_shared(
          p.household_id,
          p.user_id,
          case
            when p.visibility in ('buddies', 'buddies_selected', 'global') then 'private'
            else p.visibility
          end,
          public.train_plan_shared_with_me(p.id),
          false
        )
        or (
          p.visibility in ('buddies', 'buddies_selected')
          and (
            (p.visibility = 'buddies' and public.buddy_can(p.user_id, auth.uid(), 'can_coedit_shared'))
            or (
              p.visibility = 'buddies_selected'
              and public.train_plan_buddy_shared_with_me(p.id)
              and public.buddy_can(p.user_id, auth.uid(), 'can_coedit_shared')
            )
          )
        )
      )
  );
$$;

-- Sessions / sets / PRs: owner only unless explicitly permitted.
create or replace function public.can_view_session(_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workout_sessions s
    where s.id = _session_id
      and (
        s.user_id is not distinct from auth.uid()
        or public.buddy_can(s.user_id, auth.uid(), 'can_view_sessions')
        or (
          public.is_household_member(s.household_id)
          and exists (
            select 1
            from public.user_train_prefs prefs
            where prefs.user_id = s.user_id
              and prefs.family_plan_share = 'plan_activity'
          )
          and public.household_role_of(s.household_id) is distinct from 'child'
        )
      )
  );
$$;

create or replace function public.can_view_exercise_records(_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _owner is not distinct from auth.uid()
    or public.buddy_can(_owner, auth.uid(), 'can_view_prs');
$$;

-- Family overview (weights omitted unless viewer may see sessions and owner shared activity).
create or replace function public.family_train_overview(_household_id uuid)
returns table (
  user_id uuid,
  display_name text,
  family_plan_share text,
  plan_id uuid,
  plan_name text,
  today_workout_id uuid,
  today_workout_name text,
  recent_completions jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dow smallint;
  v_show_weights boolean;
begin
  if v_uid is null or not public.is_household_member(_household_id) then
    return;
  end if;

  v_dow := extract(dow from (timezone('utc', now())))::smallint;
  v_show_weights := public.household_role_of(_household_id) is distinct from 'child'
    and public.household_role_of(_household_id) is distinct from 'teen';

  return query
  select
    m.user_id,
    coalesce(nullif(trim(pr.display_name), ''), nullif(pr.username::text, ''), 'Member') as display_name,
    coalesce(prefs.family_plan_share, 'off') as family_plan_share,
    p.id as plan_id,
    p.name as plan_name,
    tw.id as today_workout_id,
    tw.name as today_workout_name,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'session_id', s.id,
          'name', s.name,
          'finished_at', s.finished_at,
          'sets', case
            when coalesce(prefs.family_plan_share, 'off') = 'plan_activity'
              and v_show_weights
              and public.can_view_session(s.id)
            then (
              select coalesce(jsonb_agg(jsonb_build_object(
                'exercise_name', st.exercise_name,
                'set_index', st.set_index,
                'reps', st.reps,
                'weight', st.weight,
                'done', st.done
              ) order by st.position, st.set_index), '[]'::jsonb)
              from public.workout_sets st
              where st.session_id = s.id
            )
            when coalesce(prefs.family_plan_share, 'off') = 'plan_activity'
            then (
              select coalesce(jsonb_agg(jsonb_build_object(
                'exercise_name', st.exercise_name,
                'set_index', st.set_index,
                'reps', st.reps,
                'done', st.done
              ) order by st.position, st.set_index), '[]'::jsonb)
              from public.workout_sets st
              where st.session_id = s.id
            )
            else '[]'::jsonb
          end
        )
        order by s.finished_at desc
      )
      from (
        select s2.*
        from public.workout_sessions s2
        where s2.user_id = m.user_id
          and s2.household_id = _household_id
          and s2.finished_at is not null
          and coalesce(prefs.family_plan_share, 'off') = 'plan_activity'
        order by s2.finished_at desc
        limit 5
      ) s
    ), '[]'::jsonb) as recent_completions
  from public.household_members m
  join public.profiles pr on pr.id = m.user_id
  left join public.user_train_prefs prefs on prefs.user_id = m.user_id
  left join public.train_plans p on p.user_id = m.user_id and p.household_id = _household_id
  left join lateral (
    select w.id, w.name
    from public.train_plan_days d
    join public.workouts w on w.id = d.workout_id
    where d.plan_id = p.id
      and d.weekday = v_dow
    order by d.position
    limit 1
  ) tw on true
  where m.household_id = _household_id
    and (
      m.user_id = v_uid
      or coalesce(prefs.family_plan_share, 'off') in ('plan', 'plan_activity')
    )
  order by display_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table public.workout_buddy_shares to authenticated;
grant select, insert, update, delete on table public.train_plans to authenticated;
grant select, insert, update, delete on table public.train_plan_days to authenticated;
grant select, insert, update, delete on table public.train_plan_people to authenticated;
grant select, insert, update, delete on table public.train_plan_buddy_shares to authenticated;

revoke all on function public.workout_buddy_shared_with_me(uuid) from public;
revoke all on function public.train_plan_shared_with_me(uuid) from public;
revoke all on function public.train_plan_buddy_shared_with_me(uuid) from public;
revoke all on function public.can_view_workout(uuid) from public;
revoke all on function public.can_edit_workout(uuid) from public;
revoke all on function public.can_view_train_plan(uuid) from public;
revoke all on function public.can_edit_train_plan(uuid) from public;
revoke all on function public.can_view_session(uuid) from public;
revoke all on function public.can_view_exercise_records(uuid) from public;
revoke all on function public.family_train_overview(uuid) from public;

grant execute on function public.workout_buddy_shared_with_me(uuid) to authenticated;
grant execute on function public.train_plan_shared_with_me(uuid) to authenticated;
grant execute on function public.train_plan_buddy_shared_with_me(uuid) to authenticated;
grant execute on function public.can_view_workout(uuid) to authenticated;
grant execute on function public.can_edit_workout(uuid) to authenticated;
grant execute on function public.can_view_train_plan(uuid) to authenticated;
grant execute on function public.can_edit_train_plan(uuid) to authenticated;
grant execute on function public.can_view_session(uuid) to authenticated;
grant execute on function public.can_view_exercise_records(uuid) to authenticated;
grant execute on function public.family_train_overview(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.workout_buddy_shares enable row level security;
alter table public.train_plans enable row level security;
alter table public.train_plan_days enable row level security;
alter table public.train_plan_people enable row level security;
alter table public.train_plan_buddy_shares enable row level security;

drop policy if exists workouts_select on public.workouts;
create policy workouts_select on public.workouts
  for select to authenticated
  using (public.can_view_workout(id));

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
      or (visibility = 'global' and public.is_approved_creator())
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
      or (visibility = 'global' and public.is_approved_creator())
    )
  );

create policy workout_buddy_shares_select on public.workout_buddy_shares
  for select to authenticated
  using (public.can_view_workout(workout_id));

create policy workout_buddy_shares_insert on public.workout_buddy_shares
  for insert to authenticated
  with check (public.can_edit_workout(workout_id));

create policy workout_buddy_shares_delete on public.workout_buddy_shares
  for delete to authenticated
  using (public.can_edit_workout(workout_id));

create policy train_plans_select on public.train_plans
  for select to authenticated
  using (public.can_view_train_plan(id));

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
      or (visibility = 'global' and public.is_approved_creator())
    )
  );

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
      or (visibility = 'global' and public.is_approved_creator())
    )
  );

create policy train_plans_delete on public.train_plans
  for delete to authenticated
  using (public.can_edit_train_plan(id));

create policy train_plan_days_select on public.train_plan_days
  for select to authenticated
  using (public.can_view_train_plan(plan_id));

create policy train_plan_days_mutate on public.train_plan_days
  for all to authenticated
  using (public.can_edit_train_plan(plan_id))
  with check (public.can_edit_train_plan(plan_id));

create policy train_plan_people_select on public.train_plan_people
  for select to authenticated
  using (public.can_view_train_plan(plan_id));

create policy train_plan_people_mutate on public.train_plan_people
  for all to authenticated
  using (public.can_edit_train_plan(plan_id))
  with check (public.can_edit_train_plan(plan_id));

create policy train_plan_buddy_shares_select on public.train_plan_buddy_shares
  for select to authenticated
  using (public.can_view_train_plan(plan_id));

create policy train_plan_buddy_shares_mutate on public.train_plan_buddy_shares
  for all to authenticated
  using (public.can_edit_train_plan(plan_id))
  with check (public.can_edit_train_plan(plan_id));

drop policy if exists workout_sessions_all on public.workout_sessions;
create policy workout_sessions_select on public.workout_sessions
  for select to authenticated
  using (public.can_view_session(id));

create policy workout_sessions_insert on public.workout_sessions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create policy workout_sessions_update on public.workout_sessions
  for update to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id))
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create policy workout_sessions_delete on public.workout_sessions
  for delete to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id));

drop policy if exists workout_sets_all on public.workout_sets;
create policy workout_sets_select on public.workout_sets
  for select to authenticated
  using (public.can_view_session(session_id));

create policy workout_sets_insert on public.workout_sets
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create policy workout_sets_update on public.workout_sets
  for update to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id))
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create policy workout_sets_delete on public.workout_sets
  for delete to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id));

drop policy if exists exercise_records_all on public.exercise_records;
create policy exercise_records_select on public.exercise_records
  for select to authenticated
  using (public.can_view_exercise_records(user_id));

create policy exercise_records_insert on public.exercise_records
  for insert to authenticated
  with check (user_id = auth.uid());

create policy exercise_records_update on public.exercise_records
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy exercise_records_delete on public.exercise_records
  for delete to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
