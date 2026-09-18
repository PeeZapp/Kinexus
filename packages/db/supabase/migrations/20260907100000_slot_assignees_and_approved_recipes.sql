-- Assign meal slots to household people, and curate per-person per-slot approved recipes.

alter table public.meal_slots
  add column assigned_person_id uuid references public.household_people (id) on delete set null;

create index meal_slots_assigned_person_id_idx
  on public.meal_slots (assigned_person_id)
  where assigned_person_id is not null;

create unique index household_people_household_user_idx
  on public.household_people (household_id, user_id)
  where user_id is not null;

create table public.household_person_slot_recipes (
  household_id uuid not null references public.households (id) on delete cascade,
  person_id uuid not null references public.household_people (id) on delete cascade,
  slot_key text not null check (
    slot_key in (
      'breakfast', 'morning_snack', 'lunch', 'afternoon_snack',
      'dinner', 'night_snack', 'dessert'
    )
  ),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  primary key (person_id, slot_key, recipe_id)
);

create index household_person_slot_recipes_household_idx
  on public.household_person_slot_recipes (household_id);

create index household_person_slot_recipes_slot_idx
  on public.household_person_slot_recipes (person_id, slot_key);

-- ---------------------------------------------------------------------------
-- Link a planning person to a signed-in member
-- ---------------------------------------------------------------------------

create or replace function public.enforce_household_person_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    if not exists (
      select 1
      from public.household_members m
      where m.household_id = new.household_id
        and m.user_id = new.user_id
    ) then
      raise exception 'Linked account must be a household member';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    if not public.has_household_role(new.household_id, array['owner', 'admin']::public.household_role[]) then
      raise exception 'Only owners and admins can link a login to a person';
    end if;
  end if;

  if tg_op = 'INSERT' and new.user_id is not null then
    if not public.has_household_role(new.household_id, array['owner', 'admin']::public.household_role[]) then
      raise exception 'Only owners and admins can link a login to a person';
    end if;
  end if;

  return new;
end;
$$;

create trigger household_people_enforce_link
  before insert or update on public.household_people
  for each row execute function public.enforce_household_person_link();

-- ---------------------------------------------------------------------------
-- Slot assignment + kid picker rules
-- ---------------------------------------------------------------------------

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

  -- Members cannot plan the week. They may only set a recipe on a slot assigned to them.
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

create trigger meal_slots_enforce_permissions
  before insert or update on public.meal_slots
  for each row execute function public.enforce_meal_slot_permissions();

-- ---------------------------------------------------------------------------
-- Approved-list row must belong to the same household as the person
-- ---------------------------------------------------------------------------

create or replace function public.enforce_person_slot_recipe_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_household uuid;
begin
  select household_id into v_person_household
  from public.household_people
  where id = new.person_id;

  if v_person_household is null or v_person_household <> new.household_id then
    raise exception 'Approved recipe person is not in this household';
  end if;

  return new;
end;
$$;

create trigger household_person_slot_recipes_enforce_household
  before insert or update on public.household_person_slot_recipes
  for each row execute function public.enforce_person_slot_recipe_household();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.household_person_slot_recipes enable row level security;

grant select, insert, delete on table public.household_person_slot_recipes to authenticated;

create policy household_person_slot_recipes_select on public.household_person_slot_recipes
  for select to authenticated
  using (public.is_household_member(household_id));

create policy household_person_slot_recipes_insert on public.household_person_slot_recipes
  for insert to authenticated
  with check (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

create policy household_person_slot_recipes_delete on public.household_person_slot_recipes
  for delete to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']::public.household_role[]));

alter table public.household_person_slot_recipes replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.household_person_slot_recipes;
  exception
    when duplicate_object then null;
  end;
end;
$$;
