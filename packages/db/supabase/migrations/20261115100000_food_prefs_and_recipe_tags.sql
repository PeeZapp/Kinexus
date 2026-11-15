-- Food prefs + recipe tagging

-- ---------------------------------------------------------------------------
-- Household-level food preferences
-- ---------------------------------------------------------------------------

create table if not exists public.household_food_prefs (
  household_id uuid primary key references public.households (id) on delete cascade,
  cuisines text[] not null default '{}'::text[],
  allergies text[] not null default '{}'::text[],
  equipment text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on table public.household_food_prefs to authenticated;

alter table public.household_food_prefs enable row level security;

drop policy if exists household_food_prefs_select on public.household_food_prefs;
create policy household_food_prefs_select on public.household_food_prefs
  for select to authenticated
  using (public.is_household_member(household_id));

drop policy if exists household_food_prefs_write on public.household_food_prefs;
create policy household_food_prefs_write on public.household_food_prefs
  for all to authenticated
  using (
    public.has_household_role(household_id, array['owner', 'admin', 'adult']::public.household_role[])
  )
  with check (
    public.has_household_role(household_id, array['owner', 'admin', 'adult']::public.household_role[])
  );

drop trigger if exists household_food_prefs_set_updated_at on public.household_food_prefs;
create trigger household_food_prefs_set_updated_at
  before update on public.household_food_prefs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Recipe tags: cuisines (multi), allergens (contains), dietary (suitable-for), equipment needed
-- ---------------------------------------------------------------------------

alter table public.recipes
  add column if not exists cuisines text[] not null default '{}'::text[],
  add column if not exists allergens text[] not null default '{}'::text[],
  add column if not exists dietary text[] not null default '{}'::text[],
  add column if not exists equipment text[] not null default '{}'::text[];

-- Backfill multi-cuisine from legacy single cuisine.
update public.recipes
set cuisines = array[trim(cuisine)]::text[]
where cuisine is not null
  and trim(cuisine) <> ''
  and (cuisines is null or array_length(cuisines, 1) is null or array_length(cuisines, 1) = 0);

create index if not exists recipes_cuisines_gin_idx on public.recipes using gin (cuisines);
create index if not exists recipes_allergens_gin_idx on public.recipes using gin (allergens);
create index if not exists recipes_dietary_gin_idx on public.recipes using gin (dietary);
create index if not exists recipes_equipment_gin_idx on public.recipes using gin (equipment);

