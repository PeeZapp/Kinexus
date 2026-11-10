-- Create / rename / delete custom readlists (default list cannot be deleted).
-- Writes stay on security-definer RPCs; tables remain select-only via RLS.

create or replace function public.create_readlist_list(
  p_household_id uuid,
  p_name text,
  p_visibility text default 'household',
  p_person_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := nullif(trim(p_name), '');
  v_visibility text := lower(nullif(trim(p_visibility), ''));
  v_list_id uuid;
  v_person_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_household_id is null then
    raise exception 'household_id is required';
  end if;
  if not public.is_household_member(p_household_id) then
    raise exception 'Not a household member';
  end if;
  if v_name is null then
    raise exception 'Give the list a name';
  end if;
  if v_visibility is null or v_visibility not in ('household', 'private', 'people') then
    if v_visibility = 'global' then
      raise exception 'Global readlist visibility is not available yet';
    end if;
    raise exception 'Invalid visibility';
  end if;
  if v_visibility = 'people' and coalesce(cardinality(p_person_ids), 0) = 0 then
    raise exception 'Pick at least one person to share with';
  end if;

  insert into public.readlist_lists (
    household_id, created_by, name, visibility, is_default
  ) values (
    p_household_id, v_uid, v_name, v_visibility, false
  )
  returning id into v_list_id;

  if v_visibility = 'people' then
    foreach v_person_id in array p_person_ids
    loop
      if not exists (
        select 1
        from public.household_people hp
        where hp.id = v_person_id
          and hp.household_id = p_household_id
      ) then
        raise exception 'Person not in household';
      end if;
      insert into public.readlist_list_people (household_id, list_id, person_id)
      values (p_household_id, v_list_id, v_person_id)
      on conflict do nothing;
    end loop;
  end if;

  return v_list_id;
end;
$$;

create or replace function public.rename_readlist_list(
  p_list_id uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := nullif(trim(p_name), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.can_manage_readlist_list(p_list_id) then
    raise exception 'Cannot manage this readlist';
  end if;
  if v_name is null then
    raise exception 'Give the list a name';
  end if;

  update public.readlist_lists
  set name = v_name, updated_at = now()
  where id = p_list_id;

  if not found then
    raise exception 'List not found';
  end if;

  return p_list_id;
end;
$$;

create or replace function public.delete_readlist_list(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_default boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.can_manage_readlist_list(p_list_id) then
    raise exception 'Cannot manage this readlist';
  end if;

  select is_default into v_is_default
  from public.readlist_lists
  where id = p_list_id;

  if not found then
    raise exception 'List not found';
  end if;
  if v_is_default then
    raise exception 'Default readlist cannot be deleted';
  end if;

  delete from public.readlist_lists where id = p_list_id;
end;
$$;

revoke all on function public.create_readlist_list(uuid, text, text, uuid[]) from public;
revoke all on function public.create_readlist_list(uuid, text, text, uuid[]) from anon;
grant execute on function public.create_readlist_list(uuid, text, text, uuid[]) to authenticated;

revoke all on function public.rename_readlist_list(uuid, text) from public;
revoke all on function public.rename_readlist_list(uuid, text) from anon;
grant execute on function public.rename_readlist_list(uuid, text) to authenticated;

revoke all on function public.delete_readlist_list(uuid) from public;
revoke all on function public.delete_readlist_list(uuid) from anon;
grant execute on function public.delete_readlist_list(uuid) to authenticated;

notify pgrst, 'reload schema';
