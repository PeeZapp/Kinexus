-- Parallel meal slots per day: household (empty audience) plus group/personal audiences.

alter table public.meal_slots
  add column if not exists audience_person_ids uuid[] not null default '{}'::uuid[];

-- Always store audiences sorted so array equality / unique index are stable.
create or replace function public.normalize_meal_slot_audience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.audience_person_ids is null then
    new.audience_person_ids := '{}'::uuid[];
  else
    new.audience_person_ids := (
      select coalesce(array_agg(pid order by pid), '{}'::uuid[])
      from (
        select distinct unnest(new.audience_person_ids) as pid
      ) d
      where pid is not null
    );
  end if;
  return new;
end;
$$;

drop trigger if exists meal_slots_normalize_audience on public.meal_slots;
create trigger meal_slots_normalize_audience
  before insert or update of audience_person_ids on public.meal_slots
  for each row execute function public.normalize_meal_slot_audience();

-- Validate audience people belong to the household.
create or replace function public.enforce_meal_slot_audience_people()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_household uuid;
begin
  if cardinality(new.audience_person_ids) = 0 then
    return new;
  end if;

  foreach v_pid in array new.audience_person_ids loop
    select household_id into v_household
    from public.household_people
    where id = v_pid;
    if v_household is null or v_household <> new.household_id then
      raise exception 'Audience person is not in this household';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists meal_slots_enforce_audience_people on public.meal_slots;
create trigger meal_slots_enforce_audience_people
  before insert or update of audience_person_ids, household_id on public.meal_slots
  for each row execute function public.enforce_meal_slot_audience_people();

-- A person may only appear on one non-hidden meal for the same plan/day/slot.
-- Household (empty audience) and personal/group meals cannot both be active.
create or replace function public.enforce_meal_slot_audience_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_is_household boolean;
begin
  if new.hidden then
    return new;
  end if;

  v_is_household := cardinality(new.audience_person_ids) = 0;

  if v_is_household then
    if exists (
      select 1
      from public.meal_slots s
      where s.meal_plan_id = new.meal_plan_id
        and s.day = new.day
        and s.slot_key = new.slot_key
        and s.id is distinct from new.id
        and not s.hidden
        and cardinality(s.audience_person_ids) > 0
    ) then
      raise exception 'Personal meals already exist for % on this day — remove them before adding a family meal', new.slot_key;
    end if;
    return new;
  end if;

  if exists (
    select 1
    from public.meal_slots s
    where s.meal_plan_id = new.meal_plan_id
      and s.day = new.day
      and s.slot_key = new.slot_key
      and s.id is distinct from new.id
      and not s.hidden
      and cardinality(s.audience_person_ids) = 0
  ) then
    raise exception 'A family % already exists on this day — remove it before adding a personal meal', new.slot_key;
  end if;

  foreach v_pid in array new.audience_person_ids loop
    if exists (
      select 1
      from public.meal_slots s
      where s.meal_plan_id = new.meal_plan_id
        and s.day = new.day
        and s.slot_key = new.slot_key
        and s.id is distinct from new.id
        and not s.hidden
        and v_pid = any (s.audience_person_ids)
    ) then
      raise exception 'That person already has a % on this day', new.slot_key;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists meal_slots_enforce_audience_overlap on public.meal_slots;
create trigger meal_slots_enforce_audience_overlap
  before insert or update of audience_person_ids, hidden, day, slot_key, meal_plan_id on public.meal_slots
  for each row execute function public.enforce_meal_slot_audience_overlap();

alter table public.meal_slots
  drop constraint if exists meal_slots_meal_plan_id_day_slot_key_key;

create unique index if not exists meal_slots_plan_day_slot_audience_uidx
  on public.meal_slots (meal_plan_id, day, slot_key, audience_person_ids);

-- Kids / restricted members cannot change audience (create personal meals for themselves).
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
    array['owner', 'admin', 'adult']::public.household_role[]
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
     or new.slot_key is distinct from old.slot_key
     or new.audience_person_ids is distinct from old.audience_person_ids then
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
