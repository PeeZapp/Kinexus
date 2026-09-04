-- Catalog photo review: first household owner to open Meals becomes the editor.
-- Editors can flag a catalog photo as wrong and replace or clear the URL.
-- Other clients cannot update catalog recipe rows.

alter table public.recipes add column if not exists image_flagged boolean not null default false;

create table if not exists public.catalog_editors (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  claimed_at timestamptz not null default now()
);

alter table public.catalog_editors enable row level security;

drop policy if exists catalog_editors_select on public.catalog_editors;
create policy catalog_editors_select on public.catalog_editors
  for select to authenticated
  using (user_id = auth.uid());

grant select on table public.catalog_editors to authenticated;

create or replace function public.is_catalog_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.catalog_editors where user_id = auth.uid()
  );
$$;

create or replace function public.claim_catalog_editor()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.catalog_editors where user_id = v_uid) then
    return true;
  end if;

  if not exists (
    select 1
    from public.household_members
    where user_id = v_uid and role = 'owner'
  ) then
    return false;
  end if;

  insert into public.catalog_editors (user_id)
  select v_uid
  where not exists (select 1 from public.catalog_editors);

  return exists (select 1 from public.catalog_editors where user_id = v_uid);
end;
$$;

create or replace function public.review_catalog_image(
  p_recipe_id uuid,
  p_action text,
  p_image_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_catalog_editor() then
    raise exception 'Not a catalog editor';
  end if;
  if p_action not in ('flag', 'unflag', 'set_url', 'clear') then
    raise exception 'Unknown review action';
  end if;

  if not exists (
    select 1 from public.recipes
    where id = p_recipe_id and household_id is null
  ) then
    raise exception 'Catalog recipe not found';
  end if;

  if p_action = 'flag' then
    update public.recipes
    set image_flagged = true
    where id = p_recipe_id;
    return;
  end if;

  if p_action = 'unflag' then
    update public.recipes
    set image_flagged = false
    where id = p_recipe_id;
    return;
  end if;

  if p_action = 'clear' then
    update public.recipes
    set image_url = null, image_flagged = true
    where id = p_recipe_id;
    return;
  end if;

  v_url := trim(coalesce(p_image_url, ''));
  if v_url = '' or v_url !~* '^https://' then
    raise exception 'Image URL must be an https:// link';
  end if;
  if char_length(v_url) > 2000 then
    raise exception 'Image URL is too long';
  end if;

  update public.recipes
  set image_url = v_url, image_flagged = false
  where id = p_recipe_id;
end;
$$;

grant execute on function public.is_catalog_editor() to authenticated;
grant execute on function public.claim_catalog_editor() to authenticated;
grant execute on function public.review_catalog_image(uuid, text, text) to authenticated;
