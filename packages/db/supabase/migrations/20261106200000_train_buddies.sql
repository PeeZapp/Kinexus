-- Train social part 1: cross-household gym buddies (connections + per-buddy permissions).
-- Does not change workouts.visibility / workout RLS (hub + global publish are later prompts).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.train_buddies (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint train_buddies_no_self check (requester_id <> addressee_id)
);

create unique index train_buddies_pair_uidx
  on public.train_buddies (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create index train_buddies_requester_idx on public.train_buddies (requester_id, status);
create index train_buddies_addressee_idx on public.train_buddies (addressee_id, status);

create trigger train_buddies_set_updated_at
  before update on public.train_buddies
  for each row execute function public.set_updated_at();

create table public.train_buddy_permissions (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  buddy_id uuid not null references public.profiles (id) on delete cascade,
  can_view_plan boolean not null default false,
  can_view_workouts boolean not null default true,
  can_copy_workouts boolean not null default true,
  can_view_sessions boolean not null default false,
  can_view_prs boolean not null default false,
  can_coedit_shared boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, buddy_id),
  constraint train_buddy_permissions_no_self check (owner_id <> buddy_id)
);

create index train_buddy_permissions_buddy_idx
  on public.train_buddy_permissions (buddy_id);

create trigger train_buddy_permissions_set_updated_at
  before update on public.train_buddy_permissions
  for each row execute function public.set_updated_at();

create table public.train_buddy_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index train_buddy_invites_created_by_idx
  on public.train_buddy_invites (created_by, created_at desc);

create index train_buddy_invites_pending_idx
  on public.train_buddy_invites (created_by)
  where accepted_at is null and revoked_at is null;

-- ---------------------------------------------------------------------------
-- Helpers (security definer, pinned search_path)
-- ---------------------------------------------------------------------------

create or replace function public.are_train_buddies(_user_a uuid, _user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _user_a is not null
    and _user_b is not null
    and _user_a <> _user_b
    and exists (
      select 1
      from public.train_buddies b
      where b.status = 'accepted'
        and (
          (b.requester_id = _user_a and b.addressee_id = _user_b)
          or (b.requester_id = _user_b and b.addressee_id = _user_a)
        )
    );
$$;

create or replace function public.buddy_can(
  _owner uuid,
  _viewer uuid,
  _permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.train_buddy_permissions%rowtype;
begin
  if _owner is null or _viewer is null or _owner = _viewer then
    return false;
  end if;

  if _permission is null
     or _permission not in (
       'can_view_plan',
       'can_view_workouts',
       'can_copy_workouts',
       'can_view_sessions',
       'can_view_prs',
       'can_coedit_shared'
     )
  then
    return false;
  end if;

  if not public.are_train_buddies(_owner, _viewer) then
    return false;
  end if;

  select * into v_row
  from public.train_buddy_permissions
  where owner_id = _owner
    and buddy_id = _viewer;

  if not found then
    return false;
  end if;

  return case _permission
    when 'can_view_plan' then v_row.can_view_plan
    when 'can_view_workouts' then v_row.can_view_workouts
    when 'can_copy_workouts' then v_row.can_copy_workouts
    when 'can_view_sessions' then v_row.can_view_sessions
    when 'can_view_prs' then v_row.can_view_prs
    when 'can_coedit_shared' then v_row.can_coedit_shared
    else false
  end;
end;
$$;

create or replace function public.ensure_train_buddy_permission_defaults(
  _owner uuid,
  _buddy uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.train_buddy_permissions (owner_id, buddy_id)
  values (_owner, _buddy)
  on conflict (owner_id, buddy_id) do nothing;
end;
$$;

create or replace function public.train_buddy_pair_row(_user_a uuid, _user_b uuid)
returns public.train_buddies
language sql
stable
security definer
set search_path = public
as $$
  select b.*
  from public.train_buddies b
  where (
      (b.requester_id = _user_a and b.addressee_id = _user_b)
      or (b.requester_id = _user_b and b.addressee_id = _user_a)
    )
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

create or replace function public.train_buddy_permissions_guard()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id = new.buddy_id then
    raise exception 'Cannot grant train buddy permissions to yourself';
  end if;
  if not public.are_train_buddies(new.owner_id, new.buddy_id) then
    raise exception 'Permissions require an accepted train buddy connection';
  end if;
  return new;
end;
$$;

create trigger train_buddy_permissions_guard
  before insert or update on public.train_buddy_permissions
  for each row execute function public.train_buddy_permissions_guard();

-- ---------------------------------------------------------------------------
-- Mutation RPCs
-- ---------------------------------------------------------------------------

create or replace function public.request_train_buddy_by_username(p_username text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_existing public.train_buddies%rowtype;
  v_key text := lower(trim(both from coalesce(p_username, '')));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if left(v_key, 1) = '@' then
    v_key := substr(v_key, 2);
  end if;

  if v_key = '' then
    raise exception 'Username is required';
  end if;

  select p.id into v_target
  from public.public_profile(v_key) p
  limit 1;

  if v_target is null then
    raise exception 'User not found';
  end if;

  if v_target = v_uid then
    raise exception 'Cannot add yourself';
  end if;

  v_existing := public.train_buddy_pair_row(v_uid, v_target);

  if v_existing.id is not null then
    if v_existing.status = 'blocked' then
      raise exception 'Connection is blocked';
    end if;
    if v_existing.status = 'accepted' then
      raise exception 'Already buddies';
    end if;
    if v_existing.status = 'pending' then
      return v_existing.id;
    end if;
  end if;

  insert into public.train_buddies (requester_id, addressee_id, status)
  values (v_uid, v_target, 'pending')
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.respond_train_buddy_request(
  p_connection_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.train_buddies%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.train_buddies
  where id = p_connection_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_row.status is distinct from 'pending' then
    raise exception 'Request is not pending';
  end if;

  if v_row.addressee_id is distinct from v_uid then
    raise exception 'Only the addressee can respond';
  end if;

  if not coalesce(p_accept, false) then
    delete from public.train_buddies where id = v_row.id;
    return;
  end if;

  update public.train_buddies
  set status = 'accepted'
  where id = v_row.id;

  perform public.ensure_train_buddy_permission_defaults(v_row.requester_id, v_row.addressee_id);
  perform public.ensure_train_buddy_permission_defaults(v_row.addressee_id, v_row.requester_id);
end;
$$;

create or replace function public.remove_train_buddy(p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.train_buddies%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_other_user_id is null or p_other_user_id = v_uid then
    raise exception 'Invalid buddy';
  end if;

  v_row := public.train_buddy_pair_row(v_uid, p_other_user_id);
  if v_row.id is null then
    return;
  end if;

  delete from public.train_buddy_permissions
  where (owner_id = v_uid and buddy_id = p_other_user_id)
     or (owner_id = p_other_user_id and buddy_id = v_uid);

  delete from public.train_buddies where id = v_row.id;
end;
$$;

create or replace function public.block_train_buddy(p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.train_buddies%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_other_user_id is null or p_other_user_id = v_uid then
    raise exception 'Invalid buddy';
  end if;

  delete from public.train_buddy_permissions
  where (owner_id = v_uid and buddy_id = p_other_user_id)
     or (owner_id = p_other_user_id and buddy_id = v_uid);

  v_row := public.train_buddy_pair_row(v_uid, p_other_user_id);

  if v_row.id is not null then
    update public.train_buddies
    set status = 'blocked',
        requester_id = v_uid,
        addressee_id = p_other_user_id
    where id = v_row.id;
  else
    insert into public.train_buddies (requester_id, addressee_id, status)
    values (v_uid, p_other_user_id, 'blocked');
  end if;
end;
$$;

create or replace function public.create_train_buddy_invite(p_ttl_hours integer default 168)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
  v_hash text;
  v_exp timestamptz;
  v_id uuid;
  v_ttl integer := coalesce(p_ttl_hours, 168);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_ttl < 1 or v_ttl > 720 then
    raise exception 'Invite lifetime must be between 1 and 720 hours';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_exp := now() + make_interval(hours => v_ttl);

  insert into public.train_buddy_invites (token_hash, created_by, expires_at)
  values (v_hash, v_uid, v_exp)
  returning id into v_id;

  return query select v_id, v_token, v_exp;
end;
$$;

create or replace function public.peek_train_buddy_invite(p_token text)
returns table (
  inviter_id uuid,
  inviter_username extensions.citext,
  inviter_global_handle extensions.citext,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if p_token is null or char_length(trim(p_token)) = 0 then
    return;
  end if;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  return query
  select
    i.created_by as inviter_id,
    p.username as inviter_username,
    p.global_handle as inviter_global_handle,
    i.expires_at
  from public.train_buddy_invites i
  join public.profiles p on p.id = i.created_by
  where i.token_hash = v_hash
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now();
end;
$$;

create or replace function public.accept_train_buddy_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_invite public.train_buddy_invites%rowtype;
  v_existing public.train_buddies%rowtype;
  v_connection_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_token is null or char_length(trim(p_token)) = 0 then
    raise exception 'Invite token is required';
  end if;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  select * into v_invite
  from public.train_buddy_invites
  where token_hash = v_hash
  for update;

  if not found then
    raise exception 'Invalid invite';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'Invite has been revoked';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'Invite has expired';
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'Invite has already been used';
  end if;

  if v_invite.created_by = v_uid then
    raise exception 'Cannot accept your own invite';
  end if;

  v_existing := public.train_buddy_pair_row(v_uid, v_invite.created_by);

  if v_existing.id is not null and v_existing.status = 'blocked' then
    raise exception 'Connection is blocked';
  end if;

  if v_existing.id is not null and v_existing.status = 'accepted' then
    update public.train_buddy_invites
    set accepted_at = now(), accepted_by = v_uid
    where id = v_invite.id;
    return v_existing.id;
  end if;

  if v_existing.id is not null and v_existing.status = 'pending' then
    update public.train_buddies
    set status = 'accepted',
        requester_id = v_invite.created_by,
        addressee_id = v_uid
    where id = v_existing.id
    returning id into v_connection_id;
  else
    insert into public.train_buddies (requester_id, addressee_id, status)
    values (v_invite.created_by, v_uid, 'accepted')
    returning id into v_connection_id;
  end if;

  perform public.ensure_train_buddy_permission_defaults(v_invite.created_by, v_uid);
  perform public.ensure_train_buddy_permission_defaults(v_uid, v_invite.created_by);

  update public.train_buddy_invites
  set accepted_at = now(), accepted_by = v_uid
  where id = v_invite.id;

  return v_connection_id;
end;
$$;

create or replace function public.revoke_train_buddy_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.train_buddy_invites
  set revoked_at = now()
  where id = p_invite_id
    and created_by = auth.uid()
    and accepted_at is null
    and revoked_at is null;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Invite not found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table public.train_buddies to authenticated;
grant select, insert, update, delete on table public.train_buddy_permissions to authenticated;
grant select on table public.train_buddy_invites to authenticated;

revoke all on function public.are_train_buddies(uuid, uuid) from public;
revoke all on function public.buddy_can(uuid, uuid, text) from public;
revoke all on function public.ensure_train_buddy_permission_defaults(uuid, uuid) from public;
revoke all on function public.train_buddy_pair_row(uuid, uuid) from public;
revoke all on function public.request_train_buddy_by_username(text) from public;
revoke all on function public.respond_train_buddy_request(uuid, boolean) from public;
revoke all on function public.remove_train_buddy(uuid) from public;
revoke all on function public.block_train_buddy(uuid) from public;
revoke all on function public.create_train_buddy_invite(integer) from public;
revoke all on function public.peek_train_buddy_invite(text) from public;
revoke all on function public.accept_train_buddy_invite(text) from public;
revoke all on function public.revoke_train_buddy_invite(uuid) from public;

grant execute on function public.are_train_buddies(uuid, uuid) to authenticated;
grant execute on function public.buddy_can(uuid, uuid, text) to authenticated;
grant execute on function public.request_train_buddy_by_username(text) to authenticated;
grant execute on function public.respond_train_buddy_request(uuid, boolean) to authenticated;
grant execute on function public.remove_train_buddy(uuid) to authenticated;
grant execute on function public.block_train_buddy(uuid) to authenticated;
grant execute on function public.create_train_buddy_invite(integer) to authenticated;
grant execute on function public.peek_train_buddy_invite(text) to authenticated;
grant execute on function public.accept_train_buddy_invite(text) to authenticated;
grant execute on function public.revoke_train_buddy_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS (owner/participant reads; owner-only permission writes; mutations via RPC)
-- ---------------------------------------------------------------------------

alter table public.train_buddies enable row level security;
alter table public.train_buddy_permissions enable row level security;
alter table public.train_buddy_invites enable row level security;

create policy train_buddies_select on public.train_buddies
  for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy train_buddies_insert on public.train_buddies
  for insert to authenticated
  with check (
    auth.uid() = requester_id
    and status in ('pending', 'blocked')
    and requester_id <> addressee_id
  );

create policy train_buddies_update on public.train_buddies
  for update to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id)
  with check (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy train_buddies_delete on public.train_buddies
  for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy train_buddy_permissions_select on public.train_buddy_permissions
  for select to authenticated
  using (auth.uid() = owner_id or auth.uid() = buddy_id);

create policy train_buddy_permissions_insert on public.train_buddy_permissions
  for insert to authenticated
  with check (auth.uid() = owner_id);

create policy train_buddy_permissions_update on public.train_buddy_permissions
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy train_buddy_permissions_delete on public.train_buddy_permissions
  for delete to authenticated
  using (auth.uid() = owner_id);

create policy train_buddy_invites_select on public.train_buddy_invites
  for select to authenticated
  using (auth.uid() = created_by);

notify pgrst, 'reload schema';
