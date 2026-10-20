-- Public watched shelf for social profiles, plus title snapshots on global reviews.

alter table public.watchlist_global_reviews
  add column if not exists title text,
  add column if not exists year integer,
  add column if not exists poster_path text;

create table if not exists public.watchlist_public_watched (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tmdb_id integer not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null check (char_length(trim(title)) > 0),
  year integer,
  poster_path text,
  score smallint check (score is null or score between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

create index if not exists watchlist_public_watched_user_idx
  on public.watchlist_public_watched (user_id, updated_at desc);

drop trigger if exists watchlist_public_watched_set_updated_at on public.watchlist_public_watched;
create trigger watchlist_public_watched_set_updated_at
  before update on public.watchlist_public_watched
  for each row execute function public.set_updated_at();

create or replace function public.watchlist_public_watched_guard()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'You can only publish watched titles as yourself';
  end if;
  new.title = trim(new.title);
  return new;
end;
$$;

drop trigger if exists watchlist_public_watched_guard on public.watchlist_public_watched;
create trigger watchlist_public_watched_guard
  before insert or update on public.watchlist_public_watched
  for each row execute function public.watchlist_public_watched_guard();

grant select, insert, update, delete on table public.watchlist_public_watched to authenticated;

alter table public.watchlist_public_watched enable row level security;

create policy watchlist_public_watched_select on public.watchlist_public_watched
  for select to authenticated
  using (true);

create policy watchlist_public_watched_insert on public.watchlist_public_watched
  for insert to authenticated
  with check (user_id = auth.uid());

create policy watchlist_public_watched_update on public.watchlist_public_watched
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy watchlist_public_watched_delete on public.watchlist_public_watched
  for delete to authenticated
  using (user_id = auth.uid());
