-- Allow deleting the default readlist; recreate an empty default for the owner.

create or replace function public.delete_readlist_list(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_default boolean;
  v_household_id uuid;
  v_created_by uuid;
  v_name text;
  v_visibility text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.can_manage_readlist_list(p_list_id) then
    raise exception 'Cannot manage this readlist';
  end if;

  select is_default, household_id, created_by, name, visibility
    into v_is_default, v_household_id, v_created_by, v_name, v_visibility
  from public.readlist_lists
  where id = p_list_id;

  if not found then
    raise exception 'List not found';
  end if;

  delete from public.readlist_lists where id = p_list_id;

  if v_is_default and v_created_by is not null then
    insert into public.readlist_lists (
      household_id, created_by, name, visibility, is_default
    ) values (
      v_household_id,
      v_created_by,
      coalesce(nullif(trim(v_name), ''), 'Reading list'),
      case
        when v_visibility in ('household', 'private', 'people') then v_visibility
        else 'private'
      end,
      true
    );
  end if;
end;
$$;

revoke all on function public.delete_readlist_list(uuid) from public;
revoke all on function public.delete_readlist_list(uuid) from anon;
grant execute on function public.delete_readlist_list(uuid) to authenticated;

notify pgrst, 'reload schema';
