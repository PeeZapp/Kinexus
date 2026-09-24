-- Remove estimated TheMealDB stand-in photos from seed catalog recipes.
-- Those images were approximate matches pulled from the internet, not photos
-- included with the recipes. Seed recipes already have emojis for display.
-- Authentic TheMealDB catalog rows (catalog_key like 'mealdb_%') keep their images.

update public.recipes
set image_url = null,
    image_flagged = false
where household_id is null
  and catalog_key like 'seed_%'
  and image_url is not null;

-- Household forks that still carry the same estimated stand-in URLs.
update public.recipes as hh
set image_url = null
from public.recipes as src
where hh.sourced_from_recipe_id = src.id
  and src.catalog_key like 'seed_%'
  and hh.household_id is not null
  and hh.image_url like 'https://www.themealdb.com/images/%';
