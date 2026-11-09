-- Reliable private workout create (security definer).
-- Plan Start / Build were failing on workouts RLS the same way training_plans did.

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

revoke all on function public.create_private_workout(uuid, text, integer) from public;
grant execute on function public.create_private_workout(uuid, text, integer) to authenticated;

-- Align workouts insert with household membership (not only can_create_shared).
drop policy if exists workouts_insert on public.workouts;
create policy workouts_insert on public.workouts
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_household_member(household_id)
    and (
      visibility in ('private', 'household', 'people', 'buddies', 'buddies_selected')
      or (visibility = 'global' and public.is_approved_creator())
    )
  );

drop policy if exists workouts_select on public.workouts;
create policy workouts_select on public.workouts
  for select to authenticated
  using (
    created_by is not distinct from auth.uid()
    or public.can_view_workout(id)
  );

grant select, insert, update, delete on table public.workouts to authenticated;

notify pgrst, 'reload schema';
