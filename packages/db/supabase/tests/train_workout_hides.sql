-- Manual SQL checks for train_workout_hides (after applying 20261112224835).
-- Replace UUIDs with real profile / workout ids, then run (rolls back).

begin;

select set_config('test.owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('test.stranger', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select set_config('test.workout', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);

do $$
declare
  owner uuid := current_setting('test.owner')::uuid;
  stranger uuid := current_setting('test.stranger')::uuid;
  wid uuid := current_setting('test.workout')::uuid;
  blocked boolean := false;
begin
  perform set_config('search_path', 'public, extensions', true);

  perform set_config('request.jwt.claim.sub', owner::text, true);
  insert into public.train_workout_hides (workout_id, user_id)
  values (wid, owner)
  on conflict do nothing;

  if not exists (
    select 1 from public.train_workout_hides where workout_id = wid and user_id = owner
  ) then
    raise exception 'owner should be able to hide a viewable workout';
  end if;

  perform set_config('request.jwt.claim.sub', stranger::text, true);
  begin
    delete from public.train_workout_hides where workout_id = wid and user_id = owner;
    if found then
      raise exception 'stranger must not delete another users hide';
    end if;
  exception
    when others then
      blocked := true;
  end;

  perform set_config('request.jwt.claim.sub', owner::text, true);
  delete from public.train_workout_hides where workout_id = wid and user_id = owner;

  raise notice 'train_workout_hides checks ok';
end;
$$;

rollback;
