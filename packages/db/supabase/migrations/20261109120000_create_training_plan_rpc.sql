-- Reliable training plan create path (security definer).
-- Direct inserts were still denied by RLS for some sessions; RPC enforces membership then inserts as definer.

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

  if v_visibility not in ('private', 'household', 'people', 'buddies', 'buddies_selected', 'global') then
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

-- Plan owners must always be able to edit their own plan (days, shares).
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

-- Owner short-circuit on SELECT so INSERT…RETURNING can see the new row.
drop policy if exists training_plans_select on public.training_plans;
create policy training_plans_select on public.training_plans
  for select to authenticated
  using (
    owner_id is not distinct from auth.uid()
    or public.can_view_training_plan(id)
  );

notify pgrst, 'reload schema';
