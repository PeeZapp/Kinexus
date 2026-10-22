-- How many serves to cook when this plan cell uses its recipe.
-- Null keeps the recipe's written yield.

alter table public.meal_slots
  add column target_servings integer;

alter table public.meal_slots
  add constraint meal_slots_target_servings_check
  check (target_servings is null or target_servings > 0);
