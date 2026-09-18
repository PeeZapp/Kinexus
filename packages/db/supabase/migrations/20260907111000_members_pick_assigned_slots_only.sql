-- Members may only pick a recipe on a slot assigned to them. Anyone slots are owner/admin only.

create or replace function public.enforce_meal_slot_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_manager boolean;
  v_linked_person uuid;
  v_person_household uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_is_manager := public.has_household_role(
    new.household_id,
    array['owner', 'admin']::public.household_role[]
  );

  if new.assigned_person_id is not null then
    select household_id into v_person_household
    from public.household_people
    where id = new.assigned_person_id;
    if v_person_household is null or v_person_household <> new.household_id then
      raise exception 'Assignee is not in this household';
    end if;
  end if;

  if v_is_manager then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'You can only pick meals on slots assigned to you';
  end if;

  if new.assigned_person_id is distinct from old.assigned_person_id
     or new.hidden is distinct from old.hidden
     or new.day is distinct from old.day
     or new.slot_key is distinct from old.slot_key then
    raise exception 'Only owners and admins can change this slot';
  end if;

  select id into v_linked_person
  from public.household_people
  where household_id = new.household_id
    and user_id = auth.uid()
  limit 1;

  if v_linked_person is null or new.assigned_person_id is distinct from v_linked_person then
    raise exception 'You can only pick meals on slots assigned to you';
  end if;

  if new.recipe_id is null then
    raise exception 'You can only pick a recipe on this slot';
  end if;

  if not exists (
    select 1
    from public.household_person_slot_recipes r
    where r.person_id = v_linked_person
      and r.slot_key = new.slot_key
      and r.recipe_id = new.recipe_id
  ) then
    raise exception 'Recipe is not on the approved list for this meal';
  end if;

  return new;
end;
$$;
