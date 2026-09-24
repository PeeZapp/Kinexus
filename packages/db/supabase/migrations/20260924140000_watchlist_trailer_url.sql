-- Store YouTube trailer links resolved from TMDB videos when a title is added.

alter table public.watchlist_titles
  add column if not exists trailer_url text;
