-- Global list sharing, content audiences, funny aliases, and cross-household reviews.

-- ---------------------------------------------------------------------------
-- Lists: global visibility + audience ceiling
-- ---------------------------------------------------------------------------

alter table public.watchlist_lists drop constraint if exists watchlist_lists_visibility_check;

alter table public.watchlist_lists
  add constraint watchlist_lists_visibility_check
  check (visibility in ('household', 'private', 'people', 'global'));

alter table public.watchlist_lists
  add column if not exists audience text not null default '18+'
  check (audience in ('all', '7+', '13+', '16+', '18+'));

alter table public.watchlist_titles
  add column if not exists content_rating text,
  add column if not exists audience text
  check (audience is null or audience in ('all', '7+', '13+', '16+', '18+'));

create index if not exists watchlist_lists_global_idx
  on public.watchlist_lists (updated_at desc)
  where visibility = 'global';

-- ---------------------------------------------------------------------------
-- Access: any signed-in user can view global lists (age filter is app-side)
-- ---------------------------------------------------------------------------

create or replace function public.can_view_watchlist_list(_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.watchlist_lists l
    where l.id = _list_id
      and (
        (l.visibility = 'global' and auth.uid() is not null)
        or public.can_view_shared(
          l.household_id,
          l.created_by,
          case when l.visibility = 'global' then 'household' else l.visibility end,
          public.watchlist_shared_with_me(l.id)
        )
      )
  );
$$;

create or replace function public.can_manage_watchlist_list(_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.watchlist_lists l
    where l.id = _list_id
      and public.can_edit_shared(
        l.household_id,
        l.created_by,
        case when l.visibility = 'global' then 'household' else l.visibility end,
        public.watchlist_shared_with_me(l.id),
        true
      )
  );
$$;

drop policy if exists watchlist_lists_insert on public.watchlist_lists;
create policy watchlist_lists_insert on public.watchlist_lists
  for insert to authenticated
  with check (
    public.can_create_shared(household_id)
    and (
      visibility = 'household'
      or visibility = 'people'
      or visibility = 'global'
      or (visibility = 'private' and created_by = auth.uid())
    )
  );

drop policy if exists watchlist_lists_update on public.watchlist_lists;
create policy watchlist_lists_update on public.watchlist_lists
  for update to authenticated
  using (public.can_manage_watchlist_list(id))
  with check (
    public.can_create_shared(household_id)
    and (
      visibility = 'household'
      or visibility = 'people'
      or visibility = 'global'
      or (visibility = 'private' and created_by = auth.uid())
    )
  );

-- Titles on global lists are readable by any signed-in user.
drop policy if exists watchlist_titles_select on public.watchlist_titles;
create policy watchlist_titles_select on public.watchlist_titles
  for select to authenticated
  using (
    public.is_household_member(household_id)
    or exists (
      select 1
      from public.watchlist_items i
      join public.watchlist_lists l on l.id = i.list_id
      where i.title_id = watchlist_titles.id
        and l.visibility = 'global'
        and auth.uid() is not null
    )
  );

-- ---------------------------------------------------------------------------
-- Funny aliases (stable per user; never show real names on global reviews)
-- ---------------------------------------------------------------------------

create table if not exists public.watchlist_social_aliases (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  alias text not null unique check (char_length(trim(alias)) between 5 and 48),
  created_at timestamptz not null default now()
);

grant select, insert, update on table public.watchlist_social_aliases to authenticated;

alter table public.watchlist_social_aliases enable row level security;

create policy watchlist_social_aliases_select on public.watchlist_social_aliases
  for select to authenticated
  using (true);

create policy watchlist_social_aliases_insert on public.watchlist_social_aliases
  for insert to authenticated
  with check (user_id = auth.uid());

create policy watchlist_social_aliases_update on public.watchlist_social_aliases
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Global reviews (keyed by TMDB title, not household title row)
-- ---------------------------------------------------------------------------

create table if not exists public.watchlist_global_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tmdb_id integer not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('movie', 'tv')),
  score smallint not null check (score between 1 and 10),
  body text check (body is null or char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

create index if not exists watchlist_global_reviews_title_idx
  on public.watchlist_global_reviews (media_type, tmdb_id, updated_at desc);

create index if not exists watchlist_global_reviews_user_idx
  on public.watchlist_global_reviews (user_id, updated_at desc);

create or replace function public.watchlist_global_review_guard()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'You can only write reviews as yourself';
  end if;
  if new.body is not null then
    new.body = nullif(trim(new.body), '');
  end if;
  return new;
end;
$$;

drop trigger if exists watchlist_global_reviews_guard on public.watchlist_global_reviews;
create trigger watchlist_global_reviews_guard
  before insert or update on public.watchlist_global_reviews
  for each row execute function public.watchlist_global_review_guard();

drop trigger if exists watchlist_global_reviews_set_updated_at on public.watchlist_global_reviews;
create trigger watchlist_global_reviews_set_updated_at
  before update on public.watchlist_global_reviews
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.watchlist_global_reviews to authenticated;

alter table public.watchlist_global_reviews enable row level security;

create policy watchlist_global_reviews_select on public.watchlist_global_reviews
  for select to authenticated
  using (true);

create policy watchlist_global_reviews_insert on public.watchlist_global_reviews
  for insert to authenticated
  with check (user_id = auth.uid());

create policy watchlist_global_reviews_update on public.watchlist_global_reviews
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy watchlist_global_reviews_delete on public.watchlist_global_reviews
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Thumbs on global reviews
-- ---------------------------------------------------------------------------

create table if not exists public.watchlist_global_review_votes (
  review_id uuid not null references public.watchlist_global_reviews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index if not exists watchlist_global_review_votes_user_idx
  on public.watchlist_global_review_votes (user_id);

grant select, insert, update, delete on table public.watchlist_global_review_votes to authenticated;

alter table public.watchlist_global_review_votes enable row level security;

create policy watchlist_global_review_votes_select on public.watchlist_global_review_votes
  for select to authenticated
  using (true);

create policy watchlist_global_review_votes_insert on public.watchlist_global_review_votes
  for insert to authenticated
  with check (user_id = auth.uid());

create policy watchlist_global_review_votes_update on public.watchlist_global_review_votes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy watchlist_global_review_votes_delete on public.watchlist_global_review_votes
  for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.watchlist_global_score(_tmdb_id integer, _media_type text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(avg(score)::numeric, 1)
  from public.watchlist_global_reviews
  where tmdb_id = _tmdb_id
    and media_type = _media_type;
$$;

revoke all on function public.watchlist_global_score(integer, text) from public;
grant execute on function public.watchlist_global_score(integer, text) to authenticated;

alter table public.watchlist_global_reviews replica identity full;
alter table public.watchlist_global_review_votes replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.watchlist_global_reviews;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.watchlist_global_review_votes;
  exception
    when duplicate_object then null;
  end;
end;
$$;
