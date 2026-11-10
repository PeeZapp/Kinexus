-- Public link sharing for readlist lists (independent of household visibility).
-- Rotating share_token revokes older links; is_shared=false also breaks them.
-- Global visibility stays deferred (#25f) — rejected in guard + visibility RPC.

alter table public.readlist_lists
  add column if not exists share_token uuid;

alter table public.readlist_lists
  add column if not exists is_shared boolean not null default false;

create unique index if not exists readlist_lists_share_token_uidx
  on public.readlist_lists (share_token)
  where share_token is not null;

create or replace function public.readlist_list_guard()
returns trigger
language plpgsql
as $$
begin
  if new.visibility = 'global' then
    raise exception 'Global readlist visibility is not available yet';
  end if;
  if new.visibility = 'private' and new.created_by is distinct from auth.uid() then
    raise exception 'Private readlists must belong to you';
  end if;
  if new.name is not null then
    new.name = trim(new.name);
  end if;
  return new;
end;
$$;

create or replace function public.set_readlist_list_visibility(
  p_list_id uuid,
  p_visibility text,
  p_person_ids uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_visibility text := lower(nullif(trim(p_visibility), ''));
  v_household_id uuid;
  v_person_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.can_manage_readlist_list(p_list_id) then
    raise exception 'Cannot manage this readlist';
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

  select household_id into v_household_id
  from public.readlist_lists
  where id = p_list_id;
  if not found then
    raise exception 'List not found';
  end if;

  if v_visibility = 'private' then
    update public.readlist_lists
    set visibility = 'private', updated_at = now()
    where id = p_list_id
      and created_by = v_uid;
    if not found then
      raise exception 'Private readlists must belong to you';
    end if;
  else
    update public.readlist_lists
    set visibility = v_visibility, updated_at = now()
    where id = p_list_id;
  end if;

  delete from public.readlist_list_people where list_id = p_list_id;

  if v_visibility = 'people' then
    foreach v_person_id in array p_person_ids
    loop
      if not exists (
        select 1
        from public.household_people hp
        where hp.id = v_person_id
          and hp.household_id = v_household_id
      ) then
        raise exception 'Person not in household';
      end if;
      insert into public.readlist_list_people (household_id, list_id, person_id)
      values (v_household_id, p_list_id, v_person_id)
      on conflict do nothing;
    end loop;
  end if;
end;
$$;

-- Same rotate-token pattern as watchlist: new uuid on enable (if missing) or rotate;
-- disable clears token so old links 404.
create or replace function public.set_readlist_list_link_share(
  p_list_id uuid,
  p_enabled boolean,
  p_rotate boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.can_manage_readlist_list(p_list_id) then
    raise exception 'Cannot manage this readlist';
  end if;

  if not p_enabled then
    update public.readlist_lists
    set is_shared = false, share_token = null, updated_at = now()
    where id = p_list_id;
    return null;
  end if;

  select share_token into v_token
  from public.readlist_lists
  where id = p_list_id;

  if not found then
    raise exception 'List not found';
  end if;

  if p_rotate or v_token is null then
    v_token := gen_random_uuid();
  end if;

  update public.readlist_lists
  set is_shared = true, share_token = v_token, updated_at = now()
  where id = p_list_id;

  return v_token;
end;
$$;

revoke all on function public.set_readlist_list_visibility(uuid, text, uuid[]) from public;
revoke all on function public.set_readlist_list_visibility(uuid, text, uuid[]) from anon;
grant execute on function public.set_readlist_list_visibility(uuid, text, uuid[]) to authenticated;

revoke all on function public.set_readlist_list_link_share(uuid, boolean, boolean) from public;
revoke all on function public.set_readlist_list_link_share(uuid, boolean, boolean) from anon;
grant execute on function public.set_readlist_list_link_share(uuid, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';
