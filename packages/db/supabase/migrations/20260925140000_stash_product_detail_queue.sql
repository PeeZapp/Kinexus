-- Wishlist items whose first fetch had no price wait for the daily browser scrape.

alter table public.stash_products
  add column detail_status text not null default 'ready'
    check (detail_status in ('ready', 'pending')),
  add column detail_attempts integer not null default 0
    check (detail_attempts >= 0),
  add column detail_checked_on date;

create index stash_products_detail_pending_idx
  on public.stash_products (created_at)
  where detail_status = 'pending';
