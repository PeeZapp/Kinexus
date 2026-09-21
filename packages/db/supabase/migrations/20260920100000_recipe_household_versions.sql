-- Households can fork catalog (or other) recipes and optionally replace the source
-- in their own library. Catalog rows stay immutable under existing RLS.

alter table public.recipes
  add column sourced_from_recipe_id uuid references public.recipes (id) on delete set null,
  add column replaces_source boolean not null default false;

alter table public.recipes
  add constraint recipes_source_lineage check (
    sourced_from_recipe_id is null or household_id is not null
  );

alter table public.recipes
  add constraint recipes_replaces_source check (
    replaces_source = false or sourced_from_recipe_id is not null
  );

create index recipes_sourced_from_idx
  on public.recipes (sourced_from_recipe_id)
  where sourced_from_recipe_id is not null;

create unique index recipes_household_replaces_source_uidx
  on public.recipes (household_id, sourced_from_recipe_id)
  where household_id is not null
    and sourced_from_recipe_id is not null
    and replaces_source = true;
