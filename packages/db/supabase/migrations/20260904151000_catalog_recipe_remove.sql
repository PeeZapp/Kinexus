-- Catalog editors can hide a bad/duplicate catalog recipe from the library.
-- Soft-delete so it can be restored; meal plan slots keep the recipe_id.

alter table public.recipes add column if not exists removed boolean not null default false;

create or replace function public.review_catalog_recipe(
  p_recipe_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_catalog_editor() then
    raise exception 'Not a catalog editor';
  end if;
  if p_action not in ('remove', 'restore') then
    raise exception 'Unknown review action';
  end if;

  if not exists (
    select 1 from public.recipes
    where id = p_recipe_id and household_id is null
  ) then
    raise exception 'Catalog recipe not found';
  end if;

  if p_action = 'remove' then
    update public.recipes
    set removed = true
    where id = p_recipe_id;
    return;
  end if;

  update public.recipes
  set removed = false
  where id = p_recipe_id;
end;
$$;

grant execute on function public.review_catalog_recipe(uuid, text) to authenticated;
