-- 16a-1: public creator profiles (meta, reports/blocks, search, item listing).
-- Profiles expose only already-public content; never household/private data, real names, or emails.

-- ---------------------------------------------------------------------------
-- Extension + handle search index
-- ---------------------------------------------------------------------------

create extension if not exists pg_trgm with schema extensions;

create index if not exists profiles_display_handle_trgm_idx
  on public.profiles
  using gin ((lower(coalesce(username::text, global_handle::text))) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.public_profiles_meta (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bio text
    check (bio is null or char_length(bio) <= 280),
  links jsonb not null default '[]'::jsonb
    check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 5),
  is_hidden boolean not null default false,
  recipe_count integer,
  workout_count integer,
  plan_count integer,
  watchlist_count integer,
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  constraint profile_reports_not_self check (reporter_id <> target_id)
);

create index if not exists profile_reports_target_idx
  on public.profile_reports (target_id, created_at desc);

create index if not exists profile_reports_reporter_idx
  on public.profile_reports (reporter_id, created_at desc);

create table if not exists public.profile_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint profile_blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists profile_blocks_blocked_idx
  on public.profile_blocks (blocked_id);

drop trigger if exists public_profiles_meta_set_updated_at on public.public_profiles_meta;
create trigger public_profiles_meta_set_updated_at
  before update on public.public_profiles_meta
  for each row execute function public.set_updated_at();

alter table public.public_profiles_meta enable row level security;
alter table public.profile_reports enable row level security;
alter table public.profile_blocks enable row level security;

drop policy if exists public_profiles_meta_select_own on public.public_profiles_meta;
create policy public_profiles_meta_select_own on public.public_profiles_meta
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists public_profiles_meta_update_own on public.public_profiles_meta;
create policy public_profiles_meta_update_own on public.public_profiles_meta
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists profile_reports_select_own on public.profile_reports;
create policy profile_reports_select_own on public.profile_reports
  for select to authenticated
  using (reporter_id = auth.uid());

drop policy if exists profile_reports_insert_own on public.profile_reports;
create policy profile_reports_insert_own on public.profile_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists profile_blocks_select_own on public.profile_blocks;
create policy profile_blocks_select_own on public.profile_blocks
  for select to authenticated
  using (blocker_id = auth.uid());

drop policy if exists profile_blocks_insert_own on public.profile_blocks;
create policy profile_blocks_insert_own on public.profile_blocks
  for insert to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists profile_blocks_delete_own on public.profile_blocks;
create policy profile_blocks_delete_own on public.profile_blocks
  for delete to authenticated
  using (blocker_id = auth.uid());

grant select, update on table public.public_profiles_meta to authenticated;
grant select, insert on table public.profile_reports to authenticated;
grant select, insert, delete on table public.profile_blocks to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.profile_display_handle(p_username text, p_global_handle text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(nullif(p_username, ''), p_global_handle);
$$;

revoke all on function public.profile_display_handle(text, text) from public;

create or replace function public.profile_avatar_preset(p_avatar_url text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when public.is_profile_avatar_preset(p_avatar_url) and p_avatar_url is not null
      then p_avatar_url
    else null
  end;
$$;

revoke all on function public.profile_avatar_preset(text) from public;

create or replace function public.resolve_profile_user_id(p_key text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_key text := lower(trim(both from coalesce(p_key, '')));
  v_id uuid;
begin
  if v_key = '' then
    return null;
  end if;

  if v_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select p.id into v_id from public.profiles p where p.id = v_key::uuid;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  select p.id into v_id
  from public.profiles p
  where p.global_handle = v_key::extensions.citext
     or (p.username is not null and p.username = v_key::extensions.citext)
  limit 1;

  return v_id;
end;
$$;

revoke all on function public.resolve_profile_user_id(text) from public;

create or replace function public.profile_viewer_blocked(p_viewer uuid, p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_viewer is not null
    and p_target is not null
    and exists (
      select 1
      from public.profile_blocks b
      where (b.blocker_id = p_target and b.blocked_id = p_viewer)
         or (b.blocker_id = p_viewer and b.blocked_id = p_target)
    );
$$;

revoke all on function public.profile_viewer_blocked(uuid, uuid) from public;

create or replace function public.validate_profile_links(p_links jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_links jsonb := coalesce(p_links, '[]'::jsonb);
  v_out jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_url text;
  v_label text;
  v_parsed jsonb;
  i int;
begin
  if jsonb_typeof(v_links) is distinct from 'array' then
    raise exception 'Links must be an array';
  end if;
  if jsonb_array_length(v_links) > 5 then
    raise exception 'At most 5 links';
  end if;

  for i in 0 .. greatest(jsonb_array_length(v_links) - 1, -1) loop
    v_elem := v_links -> i;
    if jsonb_typeof(v_elem) = 'string' then
      v_url := trim(both from (v_elem #>> '{}'));
      v_label := null;
    elsif jsonb_typeof(v_elem) = 'object' then
      v_url := trim(both from coalesce(v_elem->>'url', ''));
      v_label := nullif(trim(both from coalesce(v_elem->>'label', '')), '');
    else
      raise exception 'Each link must be a URL string or {url, label}';
    end if;

    if v_url = '' or v_url !~* '^https://' then
      raise exception 'Links must use https://';
    end if;
    if char_length(v_url) > 500 then
      raise exception 'Link is too long';
    end if;
    if v_label is not null then
      if char_length(v_label) > 40 then
        raise exception 'Link label is too long';
      end if;
      if public.username_contains_profanity(v_label) then
        raise exception 'Link label not allowed';
      end if;
    end if;

    v_parsed := jsonb_strip_nulls(jsonb_build_object('url', v_url, 'label', v_label));
    v_out := v_out || jsonb_build_array(v_parsed);
  end loop;

  return v_out;
end;
$$;

revoke all on function public.validate_profile_links(jsonb) from public;

-- ---------------------------------------------------------------------------
-- get_public_profile
-- ---------------------------------------------------------------------------

create or replace function public.get_public_profile(p_key text)
returns table (
  permanent_id uuid,
  handle text,
  avatar_preset text,
  is_verified boolean,
  bio text,
  links jsonb
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_hidden boolean;
begin
  v_target := public.resolve_profile_user_id(p_key);
  if v_target is null then
    return;
  end if;

  if public.profile_viewer_blocked(v_uid, v_target) then
    return;
  end if;

  select coalesce(m.is_hidden, false) into v_hidden
  from public.public_profiles_meta m
  where m.user_id = v_target;

  v_hidden := coalesce(v_hidden, false);
  if v_hidden and (v_uid is null or v_uid is distinct from v_target) then
    return;
  end if;

  return query
  select
    p.id,
    public.profile_display_handle(p.username::text, p.global_handle::text),
    public.profile_avatar_preset(p.avatar_url),
    p.is_verified_creator,
    m.bio,
    coalesce(m.links, '[]'::jsonb)
  from public.profiles p
  left join public.public_profiles_meta m on m.user_id = p.id
  where p.id = v_target;
end;
$$;

revoke all on function public.get_public_profile(text) from public;
revoke all on function public.get_public_profile(text) from anon;
grant execute on function public.get_public_profile(text) to authenticated;
grant execute on function public.get_public_profile(text) to anon;

-- ---------------------------------------------------------------------------
-- get_profile_items
-- ---------------------------------------------------------------------------

create or replace function public.get_profile_items(
  p_key text,
  p_kind text,
  p_limit integer default 20,
  p_cursor text default null
)
returns table (
  id uuid,
  kind text,
  title text,
  image_url text,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_hidden boolean;
  v_kind text := lower(trim(both from coalesce(p_kind, '')));
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_cursor_at timestamptz;
  v_cursor_id uuid;
  v_parts text[];
begin
  if v_kind not in ('recipe', 'workout', 'plan', 'watchlist') then
    raise exception 'kind must be recipe, workout, plan, or watchlist';
  end if;

  v_target := public.resolve_profile_user_id(p_key);
  if v_target is null then
    return;
  end if;

  if public.profile_viewer_blocked(v_uid, v_target) then
    return;
  end if;

  select coalesce(m.is_hidden, false) into v_hidden
  from public.public_profiles_meta m
  where m.user_id = v_target;
  v_hidden := coalesce(v_hidden, false);
  if v_hidden and (v_uid is null or v_uid is distinct from v_target) then
    return;
  end if;

  if p_cursor is not null and trim(p_cursor) <> '' then
    v_parts := string_to_array(trim(p_cursor), '|');
    if array_length(v_parts, 1) is distinct from 2 then
      raise exception 'Invalid cursor';
    end if;
    begin
      v_cursor_at := v_parts[1]::timestamptz;
      v_cursor_id := v_parts[2]::uuid;
    exception when others then
      raise exception 'Invalid cursor';
    end;
  end if;

  if v_kind = 'recipe' then
    return query
    select
      r.id,
      'recipe'::text,
      r.name,
      r.image_url,
      coalesce(r.creator_published_at, r.updated_at)
    from public.recipes r
    where r.created_by = v_target
      and r.is_public = true
      and r.removed = false
      and r.creator_published_at is not null
      and r.household_id is null
      and (
        v_cursor_at is null
        or (coalesce(r.creator_published_at, r.updated_at), r.id)
             < (v_cursor_at, v_cursor_id)
      )
    order by coalesce(r.creator_published_at, r.updated_at) desc, r.id desc
    limit v_limit;
    return;
  end if;

  if v_kind = 'workout' then
    return query
    select
      w.id,
      'workout'::text,
      w.name,
      null::text,
      w.updated_at
    from public.workouts w
    where w.created_by = v_target
      and w.visibility = 'global'
      and (
        v_cursor_at is null
        or (w.updated_at, w.id) < (v_cursor_at, v_cursor_id)
      )
    order by w.updated_at desc, w.id desc
    limit v_limit;
    return;
  end if;

  if v_kind = 'plan' then
    return query
    select
      tp.id,
      'plan'::text,
      tp.name,
      null::text,
      tp.created_at
    from public.training_plans tp
    where tp.owner_id = v_target
      and tp.visibility = 'global'
      and (
        v_cursor_at is null
        or (tp.created_at, tp.id) < (v_cursor_at, v_cursor_id)
      )
    order by tp.created_at desc, tp.id desc
    limit v_limit;
    return;
  end if;

  -- watchlist
  return query
  select
    l.id,
    'watchlist'::text,
    l.name,
    null::text,
    l.updated_at
  from public.watchlist_lists l
  where l.created_by = v_target
    and l.visibility = 'global'
    and (
      v_cursor_at is null
      or (l.updated_at, l.id) < (v_cursor_at, v_cursor_id)
    )
  order by l.updated_at desc, l.id desc
  limit v_limit;
end;
$$;

revoke all on function public.get_profile_items(text, text, integer, text) from public;
revoke all on function public.get_profile_items(text, text, integer, text) from anon;
grant execute on function public.get_profile_items(text, text, integer, text) to authenticated;
grant execute on function public.get_profile_items(text, text, integer, text) to anon;

-- ---------------------------------------------------------------------------
-- search_creators
-- ---------------------------------------------------------------------------

create or replace function public.search_creators(
  p_q text,
  p_limit integer default 5
)
returns table (
  permanent_id uuid,
  handle text,
  avatar_preset text,
  is_verified boolean,
  rank_score real
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_q text := lower(trim(both from coalesce(p_q, '')));
  v_limit int := least(greatest(coalesce(p_limit, 5), 1), 20);
begin
  if char_length(v_q) < 1 then
    return;
  end if;

  return query
  with candidates as (
    select
      p.id,
      public.profile_display_handle(p.username::text, p.global_handle::text) as display_handle,
      public.profile_avatar_preset(p.avatar_url) as preset,
      p.is_verified_creator as verified,
      lower(coalesce(p.username::text, p.global_handle::text)) as key_handle,
      case
        when lower(coalesce(p.username::text, p.global_handle::text)) = v_q then 300::real
        when lower(coalesce(p.username::text, '')) like v_q || '%' then 200::real
        when lower(p.global_handle::text) like v_q || '%' then 180::real
        else extensions.similarity(
          lower(coalesce(p.username::text, p.global_handle::text)),
          v_q
        ) * 100::real
      end as score
    from public.profiles p
    left join public.public_profiles_meta m on m.user_id = p.id
    where coalesce(m.is_hidden, false) = false
      and not public.profile_viewer_blocked(v_uid, p.id)
      and (
        lower(coalesce(p.username::text, '')) like v_q || '%'
        or lower(p.global_handle::text) like v_q || '%'
        or extensions.similarity(
             lower(coalesce(p.username::text, p.global_handle::text)),
             v_q
           ) >= 0.25
      )
  )
  select
    c.id,
    c.display_handle,
    c.preset,
    c.verified,
    c.score
  from candidates c
  order by
    case when c.key_handle like v_q || '%' then 0 else 1 end,
    c.score desc,
    c.display_handle asc
  limit v_limit;
end;
$$;

revoke all on function public.search_creators(text, integer) from public;
grant execute on function public.search_creators(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- upsert_my_profile_meta
-- ---------------------------------------------------------------------------

create or replace function public.upsert_my_profile_meta(
  p_bio text default null,
  p_links jsonb default null
)
returns public.public_profiles_meta
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bio text;
  v_links jsonb;
  v_row public.public_profiles_meta;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  if p_bio is null then
    v_bio := null;
  else
    v_bio := trim(both from p_bio);
    if v_bio = '' then
      v_bio := null;
    end if;
  end if;

  if v_bio is not null then
    if char_length(v_bio) > 280 then
      raise exception 'Bio must be 280 characters or fewer';
    end if;
    if public.username_contains_profanity(v_bio) then
      raise exception 'Bio not allowed';
    end if;
  end if;

  v_links := public.validate_profile_links(coalesce(p_links, '[]'::jsonb));

  insert into public.public_profiles_meta (user_id, bio, links, updated_at)
  values (v_uid, v_bio, v_links, now())
  on conflict (user_id) do update
    set bio = excluded.bio,
        links = excluded.links,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.upsert_my_profile_meta(text, jsonb) from public;
grant execute on function public.upsert_my_profile_meta(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- report / block / unblock
-- ---------------------------------------------------------------------------

create or replace function public.report_profile(p_key text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_reason text := trim(both from coalesce(p_reason, ''));
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;
  if char_length(v_reason) < 1 or char_length(v_reason) > 500 then
    raise exception 'Reason required';
  end if;

  v_target := public.resolve_profile_user_id(p_key);
  if v_target is null then
    raise exception 'Profile not found';
  end if;
  if v_target = v_uid then
    raise exception 'Cannot report yourself';
  end if;

  insert into public.profile_reports (reporter_id, target_id, reason)
  values (v_uid, v_target, v_reason);
end;
$$;

revoke all on function public.report_profile(text, text) from public;
grant execute on function public.report_profile(text, text) to authenticated;

create or replace function public.block_profile(p_key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  v_target := public.resolve_profile_user_id(p_key);
  if v_target is null then
    raise exception 'Profile not found';
  end if;
  if v_target = v_uid then
    raise exception 'Cannot block yourself';
  end if;

  insert into public.profile_blocks (blocker_id, blocked_id)
  values (v_uid, v_target)
  on conflict do nothing;
end;
$$;

revoke all on function public.block_profile(text) from public;
grant execute on function public.block_profile(text) to authenticated;

create or replace function public.unblock_profile(p_key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  v_target := public.resolve_profile_user_id(p_key);
  if v_target is null then
    raise exception 'Profile not found';
  end if;

  delete from public.profile_blocks
  where blocker_id = v_uid
    and blocked_id = v_target;
end;
$$;

revoke all on function public.unblock_profile(text) from public;
grant execute on function public.unblock_profile(text) to authenticated;

notify pgrst, 'reload schema';
