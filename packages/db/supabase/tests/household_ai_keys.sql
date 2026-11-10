-- Manual SQL checks for household AI keys (after applying 20261110120000_household_ai_keys).
-- Replace UUIDs with real profile / household ids, then run (rolls back).

begin;

select set_config('test.admin', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('test.member', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('test.household', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);

do $$
declare
  admin_id uuid := current_setting('test.admin')::uuid;
  member_id uuid := current_setting('test.member')::uuid;
  hh uuid := current_setting('test.household')::uuid;
  hit int;
  child_allowed boolean;
begin
  perform set_config('search_path', 'public, extensions', true);

  if not exists (
    select 1 from public.household_members
    where household_id = hh and user_id = admin_id and role in ('owner', 'admin')
  ) then
    raise exception 'test.admin must be owner/admin of test.household';
  end if;

  if not exists (
    select 1 from public.household_members
    where household_id = hh and user_id = member_id
  ) then
    raise exception 'test.member must belong to test.household';
  end if;

  -- Store a key via security-definer helper (Vault + metadata)
  perform public.internal_store_household_ai_key(
    hh,
    'anthropic'::public.ai_provider,
    'sk-ant-test-secret-value-do-not-keep',
    'alue',
    'valid'::public.ai_key_status,
    admin_id
  );

  -- Authenticated cannot select household_ai_keys (RLS deny-all)
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    execute 'set local role authenticated';
  exception when others then
    null;
  end;

  select count(*) into hit from public.household_ai_keys;
  if hit <> 0 then
    raise exception 'authenticated must not read household_ai_keys rows (got %)', hit;
  end if;

  -- Non-admin cannot change access
  begin
    perform public.set_household_ai_key_access(hh, member_id, true);
    raise exception 'non-admin changed AI key access';
  exception
    when others then
      if position('owner or admin' in lower(sqlerrm)) = 0 and position('only an owner' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;

  -- Child default: linked person_type child => false
  reset role;
  if exists (select 1 from public.household_people where household_id = hh and user_id = member_id) then
    update public.household_people
    set person_type = 'child'
    where household_id = hh and user_id = member_id;
  else
    insert into public.household_people (household_id, user_id, name, person_type)
    values (hh, member_id, 'Kid', 'child');
  end if;

  child_allowed := public.household_ai_key_default_allowed(hh, member_id);
  if child_allowed is distinct from false then
    raise exception 'child default allowed should be false, got %', child_allowed;
  end if;

  perform public.internal_remove_household_ai_key(hh, admin_id);
end;
$$;

rollback;
