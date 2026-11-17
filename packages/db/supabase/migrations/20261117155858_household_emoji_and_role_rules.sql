-- Household emoji logo + tighter member role / delete / leave rules.

alter table public.households
  add column if not exists emoji text;

comment on column public.households.emoji is 'Optional emoji logo shown on the household settings hero.';

-- Owner or admin can delete the family.
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

  if v_role is distinct from 'owner' and v_role is distinct from 'admin' then
    raise exception 'Only an owner or admin can delete the family';
  end if;

  delete from public.households where id = p_household_id;
end;
$$;

-- Adults+ can leave; child/teen cannot. Sole owner still blocked.
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

  if v_role in ('child', 'teen') then
    raise exception 'Ask an adult to remove you from the family';
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

-- Owner/admin: age up child/teen, promote adult→admin, owner demotes admin→adult.
create or replace function public.set_household_member_role(
  p_household_id uuid,
  p_user_id uuid,
  p_role public.household_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor public.household_role;
  v_target public.household_role;
  v_ok boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id = v_uid then
    raise exception 'You cannot change your own role';
  end if;

  select role into v_actor
  from public.household_members
  where household_id = p_household_id
    and user_id = v_uid;

  select role into v_target
  from public.household_members
  where household_id = p_household_id
    and user_id = p_user_id;

  if v_actor is null or v_target is null then
    raise exception 'Not a member of this household';
  end if;

  if v_target = 'owner' or p_role = 'owner' or p_role = 'member' then
    raise exception 'That role cannot be assigned';
  end if;

  if v_actor not in ('owner', 'admin') then
    raise exception 'Not allowed to change roles';
  end if;

  if v_target = 'child' and p_role in ('teen', 'adult') then
    v_ok := true;
  elsif v_target = 'teen' and p_role = 'adult' then
    v_ok := true;
  elsif v_target = 'adult' and p_role = 'admin' then
    v_ok := true;
  elsif v_target = 'admin' and p_role = 'adult' and v_actor = 'owner' then
    v_ok := true;
  end if;

  if not v_ok then
    raise exception 'That role change is not allowed';
  end if;

  update public.household_members
  set role = p_role
  where household_id = p_household_id
    and user_id = p_user_id;
end;
$$;

notify pgrst, 'reload schema';
