-- Train plan generate (7a): weekly generated training_plans + days + prefs blob.
-- Distinct from train_plans / train_plan_days (fixed weekly split assignment from #6).

-- ---------------------------------------------------------------------------
-- Prefs
-- ---------------------------------------------------------------------------

alter table public.user_train_prefs
  add column if not exists generate_prefs jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'Training plan',
  week_start date not null,
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
  audience_person_ids uuid[] not null default '{}'::uuid[],
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index training_plans_household_week_idx
  on public.training_plans (household_id, week_start);

create table public.training_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  day text not null
    check (
      day in (
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday'
      )
    ),
  position integer not null default 0 check (position >= 0),
  workout_id uuid references public.workouts (id) on delete set null,
  generated_spec jsonb,
  rest_day boolean not null default false,
  scheduled_time time,
  duration_min integer check (duration_min is null or duration_min between 1 and 300),
  focus text[] not null default '{}'::text[],
  status text not null default 'planned'
    check (status in ('planned', 'done', 'skipped')),
  session_id uuid references public.workout_sessions (id) on delete set null,
  unique (plan_id, day, position)
);

create index training_plan_days_plan_idx on public.training_plan_days (plan_id);

create table public.training_plan_buddy_shares (
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  buddy_user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  primary key (plan_id, buddy_user_id)
);

create index training_plan_buddy_shares_buddy_idx
  on public.training_plan_buddy_shares (buddy_user_id);

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

create or replace function public.training_plan_audience_shared_with_me(_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.training_plans p
    join public.household_people hp on hp.id = any (p.audience_person_ids)
    where p.id = _plan_id
      and hp.user_id = auth.uid()
  );
$$;

create or replace function public.training_plan_buddy_shared_with_me(_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.training_plan_buddy_shares s
    where s.plan_id = _plan_id
      and s.buddy_user_id = auth.uid()
  );
$$;

create or replace function public.training_plan_buddy_share_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_household uuid;
  v_owner uuid;
begin
  select household_id, owner_id into v_household, v_owner
  from public.training_plans
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

create trigger training_plan_buddy_shares_guard
  before insert or update on public.training_plan_buddy_shares
  for each row execute function public.training_plan_buddy_share_guard();

create or replace function public.training_plan_day_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_plan_household uuid;
  v_workout_household uuid;
begin
  select household_id into v_plan_household from public.training_plans where id = new.plan_id;
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

create trigger training_plan_days_guard
  before insert or update on public.training_plan_days
  for each row execute function public.training_plan_day_guard();

-- ---------------------------------------------------------------------------
-- Access helpers (mirror workouts / train_plans + #6 buddy rules)
-- ---------------------------------------------------------------------------

create or replace function public.can_view_training_plan(_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.training_plans p
    where p.id = _plan_id
      and (
        p.owner_id is not distinct from auth.uid()
        or (
          p.visibility = 'global'
          and auth.uid() is not null
        )
        or public.can_view_shared(
          p.household_id,
          p.owner_id,
          case
            when p.visibility in ('buddies', 'buddies_selected', 'global') then 'private'
            else p.visibility
          end,
          public.training_plan_audience_shared_with_me(p.id)
        )
        or (
          p.visibility = 'buddies'
          and public.buddy_can(p.owner_id, auth.uid(), 'can_view_plan')
        )
        or (
          p.visibility = 'buddies_selected'
          and public.training_plan_buddy_shared_with_me(p.id)
          and public.buddy_can(p.owner_id, auth.uid(), 'can_view_plan')
        )
        or (
          public.is_household_member(p.household_id)
          and exists (
            select 1
            from public.user_train_prefs prefs
            where prefs.user_id = p.owner_id
              and prefs.family_plan_share in ('plan', 'plan_activity')
          )
        )
      )
  );
$$;

create or replace function public.can_edit_training_plan(_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.training_plans p
    where p.id = _plan_id
      and (
        public.can_edit_shared(
          p.household_id,
          p.owner_id,
          case
            when p.visibility in ('buddies', 'buddies_selected', 'global') then 'private'
            else p.visibility
          end,
          public.training_plan_audience_shared_with_me(p.id),
          false
        )
        or (
          p.visibility in ('buddies', 'buddies_selected')
          and (
            (p.visibility = 'buddies' and public.buddy_can(p.owner_id, auth.uid(), 'can_coedit_shared'))
            or (
              p.visibility = 'buddies_selected'
              and public.training_plan_buddy_shared_with_me(p.id)
              and public.buddy_can(p.owner_id, auth.uid(), 'can_coedit_shared')
            )
          )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table public.training_plans to authenticated;
grant select, insert, update, delete on table public.training_plan_days to authenticated;
grant select, insert, update, delete on table public.training_plan_buddy_shares to authenticated;

revoke all on function public.training_plan_audience_shared_with_me(uuid) from public;
revoke all on function public.training_plan_buddy_shared_with_me(uuid) from public;
revoke all on function public.can_view_training_plan(uuid) from public;
revoke all on function public.can_edit_training_plan(uuid) from public;

grant execute on function public.training_plan_audience_shared_with_me(uuid) to authenticated;
grant execute on function public.training_plan_buddy_shared_with_me(uuid) to authenticated;
grant execute on function public.can_view_training_plan(uuid) to authenticated;
grant execute on function public.can_edit_training_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.training_plans enable row level security;
alter table public.training_plan_days enable row level security;
alter table public.training_plan_buddy_shares enable row level security;

create policy training_plans_select on public.training_plans
  for select to authenticated
  using (public.can_view_training_plan(id));

create policy training_plans_insert on public.training_plans
  for insert to authenticated
  with check (
    public.can_create_shared(household_id)
    and owner_id = auth.uid()
    and (
      visibility = 'household'
      or visibility = 'people'
      or visibility = 'buddies'
      or visibility = 'buddies_selected'
      or (visibility = 'private' and owner_id = auth.uid())
      or (visibility = 'global' and public.is_approved_creator())
    )
  );

create policy training_plans_update on public.training_plans
  for update to authenticated
  using (public.can_edit_training_plan(id))
  with check (
    public.can_create_shared(household_id)
    and (
      visibility = 'household'
      or visibility = 'people'
      or visibility = 'buddies'
      or visibility = 'buddies_selected'
      or (visibility = 'private' and owner_id = auth.uid())
      or (visibility = 'global' and public.is_approved_creator())
    )
  );

create policy training_plans_delete on public.training_plans
  for delete to authenticated
  using (public.can_edit_training_plan(id));

create policy training_plan_days_select on public.training_plan_days
  for select to authenticated
  using (public.can_view_training_plan(plan_id));

create policy training_plan_days_mutate on public.training_plan_days
  for all to authenticated
  using (public.can_edit_training_plan(plan_id))
  with check (public.can_edit_training_plan(plan_id));

create policy training_plan_buddy_shares_select on public.training_plan_buddy_shares
  for select to authenticated
  using (public.can_view_training_plan(plan_id));

create policy training_plan_buddy_shares_mutate on public.training_plan_buddy_shares
  for all to authenticated
  using (public.can_edit_training_plan(plan_id))
  with check (public.can_edit_training_plan(plan_id));

notify pgrst, 'reload schema';
