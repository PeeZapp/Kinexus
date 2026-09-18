-- Drop the Wikibooks Cookbook bulk import. Original seed catalog (catalog_key seed_*) stays.
-- Meal slots that pointed at these recipes keep the denormalized name (recipe_id SET NULL).
-- Favourites for these recipes cascade-delete.

delete from public.recipes
where household_id is null
  and catalog_key like 'wiki_%';
