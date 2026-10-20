-- Global list presentation (blurb + sample posters), list ratings, and locked aliases.

alter table public.watchlist_lists
  add column if not exists blurb text
  check (blurb is null or char_length(trim(blurb)) between 1 and 280);

alter table public.watchlist_lists
  add column if not exists sample_poster_paths jsonb not null default '[]'::jsonb;

-- Aliases are assigned once and never changed (Reddit-style).
drop policy if exists watchlist_social_aliases_update on public.watchlist_social_aliases;
revoke update on table public.watchlist_social_aliases from authenticated;

create table if not exists public.watchlist_global_list_ratings (
  list_id uuid not null references public.watchlist_lists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score smallint not null check (score between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create index if not exists watchlist_global_list_ratings_list_idx
  on public.watchlist_global_list_ratings (list_id);

drop trigger if exists watchlist_global_list_ratings_set_updated_at on public.watchlist_global_list_ratings;
create trigger watchlist_global_list_ratings_set_updated_at
  before update on public.watchlist_global_list_ratings
  for each row execute function public.set_updated_at();

create or replace function public.watchlist_global_list_rating_guard()
returns trigger
language plpgsql
as $$
declare
  v_vis text;
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'You can only rate lists as yourself';
  end if;
  select visibility into v_vis from public.watchlist_lists where id = new.list_id;
  if v_vis is distinct from 'global' then
    raise exception 'Only globally shared lists can be rated';
  end if;
  return new;
end;
$$;

drop trigger if exists watchlist_global_list_ratings_guard on public.watchlist_global_list_ratings;
create trigger watchlist_global_list_ratings_guard
  before insert or update on public.watchlist_global_list_ratings
  for each row execute function public.watchlist_global_list_rating_guard();

grant select, insert, update, delete on table public.watchlist_global_list_ratings to authenticated;

alter table public.watchlist_global_list_ratings enable row level security;

create policy watchlist_global_list_ratings_select on public.watchlist_global_list_ratings
  for select to authenticated
  using (public.can_view_watchlist_list(list_id));

create policy watchlist_global_list_ratings_insert on public.watchlist_global_list_ratings
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_watchlist_list(list_id));

create policy watchlist_global_list_ratings_update on public.watchlist_global_list_ratings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy watchlist_global_list_ratings_delete on public.watchlist_global_list_ratings
  for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.watchlist_global_list_score(_list_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(avg(score)::numeric, 1)
  from public.watchlist_global_list_ratings
  where list_id = _list_id;
$$;

revoke all on function public.watchlist_global_list_score(uuid) from public;
grant execute on function public.watchlist_global_list_score(uuid) to authenticated;
