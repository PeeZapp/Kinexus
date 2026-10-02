-- An owner can delete the family. The last owner can also delete their sign-in,
-- which removes every family they are the only owner of.

create or replace function public.delete_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.household_role;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_role
  from public.household_members
  where household_id = p_household_id
    and user_id = v_uid;

  if v_role is distinct from 'owner' then
    raise exception 'Only an owner can delete the family';
  end if;

  delete from public.households where id = p_household_id;
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  for v_household in
    select m.household_id
    from public.household_members m
    where m.user_id = v_uid
      and m.role = 'owner'
      and not exists (
        select 1
        from public.household_members other_owner
        where other_owner.household_id = m.household_id
          and other_owner.role = 'owner'
          and other_owner.user_id <> v_uid
      )
  loop
    delete from public.households where id = v_household;
  end loop;

  delete from auth.users where id = v_uid;
end;
$$;

create or replace function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.household_role;
  v_owner_count integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_role
  from public.household_members
  where household_id = p_household_id
    and user_id = v_uid;

  if v_role is null then
    raise exception 'Not a member of this household';
  end if;

  if v_role = 'owner' then
    select count(*) into v_owner_count
    from public.household_members
    where household_id = p_household_id
      and role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'Delete the family if you want to remove it, or make someone else an owner before leaving';
    end if;
  end if;

  delete from public.household_members
  where household_id = p_household_id
    and user_id = v_uid;
end;
$$;

revoke all on function public.delete_household(uuid) from public;
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_household(uuid) to authenticated;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;

notify pgrst, 'reload schema';
