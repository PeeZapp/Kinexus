-- Recipe classes (sauce, side, marinade, and the rest) plus sides attached to a meal cell.

alter table public.recipes
  add column if not exists recipe_class text;

alter table public.recipes
  drop constraint if exists recipes_recipe_class_check;

alter table public.recipes
  add constraint recipes_recipe_class_check
  check (
    recipe_class is null
    or recipe_class in (
      'sauce', 'side', 'marinade', 'dressing', 'stock', 'rub', 'dip', 'condiment'
    )
  );

alter table public.meal_slots
  add column if not exists side_recipe_ids uuid[] not null default '{}';

create or replace function public.publish_creator_recipe(p_source_recipe_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_src public.recipes%rowtype;
  v_existing uuid;
  v_id uuid;
  v_key text;
  v_slug text;
  v_short text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_approved_creator() then
    raise exception 'Only approved creators can publish to the library';
  end if;

  select * into v_src
  from public.recipes
  where id = p_source_recipe_id
  for share;

  if not found then
    raise exception 'Recipe not found';
  end if;
  if v_src.household_id is null then
    raise exception 'Publish from a household recipe';
  end if;
  if not public.is_household_member(v_src.household_id) then
    raise exception 'Not a member of that household';
  end if;
  if char_length(trim(v_src.name)) = 0 then
    raise exception 'Recipe needs a name';
  end if;
  if jsonb_typeof(v_src.ingredients) <> 'array' or jsonb_array_length(v_src.ingredients) < 1 then
    raise exception 'Add at least one ingredient before publishing';
  end if;
  if jsonb_typeof(v_src.method) <> 'array' or jsonb_array_length(v_src.method) < 1 then
    raise exception 'Add method steps before publishing';
  end if;

  select id into v_existing
  from public.recipes
  where creator_source_recipe_id = p_source_recipe_id
    and created_by = v_uid
  limit 1;

  if v_existing is not null then
    update public.recipes set
      name = v_src.name,
      emoji = v_src.emoji,
      cuisine = v_src.cuisine,
      cook_time = v_src.cook_time,
      servings = v_src.servings,
      protein = v_src.protein,
      calories = v_src.calories,
      carbs = v_src.carbs,
      fat = v_src.fat,
      vegetarian = v_src.vegetarian,
      ingredients = v_src.ingredients,
      method = v_src.method,
      chef_tip = v_src.chef_tip,
      notes = v_src.notes,
      meal_slots = v_src.meal_slots,
      is_component = v_src.is_component,
      recipe_class = v_src.recipe_class,
      excluded_from_auto = false,
      source_url = v_src.source_url,
      image_url = v_src.image_url,
      removed = false,
      creator_published_at = now(),
      updated_at = now()
    where id = v_existing;

    insert into public.creator_content_events (kind, content_id, creator_id, title, published_at)
    values ('recipe', v_existing, v_uid, v_src.name, now());

    return v_existing;
  end if;

  v_short := replace(left(v_uid::text, 8), '-', '');
  v_slug := public.slugify_catalog_fragment(v_src.name);
  if v_slug = '' then
    v_slug := 'recipe';
  end if;
  v_key := 'creator_' || v_short || '_' || left(v_slug, 48);
  if exists (select 1 from public.recipes where catalog_key = v_key) then
    v_key := v_key || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  end if;

  insert into public.recipes (
    household_id, catalog_key, name, emoji, cuisine, cook_time, servings,
    protein, calories, carbs, fat, vegetarian, ingredients, method,
    chef_tip, notes, meal_slots, is_component, recipe_class, excluded_from_auto,
    is_public, source_url, image_url, removed, created_by,
    creator_published_at, creator_source_recipe_id
  ) values (
    null, v_key, v_src.name, v_src.emoji, v_src.cuisine, v_src.cook_time, v_src.servings,
    v_src.protein, v_src.calories, v_src.carbs, v_src.fat, v_src.vegetarian,
    v_src.ingredients, v_src.method, v_src.chef_tip, v_src.notes, v_src.meal_slots,
    v_src.is_component, v_src.recipe_class, false, true, v_src.source_url, v_src.image_url, false,
    v_uid, now(), p_source_recipe_id
  )
  returning id into v_id;

  insert into public.creator_content_events (kind, content_id, creator_id, title, published_at)
  values ('recipe', v_id, v_uid, v_src.name, now());

  return v_id;
end;
$$;
