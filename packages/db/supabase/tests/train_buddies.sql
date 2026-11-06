-- Manual SQL checks for train buddies (after applying 20261106200000_train_buddies).
-- Replace the two UUIDs below with real profile ids, then run (transaction rolls back).

begin;

select set_config('test.user_a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('test.user_b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);

do $$
declare
  a uuid := current_setting('test.user_a')::uuid;
  b uuid := current_setting('test.user_b')::uuid;
begin
  perform set_config('search_path', 'public, extensions', true);

  delete from public.train_buddy_permissions
  where (owner_id, buddy_id) in ((a, b), (b, a));
  delete from public.train_buddies
  where least(requester_id, addressee_id) = least(a, b)
    and greatest(requester_id, addressee_id) = greatest(a, b);
  delete from public.train_buddy_invites
  where created_by in (a, b)
    and token_hash in (
      encode(digest('live-token', 'sha256'), 'hex'),
      encode(digest('expired-token', 'sha256'), 'hex'),
      encode(digest('used-token', 'sha256'), 'hex')
    );

  -- Non-buddies see nothing
  if public.are_train_buddies(a, b) then
    raise exception 'non-buddies: are_train_buddies should be false';
  end if;
  if public.buddy_can(a, b, 'can_view_workouts') then
    raise exception 'non-buddies: buddy_can should be false';
  end if;

  insert into public.train_buddies (requester_id, addressee_id, status)
  values (a, b, 'accepted');
  insert into public.train_buddy_permissions (owner_id, buddy_id)
  values (a, b), (b, a);

  if not public.are_train_buddies(a, b) then
    raise exception 'accepted: are_train_buddies should be true';
  end if;
  if not public.buddy_can(a, b, 'can_view_workouts') then
    raise exception 'accepted: default can_view_workouts';
  end if;
  if not public.buddy_can(a, b, 'can_copy_workouts') then
    raise exception 'accepted: default can_copy_workouts';
  end if;
  if public.buddy_can(a, b, 'can_view_prs') then
    raise exception 'accepted: default can_view_prs should be false';
  end if;

  -- Remove revokes instantly
  delete from public.train_buddy_permissions
  where (owner_id, buddy_id) in ((a, b), (b, a));
  delete from public.train_buddies
  where least(requester_id, addressee_id) = least(a, b)
    and greatest(requester_id, addressee_id) = greatest(a, b);

  if public.are_train_buddies(a, b) or public.buddy_can(a, b, 'can_view_workouts') then
    raise exception 'remove did not revoke access';
  end if;

  -- Block hides both ways
  insert into public.train_buddies (requester_id, addressee_id, status)
  values (a, b, 'blocked');
  if public.are_train_buddies(a, b)
     or public.buddy_can(a, b, 'can_view_workouts')
     or public.buddy_can(b, a, 'can_view_workouts') then
    raise exception 'block did not hide both ways';
  end if;

  delete from public.train_buddies
  where least(requester_id, addressee_id) = least(a, b)
    and greatest(requester_id, addressee_id) = greatest(a, b);

  -- Invite expiry + single-use (peek)
  insert into public.train_buddy_invites (token_hash, created_by, expires_at)
  values (encode(digest('live-token', 'sha256'), 'hex'), a, now() + interval '1 day');
  insert into public.train_buddy_invites (token_hash, created_by, expires_at)
  values (encode(digest('expired-token', 'sha256'), 'hex'), a, now() - interval '1 hour');
  insert into public.train_buddy_invites (token_hash, created_by, expires_at, accepted_at, accepted_by)
  values (encode(digest('used-token', 'sha256'), 'hex'), a, now() + interval '1 day', now(), b);

  if not exists (select 1 from public.peek_train_buddy_invite('live-token')) then
    raise exception 'peek should return live invite';
  end if;
  if exists (select 1 from public.peek_train_buddy_invite('expired-token')) then
    raise exception 'peek should hide expired invite';
  end if;
  if exists (select 1 from public.peek_train_buddy_invite('used-token')) then
    raise exception 'peek should hide used invite (single-use)';
  end if;

  raise notice 'train_buddies checks ok';
end;
$$;

rollback;
