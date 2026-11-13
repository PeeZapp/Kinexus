-- Add workout/plan visibility "all" = household (family) + all buddies.

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
      'all',
      'global'
    )
  );

alter table public.training_plans drop constraint if exists training_plans_visibility_check;
alter table public.training_plans
  add constraint training_plans_visibility_check
  check (
    visibility in (
      'private',
      'household',
      'people',
      'buddies',
      'buddies_selected',
      'all',
      'global'
    )
  );

alter table public.train_plans drop constraint if exists train_plans_visibility_check;
alter table public.train_plans
  add constraint train_plans_visibility_check
  check (
    visibility in (
      'private',
      'household',
      'people',
      'buddies',
      'buddies_selected',
      'all',
      'global'
    )
  );

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
      'all',
      'global'
    )
  );

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
    'all',
    'global'
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
            when w.visibility = 'all' then 'household'
            else w.visibility
          end,
          public.workout_shared_with_me(w.id)
        )
        or (
          w.visibility in ('buddies', 'all')
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
      and not w.is_system
      and (
        public.can_edit_shared(
          w.household_id,
          w.created_by,
          case
            when w.visibility in ('buddies', 'buddies_selected', 'global') then 'private'
            when w.visibility = 'all' then 'household'
            else w.visibility
          end,
          public.workout_shared_with_me(w.id),
          false
        )
        or (
          w.created_by is not null
          and w.visibility in ('buddies', 'buddies_selected', 'all')
          and (
            (w.visibility in ('buddies', 'all') and public.buddy_can(w.created_by, auth.uid(), 'can_coedit_shared'))
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
            when p.visibility = 'all' then 'household'
            else p.visibility
          end,
          public.training_plan_audience_shared_with_me(p.id)
        )
        or (
          p.visibility in ('buddies', 'all')
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
        p.owner_id is not distinct from auth.uid()
        or public.can_edit_shared(
          p.household_id,
          p.owner_id,
          case
            when p.visibility in ('buddies', 'buddies_selected', 'global') then 'private'
            when p.visibility = 'all' then 'household'
            else p.visibility
          end,
          public.training_plan_audience_shared_with_me(p.id),
          false
        )
        or (
          p.visibility in ('buddies', 'buddies_selected', 'all')
          and (
            (p.visibility in ('buddies', 'all') and public.buddy_can(p.owner_id, auth.uid(), 'can_coedit_shared'))
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

drop policy if exists training_plans_insert on public.training_plans;
create policy training_plans_insert on public.training_plans
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and public.is_household_member(household_id)
    and (
      visibility in ('private', 'household', 'people', 'buddies', 'buddies_selected', 'all')
      or (visibility = 'global' and public.is_approved_creator())
    )
  );

drop policy if exists training_plans_update on public.training_plans;
create policy training_plans_update on public.training_plans
  for update to authenticated
  using (public.can_edit_training_plan(id))
  with check (
    public.is_household_member(household_id)
    and (
      visibility in ('private', 'household', 'people', 'buddies', 'buddies_selected', 'all')
      or (visibility = 'global' and public.is_approved_creator())
    )
  );

drop policy if exists workouts_insert on public.workouts;
create policy workouts_insert on public.workouts
  for insert to authenticated
  with check (
    not is_system
    and created_by = auth.uid()
    and public.is_household_member(household_id)
    and (
      visibility in ('private', 'household', 'people', 'buddies', 'buddies_selected', 'all')
      or (visibility = 'global' and public.is_approved_creator())
    )
  );

drop policy if exists workouts_update on public.workouts;
create policy workouts_update on public.workouts
  for update to authenticated
  using (not is_system and public.can_edit_workout(id))
  with check (
    not is_system
    and public.can_create_shared(household_id)
    and (
      visibility = 'household'
      or visibility = 'people'
      or visibility = 'buddies'
      or visibility = 'buddies_selected'
      or visibility = 'all'
      or (visibility = 'private' and created_by = auth.uid())
      or (
        visibility = 'global'
        and created_by = auth.uid()
        and public.is_approved_creator()
      )
    )
  );

create or replace function public.create_training_plan(
  p_household_id uuid,
  p_week_start date,
  p_name text default 'Training plan',
  p_visibility text default 'private',
  p_audience_person_ids uuid[] default '{}'::uuid[],
  p_prefs jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_visibility text := coalesce(nullif(trim(p_visibility), ''), 'private');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_household_id is null or p_week_start is null then
    raise exception 'household_id and week_start are required';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Not a member of this household';
  end if;

  if v_visibility not in ('private', 'household', 'people', 'buddies', 'buddies_selected', 'all', 'global') then
    raise exception 'Invalid visibility';
  end if;

  if v_visibility = 'global' and not public.is_approved_creator() then
    raise exception 'Only verified creators can publish to Everyone';
  end if;

  insert into public.training_plans (
    household_id,
    owner_id,
    name,
    week_start,
    visibility,
    audience_person_ids,
    prefs
  ) values (
    p_household_id,
    v_uid,
    left(coalesce(nullif(trim(p_name), ''), 'Training plan'), 120),
    p_week_start,
    v_visibility,
    coalesce(p_audience_person_ids, '{}'::uuid[]),
    coalesce(p_prefs, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_training_plan(uuid, date, text, text, uuid[], jsonb) from public;
grant execute on function public.create_training_plan(uuid, date, text, text, uuid[], jsonb) to authenticated;

notify pgrst, 'reload schema';
