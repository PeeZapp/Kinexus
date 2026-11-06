-- Public link sharing for workouts and watchlist lists (independent of household visibility).
-- A private workout/list can still be shared via token with anyone who has the link.
-- Rotating share_token revokes older links; is_shared=false also breaks them.

alter table public.workouts
  add column if not exists share_token uuid;

alter table public.workouts
  add column if not exists is_shared boolean not null default false;

create unique index if not exists workouts_share_token_uidx
  on public.workouts (share_token)
  where share_token is not null;

alter table public.watchlist_lists
  add column if not exists share_token uuid;

alter table public.watchlist_lists
  add column if not exists is_shared boolean not null default false;

create unique index if not exists watchlist_lists_share_token_uidx
  on public.watchlist_lists (share_token)
  where share_token is not null;
