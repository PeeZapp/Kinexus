-- Public link sharing for wishlists (independent of household visibility).
-- A private list can still be shared via token with anyone who has the link.

alter table public.stash_lists
  add column if not exists share_token uuid;

alter table public.stash_lists
  add column if not exists is_shared boolean not null default false;

create unique index if not exists stash_lists_share_token_uidx
  on public.stash_lists (share_token)
  where share_token is not null;
