-- Readlist: shared book catalog + household lists with work-level shelves (status).

-- ---------------------------------------------------------------------------
-- Catalog (shared; readable by authenticated; written only via RPC)
-- ---------------------------------------------------------------------------

create table public.readlist_works (
  id uuid primary key default gen_random_uuid(),
  ol_work_id text,
  isbn13 text,
  hardcover_id text,
  google_volume_id text,
  goodreads_id text,
  title text not null check (char_length(trim(title)) > 0),
  authors jsonb not null default '[]'::jsonb,
  cover_url text,
  first_published_year integer,
  created_at timestamptz not null default now()
);

create unique index readlist_works_ol_work_id_uidx
  on public.readlist_works (ol_work_id)
  where ol_work_id is not null;

create index readlist_works_isbn13_idx on public.readlist_works (isbn13)
  where isbn13 is not null;
create index readlist_works_hardcover_id_idx on public.readlist_works (hardcover_id)
  where hardcover_id is not null;
create index readlist_works_google_volume_id_idx on public.readlist_works (google_volume_id)
  where google_volume_id is not null;

create table public.readlist_editions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.readlist_works (id) on delete cascade,
  format text not null check (format in ('print', 'ebook', 'audiobook')),
  isbn10 text,
  isbn13 text,
  ol_edition_id text,
  asin text,
  pages integer check (pages is null or pages >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  publisher text,
  published_date text,
  created_at timestamptz not null default now()
);

create index readlist_editions_work_idx on public.readlist_editions (work_id);
create unique index readlist_editions_ol_edition_uidx
  on public.readlist_editions (ol_edition_id)
  where ol_edition_id is not null;

-- ---------------------------------------------------------------------------
-- Lists (visibility / sharing mirrors watchlist)
-- ---------------------------------------------------------------------------

create table public.readlist_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  visibility text not null default 'private'
    check (visibility in ('household', 'private', 'people', 'global')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index readlist_lists_household_idx on public.readlist_lists (household_id);
create unique index readlist_lists_default_uidx
  on public.readlist_lists (household_id, created_by)
  where is_default and created_by is not null;

create table public.readlist_list_people (
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.readlist_lists (id) on delete cascade,
  person_id uuid not null references public.household_people (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, person_id)
);

create index readlist_list_people_household_idx on public.readlist_list_people (household_id);

create table public.readlist_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.readlist_lists (id) on delete cascade,
  work_id uuid not null references public.readlist_works (id) on delete cascade,
  preferred_edition_id uuid references public.readlist_editions (id) on delete set null,
  status text not null default 'want_to_read'
    check (status in ('want_to_read', 'reading', 'finished')),
  added_by uuid references public.profiles (id) on delete set null,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, work_id)
);

create index readlist_items_list_idx on public.readlist_items (list_id);
create index readlist_items_work_idx on public.readlist_items (work_id);

create table public.readlist_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  work_id uuid not null references public.readlist_works (id) on delete cascade,
  edition_id uuid references public.readlist_editions (id) on delete set null,
  pages_read integer check (pages_read is null or pages_read >= 0),
  percent numeric(5, 2) check (percent is null or (percent >= 0 and percent <= 100)),
  seconds_listened integer check (seconds_listened is null or seconds_listened >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, work_id)
);

create index readlist_progress_work_idx on public.readlist_progress (work_id);

create table public.readlist_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  work_id uuid not null references public.readlist_works (id) on delete cascade,
  score smallint not null check (score between 1 and 10),
  body text check (body is null or char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_id)
);

create index readlist_reviews_work_idx on public.readlist_reviews (work_id);

-- ---------------------------------------------------------------------------
-- Guards / helpers
-- ---------------------------------------------------------------------------

create or replace function public.readlist_shared_with_me(_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.readlist_list_people rlp
    join public.household_people hp on hp.id = rlp.person_id
    where rlp.list_id = _list_id
      and hp.user_id = auth.uid()
  );
$$;

create or replace function public.can_view_readlist_list(_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.readlist_lists l
    where l.id = _list_id
      and (
        (l.visibility = 'global' and auth.uid() is not null)
        or public.can_view_shared(
          l.household_id,
          l.created_by,
          case when l.visibility = 'global' then 'household' else l.visibility end,
          public.readlist_shared_with_me(l.id)
        )
      )
  );
$$;

create or replace function public.can_manage_readlist_list(_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.readlist_lists l
    where l.id = _list_id
      and public.can_edit_shared(
        l.household_id,
        l.created_by,
        case when l.visibility = 'global' then 'household' else l.visibility end,
        public.readlist_shared_with_me(l.id),
        true
      )
  );
$$;

create or replace function public.readlist_list_guard()
returns trigger
language plpgsql
as $$
begin
  if new.visibility = 'private' and new.created_by is distinct from auth.uid() then
    raise exception 'Private readlists must belong to you';
  end if;
  if new.name is not null then
    new.name = trim(new.name);
  end if;
  return new;
end;
$$;

create trigger readlist_lists_guard
  before insert or update on public.readlist_lists
  for each row execute function public.readlist_list_guard();

create trigger readlist_lists_set_updated_at
  before update on public.readlist_lists
  for each row execute function public.set_updated_at();

create or replace function public.readlist_item_guard()
returns trigger
language plpgsql
as $$
declare
  v_work_id uuid;
begin
  if new.preferred_edition_id is not null then
    select e.work_id into v_work_id
    from public.readlist_editions e
    where e.id = new.preferred_edition_id;
    if not found or v_work_id is distinct from new.work_id then
      raise exception 'Preferred edition must belong to the item work';
    end if;
  end if;
  return new;
end;
$$;

create trigger readlist_items_guard
  before insert or update on public.readlist_items
  for each row execute function public.readlist_item_guard();

create trigger readlist_items_set_updated_at
  before update on public.readlist_items
  for each row execute function public.set_updated_at();

create or replace function public.readlist_progress_guard()
returns trigger
language plpgsql
as $$
declare
  v_work_id uuid;
begin
  if new.edition_id is not null then
    select e.work_id into v_work_id
    from public.readlist_editions e
    where e.id = new.edition_id;
    if not found or v_work_id is distinct from new.work_id then
      raise exception 'Progress edition must belong to the work';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger readlist_progress_guard
  before insert or update on public.readlist_progress
  for each row execute function public.readlist_progress_guard();

create or replace function public.readlist_review_guard()
returns trigger
language plpgsql
as $$
begin
  if new.body is not null then
    new.body = nullif(trim(new.body), '');
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger readlist_reviews_guard
  before insert or update on public.readlist_reviews
  for each row execute function public.readlist_review_guard();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.upsert_readlist_work(p_work jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_work_id uuid;
  v_ol text := nullif(trim(coalesce(p_work #>> '{ids,openLibraryWorkId}', p_work->>'id', '')), '');
  v_isbn13 text := nullif(trim(coalesce(p_work #>> '{ids,isbn13}', '')), '');
  v_hardcover text := nullif(trim(coalesce(p_work #>> '{ids,hardcoverId}', '')), '');
  v_google text := nullif(trim(coalesce(p_work #>> '{ids,googleVolumeId}', '')), '');
  v_goodreads text := nullif(trim(coalesce(p_work #>> '{ids,goodreadsId}', '')), '');
  v_title text := nullif(trim(coalesce(p_work->>'title', '')), '');
  v_cover text := nullif(trim(coalesce(p_work->>'coverUrl', '')), '');
  v_year integer := null;
  v_authors jsonb := coalesce(p_work->'authors', '[]'::jsonb);
  v_edition jsonb;
  v_edition_id uuid;
  v_ol_edition text;
  v_format text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_title is null then
    raise exception 'Work title is required';
  end if;

  begin
    v_year := nullif(trim(coalesce(p_work->>'firstPublishedYear', '')), '')::integer;
  exception when others then
    v_year := null;
  end;

  if v_ol is not null then
    select id into v_work_id from public.readlist_works where ol_work_id = v_ol;
  end if;
  if v_work_id is null and v_hardcover is not null then
    select id into v_work_id from public.readlist_works where hardcover_id = v_hardcover limit 1;
  end if;
  if v_work_id is null and v_google is not null then
    select id into v_work_id from public.readlist_works where google_volume_id = v_google limit 1;
  end if;
  if v_work_id is null and v_isbn13 is not null then
    select id into v_work_id from public.readlist_works where isbn13 = v_isbn13 limit 1;
  end if;

  if v_work_id is null then
    insert into public.readlist_works (
      ol_work_id, isbn13, hardcover_id, google_volume_id, goodreads_id,
      title, authors, cover_url, first_published_year
    ) values (
      v_ol, v_isbn13, v_hardcover, v_google, v_goodreads,
      v_title, v_authors, v_cover, v_year
    )
    returning id into v_work_id;
  else
    update public.readlist_works
    set
      ol_work_id = coalesce(ol_work_id, v_ol),
      isbn13 = coalesce(isbn13, v_isbn13),
      hardcover_id = coalesce(hardcover_id, v_hardcover),
      google_volume_id = coalesce(google_volume_id, v_google),
      goodreads_id = coalesce(goodreads_id, v_goodreads),
      title = case when char_length(trim(title)) > 0 then title else v_title end,
      authors = case when authors = '[]'::jsonb then v_authors else authors end,
      cover_url = coalesce(cover_url, v_cover),
      first_published_year = coalesce(first_published_year, v_year)
    where id = v_work_id;
  end if;

  if jsonb_typeof(p_work->'editions') = 'array' then
    for v_edition in select value from jsonb_array_elements(p_work->'editions')
    loop
      v_ol_edition := nullif(trim(coalesce(v_edition #>> '{ids,openLibraryEditionId}', '')), '');
      v_format := lower(nullif(trim(coalesce(v_edition->>'format', 'print')), ''));
      if v_format is null or v_format not in ('print', 'ebook', 'audiobook') then
        v_format := 'print';
      end if;

      v_edition_id := null;
      if v_ol_edition is not null then
        select id into v_edition_id
        from public.readlist_editions
        where ol_edition_id = v_ol_edition;
      end if;

      if v_edition_id is null then
        insert into public.readlist_editions (
          work_id, format, isbn10, isbn13, ol_edition_id, asin,
          pages, duration_seconds, publisher, published_date
        ) values (
          v_work_id,
          v_format,
          nullif(trim(coalesce(v_edition #>> '{ids,isbn10}', '')), ''),
          nullif(trim(coalesce(v_edition #>> '{ids,isbn13}', '')), ''),
          v_ol_edition,
          nullif(trim(coalesce(v_edition #>> '{ids,asin}', '')), ''),
          case
            when nullif(trim(coalesce(v_edition->>'pageCount', '')), '') is null then null
            else (v_edition->>'pageCount')::integer
          end,
          case
            when nullif(trim(coalesce(v_edition->>'durationSeconds', '')), '') is null then null
            else (v_edition->>'durationSeconds')::integer
          end,
          nullif(trim(coalesce(v_edition->>'publisher', '')), ''),
          case
            when v_edition->>'publishedYear' is not null then (v_edition->>'publishedYear')
            else nullif(trim(coalesce(v_edition->>'publishedDate', '')), '')
          end
        );
      else
        update public.readlist_editions
        set
          work_id = v_work_id,
          format = v_format,
          isbn10 = coalesce(isbn10, nullif(trim(coalesce(v_edition #>> '{ids,isbn10}', '')), '')),
          isbn13 = coalesce(isbn13, nullif(trim(coalesce(v_edition #>> '{ids,isbn13}', '')), '')),
          asin = coalesce(asin, nullif(trim(coalesce(v_edition #>> '{ids,asin}', '')), '')),
          pages = coalesce(pages, case
            when nullif(trim(coalesce(v_edition->>'pageCount', '')), '') is null then null
            else (v_edition->>'pageCount')::integer
          end),
          duration_seconds = coalesce(duration_seconds, case
            when nullif(trim(coalesce(v_edition->>'durationSeconds', '')), '') is null then null
            else (v_edition->>'durationSeconds')::integer
          end),
          publisher = coalesce(publisher, nullif(trim(coalesce(v_edition->>'publisher', '')), ''))
        where id = v_edition_id;
      end if;
    end loop;
  end if;

  return v_work_id;
end;
$$;

create or replace function public.ensure_default_readlist(p_household_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_list_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_household_member(p_household_id) then
    raise exception 'Not a household member';
  end if;

  select id into v_list_id
  from public.readlist_lists
  where household_id = p_household_id
    and created_by = v_uid
    and is_default
  limit 1;

  if v_list_id is not null then
    return v_list_id;
  end if;

  insert into public.readlist_lists (
    household_id, created_by, name, visibility, is_default
  ) values (
    p_household_id, v_uid, 'Reading list', 'private', true
  )
  returning id into v_list_id;

  return v_list_id;
end;
$$;

create or replace function public.add_readlist_item(
  p_list_id uuid,
  p_work_id uuid,
  p_preferred_edition_id uuid default null,
  p_status text default 'want_to_read'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item_id uuid;
  v_status text := coalesce(nullif(trim(p_status), ''), 'want_to_read');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.can_manage_readlist_list(p_list_id) then
    raise exception 'Cannot manage this readlist';
  end if;
  if not exists (select 1 from public.readlist_works where id = p_work_id) then
    raise exception 'Work not found';
  end if;
  if v_status not in ('want_to_read', 'reading', 'finished') then
    raise exception 'Invalid status';
  end if;

  insert into public.readlist_items (
    list_id, work_id, preferred_edition_id, status, added_by
  ) values (
    p_list_id, p_work_id, p_preferred_edition_id, v_status, v_uid
  )
  on conflict (list_id, work_id) do update
  set
    preferred_edition_id = coalesce(excluded.preferred_edition_id, public.readlist_items.preferred_edition_id),
    updated_at = now()
  returning id into v_item_id;

  return v_item_id;
end;
$$;

create or replace function public.update_readlist_item(
  p_item_id uuid,
  p_preferred_edition_id uuid default null,
  p_clear_preferred_edition boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_list_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select list_id into v_list_id from public.readlist_items where id = p_item_id;
  if not found then
    raise exception 'Item not found';
  end if;
  if not public.can_manage_readlist_list(v_list_id) then
    raise exception 'Cannot manage this readlist';
  end if;

  update public.readlist_items
  set
    preferred_edition_id = case
      when p_clear_preferred_edition then null
      when p_preferred_edition_id is not null then p_preferred_edition_id
      else preferred_edition_id
    end,
    updated_at = now()
  where id = p_item_id;

  return p_item_id;
end;
$$;

create or replace function public.remove_readlist_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_list_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select list_id into v_list_id from public.readlist_items where id = p_item_id;
  if not found then
    raise exception 'Item not found';
  end if;
  if not public.can_manage_readlist_list(v_list_id) then
    raise exception 'Cannot manage this readlist';
  end if;

  delete from public.readlist_items where id = p_item_id;
end;
$$;

create or replace function public.set_readlist_item_status(p_item_id uuid, p_status text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_list_id uuid;
  v_status text := nullif(trim(p_status), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_status is null or v_status not in ('want_to_read', 'reading', 'finished') then
    raise exception 'Invalid status';
  end if;

  select list_id into v_list_id from public.readlist_items where id = p_item_id;
  if not found then
    raise exception 'Item not found';
  end if;
  if not public.can_manage_readlist_list(v_list_id) then
    raise exception 'Cannot manage this readlist';
  end if;

  update public.readlist_items
  set status = v_status, updated_at = now()
  where id = p_item_id;

  return p_item_id;
end;
$$;

create or replace function public.upsert_readlist_progress(
  p_work_id uuid,
  p_edition_id uuid default null,
  p_pages_read integer default null,
  p_percent numeric default null,
  p_seconds_listened integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from public.readlist_works where id = p_work_id) then
    raise exception 'Work not found';
  end if;
  if p_percent is not null and (p_percent < 0 or p_percent > 100) then
    raise exception 'Percent must be between 0 and 100';
  end if;

  insert into public.readlist_progress (
    user_id, work_id, edition_id, pages_read, percent, seconds_listened
  ) values (
    v_uid, p_work_id, p_edition_id, p_pages_read, p_percent, p_seconds_listened
  )
  on conflict (user_id, work_id) do update
  set
    edition_id = coalesce(excluded.edition_id, public.readlist_progress.edition_id),
    pages_read = coalesce(excluded.pages_read, public.readlist_progress.pages_read),
    percent = coalesce(excluded.percent, public.readlist_progress.percent),
    seconds_listened = coalesce(excluded.seconds_listened, public.readlist_progress.seconds_listened),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.upsert_readlist_review(
  p_work_id uuid,
  p_score smallint,
  p_body text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_score is null or p_score < 1 or p_score > 10 then
    raise exception 'Score must be between 1 and 10';
  end if;
  if not exists (select 1 from public.readlist_works where id = p_work_id) then
    raise exception 'Work not found';
  end if;

  insert into public.readlist_reviews (user_id, work_id, score, body)
  values (v_uid, p_work_id, p_score, p_body)
  on conflict (user_id, work_id) do update
  set
    score = excluded.score,
    body = excluded.body,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.delete_readlist_review(p_work_id uuid)
returns void
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
  delete from public.readlist_reviews
  where user_id = v_uid and work_id = p_work_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants / RLS
-- ---------------------------------------------------------------------------

revoke all on function public.readlist_shared_with_me(uuid) from public;
revoke all on function public.readlist_shared_with_me(uuid) from anon;
grant execute on function public.readlist_shared_with_me(uuid) to authenticated;

revoke all on function public.can_view_readlist_list(uuid) from public;
revoke all on function public.can_view_readlist_list(uuid) from anon;
grant execute on function public.can_view_readlist_list(uuid) to authenticated;

revoke all on function public.can_manage_readlist_list(uuid) from public;
revoke all on function public.can_manage_readlist_list(uuid) from anon;
grant execute on function public.can_manage_readlist_list(uuid) to authenticated;

revoke all on function public.upsert_readlist_work(jsonb) from public;
revoke all on function public.upsert_readlist_work(jsonb) from anon;
grant execute on function public.upsert_readlist_work(jsonb) to authenticated;

revoke all on function public.ensure_default_readlist(uuid) from public;
revoke all on function public.ensure_default_readlist(uuid) from anon;
grant execute on function public.ensure_default_readlist(uuid) to authenticated;

revoke all on function public.add_readlist_item(uuid, uuid, uuid, text) from public;
revoke all on function public.add_readlist_item(uuid, uuid, uuid, text) from anon;
grant execute on function public.add_readlist_item(uuid, uuid, uuid, text) to authenticated;

revoke all on function public.update_readlist_item(uuid, uuid, boolean) from public;
revoke all on function public.update_readlist_item(uuid, uuid, boolean) from anon;
grant execute on function public.update_readlist_item(uuid, uuid, boolean) to authenticated;

revoke all on function public.remove_readlist_item(uuid) from public;
revoke all on function public.remove_readlist_item(uuid) from anon;
grant execute on function public.remove_readlist_item(uuid) to authenticated;

revoke all on function public.set_readlist_item_status(uuid, text) from public;
revoke all on function public.set_readlist_item_status(uuid, text) from anon;
grant execute on function public.set_readlist_item_status(uuid, text) to authenticated;

revoke all on function public.upsert_readlist_progress(uuid, uuid, integer, numeric, integer) from public;
revoke all on function public.upsert_readlist_progress(uuid, uuid, integer, numeric, integer) from anon;
grant execute on function public.upsert_readlist_progress(uuid, uuid, integer, numeric, integer) to authenticated;

revoke all on function public.upsert_readlist_review(uuid, smallint, text) from public;
revoke all on function public.upsert_readlist_review(uuid, smallint, text) from anon;
grant execute on function public.upsert_readlist_review(uuid, smallint, text) to authenticated;

revoke all on function public.delete_readlist_review(uuid) from public;
revoke all on function public.delete_readlist_review(uuid) from anon;
grant execute on function public.delete_readlist_review(uuid) to authenticated;

grant select on table public.readlist_works to authenticated;
grant select on table public.readlist_editions to authenticated;
grant select on table public.readlist_lists to authenticated;
grant select on table public.readlist_list_people to authenticated;
grant select on table public.readlist_items to authenticated;
grant select on table public.readlist_progress to authenticated;
grant select on table public.readlist_reviews to authenticated;

alter table public.readlist_works enable row level security;
alter table public.readlist_editions enable row level security;
alter table public.readlist_lists enable row level security;
alter table public.readlist_list_people enable row level security;
alter table public.readlist_items enable row level security;
alter table public.readlist_progress enable row level security;
alter table public.readlist_reviews enable row level security;

create policy readlist_works_select on public.readlist_works
  for select to authenticated
  using (auth.uid() is not null);

create policy readlist_editions_select on public.readlist_editions
  for select to authenticated
  using (auth.uid() is not null);

create policy readlist_lists_select on public.readlist_lists
  for select to authenticated
  using (public.can_view_readlist_list(id));

create policy readlist_list_people_select on public.readlist_list_people
  for select to authenticated
  using (public.can_view_readlist_list(list_id));

create policy readlist_items_select on public.readlist_items
  for select to authenticated
  using (public.can_view_readlist_list(list_id));

create policy readlist_progress_select on public.readlist_progress
  for select to authenticated
  using (user_id = auth.uid());

create policy readlist_reviews_select on public.readlist_reviews
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.readlist_items i
      where i.work_id = readlist_reviews.work_id
        and public.can_view_readlist_list(i.list_id)
    )
  );

-- No insert/update/delete policies: writes go through security definer RPCs.

alter table public.readlist_lists replica identity full;
alter table public.readlist_items replica identity full;
alter table public.readlist_progress replica identity full;
alter table public.readlist_reviews replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.readlist_lists;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.readlist_items;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.readlist_progress;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.readlist_reviews;
  exception
    when duplicate_object then null;
  end;
end;
$$;

notify pgrst, 'reload schema';
