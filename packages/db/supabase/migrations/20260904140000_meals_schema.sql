-- Phase 3: Meals persistence — row-level slots, household RLS, catalog recipes.

create table public.nutrition_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  person_id uuid references public.household_people (id) on delete cascade,
  calories integer not null check (calories > 0),
  protein integer not null check (protein >= 0),
  carbs integer not null check (carbs >= 0),
  fat integer not null check (fat >= 0),
  preset text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index nutrition_goals_household_default_idx
  on public.nutrition_goals (household_id)
  where person_id is null;

create unique index nutrition_goals_household_person_idx
  on public.nutrition_goals (household_id, person_id)
  where person_id is not null;

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  catalog_key text unique,
  name text not null check (char_length(trim(name)) > 0),
  emoji text,
  cuisine text,
  cook_time integer,
  servings integer,
  protein numeric,
  calories numeric,
  carbs numeric,
  fat numeric,
  vegetarian boolean,
  ingredients jsonb not null default '[]'::jsonb,
  method jsonb not null default '[]'::jsonb,
  chef_tip text,
  notes text,
  meal_slots text[] not null default '{}',
  is_component boolean not null default false,
  excluded_from_auto boolean not null default false,
  is_public boolean not null default false,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_catalog_or_household check (
    (household_id is null and is_public = true and catalog_key is not null)
    or (household_id is not null and catalog_key is null)
  )
);

create index recipes_household_id_idx on public.recipes (household_id);
create index recipes_catalog_public_idx on public.recipes (is_public) where household_id is null;

create table public.recipe_favourites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start date not null,
  active_slots text[] not null default array['breakfast', 'lunch', 'dinner']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, week_start)
);

create table public.meal_slots (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  day text not null check (
    day in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
  ),
  slot_key text not null check (
    slot_key in (
      'breakfast', 'morning_snack', 'lunch', 'afternoon_snack',
      'dinner', 'night_snack', 'dessert'
    )
  ),
  recipe_id uuid references public.recipes (id) on delete set null,
  recipe_name text,
  emoji text,
  protein numeric,
  calories numeric,
  carbs numeric,
  fat numeric,
  cook_time integer,
  hidden boolean not null default false,
  eaten_by jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meal_plan_id, day, slot_key)
);

create index meal_slots_household_id_idx on public.meal_slots (household_id);
create index meal_slots_plan_id_idx on public.meal_slots (meal_plan_id);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start date not null,
  name text not null,
  amount text,
  category text,
  checked boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shopping_items_household_week_idx
  on public.shopping_items (household_id, week_start);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create trigger nutrition_goals_set_updated_at
  before update on public.nutrition_goals
  for each row execute function public.set_updated_at();

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

create trigger meal_plans_set_updated_at
  before update on public.meal_plans
  for each row execute function public.set_updated_at();

create trigger meal_slots_set_updated_at
  before update on public.meal_slots
  for each row execute function public.set_updated_at();

create trigger shopping_items_set_updated_at
  before update on public.shopping_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.get_or_create_meal_plan(
  p_household_id uuid,
  p_week_start date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Not a member of this household';
  end if;

  select id into v_id
  from public.meal_plans
  where household_id = p_household_id
    and week_start = p_week_start;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.meal_plans (household_id, week_start)
  values (p_household_id, p_week_start)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.ensure_household_nutrition_goals(p_household_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Not a member of this household';
  end if;

  select id into v_id
  from public.nutrition_goals
  where household_id = p_household_id
    and person_id is null;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.nutrition_goals (household_id, calories, protein, carbs, fat, preset)
  values (p_household_id, 2000, 120, 250, 65, 'maintenance')
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.get_or_create_meal_plan(uuid, date) from public;
revoke all on function public.ensure_household_nutrition_goals(uuid) from public;
grant execute on function public.get_or_create_meal_plan(uuid, date) to authenticated;
grant execute on function public.ensure_household_nutrition_goals(uuid) to authenticated;

grant select, insert, update, delete on table public.nutrition_goals to authenticated;
grant select, insert, update, delete on table public.recipes to authenticated;
grant select, insert, delete on table public.recipe_favourites to authenticated;
grant select, insert, update, delete on table public.meal_plans to authenticated;
grant select, insert, update, delete on table public.meal_slots to authenticated;
grant select, insert, update, delete on table public.shopping_items to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.nutrition_goals enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_favourites enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_slots enable row level security;
alter table public.shopping_items enable row level security;

create policy nutrition_goals_all on public.nutrition_goals
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy recipes_select on public.recipes
  for select to authenticated
  using (household_id is null or public.is_household_member(household_id));

create policy recipes_insert on public.recipes
  for insert to authenticated
  with check (household_id is not null and public.is_household_member(household_id));

create policy recipes_update on public.recipes
  for update to authenticated
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

create policy recipes_delete on public.recipes
  for delete to authenticated
  using (household_id is not null and public.is_household_member(household_id));

create policy recipe_favourites_all on public.recipe_favourites
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy meal_plans_all on public.meal_plans
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy meal_slots_all on public.meal_slots
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy shopping_items_all on public.shopping_items
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Realtime (row-level slot + shopping sync)
-- ---------------------------------------------------------------------------

alter table public.meal_slots replica identity full;
alter table public.shopping_items replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.meal_slots;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.shopping_items;
  exception
    when duplicate_object then null;
  end;
end;
$$;
