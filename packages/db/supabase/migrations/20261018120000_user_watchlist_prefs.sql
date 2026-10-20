-- Streaming services and recommendation scope belong to the signed-in user.

create table public.user_watchlist_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  provider_ids integer[] not null default '{}',
  recommend_scope text not null default 'all',
  updated_at timestamptz not null default now(),
  constraint user_watchlist_prefs_scope check (recommend_scope in ('all', 'subscribed')),
  constraint user_watchlist_prefs_providers check (
    cardinality(provider_ids) <= 24
    and 0 < all (provider_ids)
  )
);

create trigger user_watchlist_prefs_set_updated_at
  before update on public.user_watchlist_prefs
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.user_watchlist_prefs to authenticated;

alter table public.user_watchlist_prefs enable row level security;

create policy user_watchlist_prefs_select on public.user_watchlist_prefs
  for select to authenticated
  using (user_id = auth.uid());

create policy user_watchlist_prefs_insert on public.user_watchlist_prefs
  for insert to authenticated
  with check (user_id = auth.uid());

create policy user_watchlist_prefs_update on public.user_watchlist_prefs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_watchlist_prefs_delete on public.user_watchlist_prefs
  for delete to authenticated
  using (user_id = auth.uid());
