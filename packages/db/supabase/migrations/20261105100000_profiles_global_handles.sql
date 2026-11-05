-- Permanent global handles on profiles.
-- Domain (packages/domain) remains the source of truth for adjective/noun lists and
-- the profanity filter. SQL embeds the same pre-screened adj/noun arrays so
-- handle_new_user can generate without an edge function or a duplicated blocklist.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists global_handle extensions.citext,
  add column if not exists username extensions.citext,
  add column if not exists username_changed_at timestamptz,
  add column if not exists is_verified_creator boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_global_handle_key;

alter table public.profiles
  add constraint profiles_global_handle_key unique (global_handle);

alter table public.profiles
  drop constraint if exists profiles_username_key;

alter table public.profiles
  add constraint profiles_username_key unique (username);

-- ---------------------------------------------------------------------------
-- Normalise funny alias → permanent handle (Adjective-Noun-####)
-- ---------------------------------------------------------------------------

create or replace function public.normalize_alias_to_handle(p_alias text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  t text := trim(coalesce(p_alias, ''));
  m text[];
  adj text;
  noun text;
  handle text;
  reserved text[] := array['admin', 'kinexus', 'support', 'staff', 'official', 'moderator'];
begin
  if t ~ '^[A-Za-z]+-[A-Za-z]+-\d{4}$' then
    m := regexp_match(t, '^([A-Za-z]+)-([A-Za-z]+)-(\d{4})$');
  else
    m := regexp_match(t, '^([A-Za-z]+) ([A-Za-z]+) (\d{1,4})$');
    if m is null then
      return null;
    end if;
    t := m[1] || '-' || m[2] || '-' || lpad(m[3], 4, '0');
    m := regexp_match(t, '^([A-Za-z]+)-([A-Za-z]+)-(\d{4})$');
  end if;

  if m is null then
    return null;
  end if;

  adj := m[1];
  noun := m[2];
  if lower(adj) = any (reserved) or lower(noun) = any (reserved) then
    return null;
  end if;

  handle := adj || '-' || noun || '-' || m[3];
  return handle;
end;
$$;

-- ---------------------------------------------------------------------------
-- Generate Adjective-Noun-#### from curated lists (mirrors domain aliases.ts)
-- ---------------------------------------------------------------------------

create or replace function public.generate_permanent_handle()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  adjectives text[] := array[
    'Bouncy', 'Cosmic', 'Crispy', 'Dapper', 'Dizzy', 'Fuzzy', 'Giddy', 'Jolly',
    'Lucky', 'Merry', 'Nifty', 'Peppy', 'Quirky', 'Rusty', 'Snappy', 'Sunny',
    'Wobbly', 'Zesty', 'Brave', 'Calm', 'Chipper', 'Daring', 'Gentle', 'Happy',
    'Keen', 'Lively', 'Mighty', 'Nimble', 'Plucky', 'Quick', 'Radiant', 'Spry',
    'Swift', 'Upbeat', 'Vivid', 'Wily'
  ];
  nouns text[] := array[
    'Badger', 'Beaver', 'Bison', 'Corgi', 'Cricket', 'Dolphin', 'Falcon', 'Ferret',
    'Gecko', 'Heron', 'Koala', 'Llama', 'Mango', 'Narwhal', 'Otter', 'Panda',
    'Penguin', 'Puffin', 'Quokka', 'Raccoon', 'Seagull', 'Sloth', 'Sparrow', 'Turtle',
    'Wombat', 'Yak', 'Zebra', 'Axolotl', 'Bear', 'Fox', 'Hedgehog', 'Moose',
    'Owl', 'Rabbit', 'Tiger', 'Whale'
  ];
  adj text;
  noun text;
  n int;
begin
  adj := adjectives[1 + floor(random() * array_length(adjectives, 1))::int];
  noun := nouns[1 + floor(random() * array_length(nouns, 1))::int];
  n := floor(random() * 10000)::int;
  return adj || '-' || noun || '-' || lpad(n::text, 4, '0');
end;
$$;

create or replace function public.generate_unique_permanent_handle()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  candidate text;
  attempt int;
begin
  for attempt in 1..32 loop
    candidate := public.generate_permanent_handle();
    if not exists (
      select 1 from public.profiles where global_handle = candidate::extensions.citext
    ) then
      return candidate;
    end if;
  end loop;

  raise exception 'Could not generate a unique handle after 32 attempts';
end;
$$;

revoke all on function public.normalize_alias_to_handle(text) from public;
revoke all on function public.generate_permanent_handle() from public;
revoke all on function public.generate_unique_permanent_handle() from public;

-- ---------------------------------------------------------------------------
-- Backfill: prefer normalised watchlist alias (deduped), else generate
-- ---------------------------------------------------------------------------

with ranked as (
  select
    p.id as user_id,
    public.normalize_alias_to_handle(a.alias) as handle,
    row_number() over (
      partition by lower(public.normalize_alias_to_handle(a.alias))
      order by a.created_at asc nulls last, p.created_at asc, p.id asc
    ) as rn
  from public.profiles p
  inner join public.watchlist_social_aliases a on a.user_id = p.id
  where p.global_handle is null
    and public.normalize_alias_to_handle(a.alias) is not null
)
update public.profiles p
set global_handle = r.handle
from ranked r
where p.id = r.user_id
  and r.rn = 1
  and not exists (
    select 1
    from public.profiles other
    where other.global_handle = r.handle
  );

do $$
declare
  r record;
  candidate text;
begin
  for r in
    select id from public.profiles where global_handle is null order by created_at asc, id asc
  loop
    candidate := public.generate_unique_permanent_handle();
    update public.profiles
    set global_handle = candidate
    where id = r.id;
  end loop;
end;
$$;

alter table public.profiles
  alter column global_handle set not null;

-- ---------------------------------------------------------------------------
-- Reject any update to global_handle
-- ---------------------------------------------------------------------------

create or replace function public.profiles_global_handle_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.global_handle is distinct from old.global_handle then
    raise exception 'global_handle cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_global_handle_immutable on public.profiles;
create trigger profiles_global_handle_immutable
  before update on public.profiles
  for each row
  execute function public.profiles_global_handle_immutable();

-- ---------------------------------------------------------------------------
-- Assign a handle at account creation
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, email, global_handle)
  values (
    new.id,
    nullif(
      trim(
        coalesce(
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'name',
          split_part(coalesce(new.email, ''), '@', 1)
        )
      ),
      ''
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    new.email,
    public.generate_unique_permanent_handle()
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public profile lookup (does not open profiles RLS)
-- ---------------------------------------------------------------------------

create or replace function public.public_profile(handle_or_username text)
returns table (
  id uuid,
  global_handle extensions.citext,
  username extensions.citext,
  avatar_url text,
  is_verified_creator boolean
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p.id,
    p.global_handle,
    p.username,
    p.avatar_url,
    p.is_verified_creator
  from public.profiles p
  where p.global_handle = handle_or_username::extensions.citext
     or (
       p.username is not null
       and p.username = handle_or_username::extensions.citext
     )
  limit 1;
$$;

revoke all on function public.public_profile(text) from public;
grant execute on function public.public_profile(text) to authenticated;

-- Batch lookup by user id for global feeds (profiles RLS does not expose strangers).
create or replace function public.public_profiles(p_ids uuid[])
returns table (
  id uuid,
  global_handle extensions.citext,
  username extensions.citext,
  avatar_url text,
  is_verified_creator boolean
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p.id,
    p.global_handle,
    p.username,
    p.avatar_url,
    p.is_verified_creator
  from public.profiles p
  where p.id = any (p_ids);
$$;

revoke all on function public.public_profiles(uuid[]) from public;
grant execute on function public.public_profiles(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Acceptance checks (run at apply time)
-- ---------------------------------------------------------------------------

do $$
declare
  missing int;
  dupes int;
begin
  select count(*) into missing from public.profiles where global_handle is null;
  if missing > 0 then
    raise exception 'backfill failed: % profiles missing global_handle', missing;
  end if;

  select count(*) into dupes
  from (
    select lower(global_handle::text) as h
    from public.profiles
    group by 1
    having count(*) > 1
  ) d;
  if dupes > 0 then
    raise exception 'backfill failed: duplicate global_handle values';
  end if;
end;
$$;

do $$
declare
  v_id uuid;
  v_old text;
begin
  select id, global_handle::text into v_id, v_old from public.profiles limit 1;
  if v_id is null then
    raise notice 'profiles_global_handle_immutable: skipped (no profiles)';
    return;
  end if;

  begin
    update public.profiles
    set global_handle = 'Immutable-Test-9999'
    where id = v_id;
    raise exception 'expected global_handle update to be rejected';
  exception
    when raise_exception then
      if sqlerrm = 'expected global_handle update to be rejected' then
        raise;
      end if;
      if sqlerrm not like '%global_handle cannot be changed%' then
        raise;
      end if;
      -- trigger rejected the update — ok
  end;

  if not exists (
    select 1 from public.profiles where id = v_id and global_handle::text = v_old
  ) then
    raise exception 'global_handle changed unexpectedly';
  end if;
end;
$$;
