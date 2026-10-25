-- The bootstrap account can publish household recipes into the shared catalog
-- and edit catalog photos, without a creator application.

create or replace function public.is_catalog_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(trim(coalesce(u.email, ''))) in (
        select email from public.platform_staff_bootstrap_emails
      )
  );
$$;

create or replace function public.grant_catalog_owner_access(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_meta jsonb;
  v_name text;
begin
  if p_uid is null then
    return;
  end if;

  select lower(trim(coalesce(email, ''))), raw_user_meta_data
  into v_email, v_meta
  from auth.users
  where id = p_uid;

  if v_email is null or v_email = '' then
    return;
  end if;

  if not exists (
    select 1 from public.platform_staff_bootstrap_emails where email = v_email
  ) then
    return;
  end if;

  v_name := coalesce(
    nullif(v_meta ->> 'full_name', ''),
    nullif(v_meta ->> 'name', ''),
    split_part(v_email, '@', 1)
  );

  insert into public.profiles (id, display_name, avatar_url, email)
  values (
    p_uid,
    v_name,
    coalesce(nullif(v_meta ->> 'avatar_url', ''), nullif(v_meta ->> 'picture', '')),
    v_email
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        updated_at = now();

  insert into public.platform_staff (user_id, invited_by)
  values (p_uid, null)
  on conflict (user_id) do nothing;

  insert into public.catalog_editors (user_id)
  values (p_uid)
  on conflict (user_id) do nothing;

  insert into public.creators (
    user_id, status, display_name, approved_at, revoked_at, revoked_reason, updated_at
  )
  values (p_uid, 'approved', v_name, now(), null, null, now())
  on conflict (user_id) do update
    set status = 'approved',
        display_name = coalesce(public.creators.display_name, excluded.display_name),
        approved_at = coalesce(public.creators.approved_at, now()),
        revoked_at = null,
        revoked_reason = null,
        updated_at = now();
end;
$$;

create or replace function public.ensure_catalog_owner_access()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_catalog_owner() then
    return false;
  end if;
  perform public.grant_catalog_owner_access(auth.uid());
  return true;
end;
$$;

create or replace function public.is_approved_creator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_catalog_owner()
    or exists (
      select 1
      from public.creators
      where user_id = auth.uid() and status = 'approved'
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

  if public.ensure_catalog_owner_access() then
    return true;
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

revoke all on function public.grant_catalog_owner_access(uuid) from public;
revoke all on function public.is_catalog_owner() from public;
revoke all on function public.ensure_catalog_owner_access() from public;

grant execute on function public.is_catalog_owner() to authenticated;
grant execute on function public.ensure_catalog_owner_access() to authenticated;

do $$
declare
  v_uid uuid;
begin
  for v_uid in
    select u.id
    from auth.users u
    where lower(trim(coalesce(u.email, ''))) in (
      select email from public.platform_staff_bootstrap_emails
    )
  loop
    perform public.grant_catalog_owner_access(v_uid);
  end loop;
end;
$$;
