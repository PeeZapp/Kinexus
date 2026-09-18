-- Households can hide any recipe (catalog or their own) from plans and recommendations.
-- The recipe stays in the library so it can be restored.

create table public.household_hidden_recipes (
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (household_id, recipe_id)
);

create index household_hidden_recipes_recipe_id_idx
  on public.household_hidden_recipes (recipe_id);

insert into public.household_hidden_recipes (household_id, recipe_id)
select household_id, id
from public.recipes
where household_id is not null
  and excluded_from_auto = true
on conflict do nothing;

grant select, insert, delete on table public.household_hidden_recipes to authenticated;

alter table public.household_hidden_recipes enable row level security;

create policy household_hidden_recipes_all on public.household_hidden_recipes
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
