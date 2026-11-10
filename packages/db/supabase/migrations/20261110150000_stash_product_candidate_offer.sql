-- Cheaper-find candidate + previous offer fields on wishlist products.
-- Same RLS as stash_products (column-level access inherits table policies).

alter table public.stash_products
  add column if not exists candidate_source_url text,
  add column if not exists candidate_price numeric,
  add column if not exists candidate_store_name text,
  add column if not exists candidate_currency text
    check (candidate_currency is null or candidate_currency = 'AUD'),
  add column if not exists previous_source_url text,
  add column if not exists previous_price numeric,
  add column if not exists previous_store_name text;

comment on column public.stash_products.candidate_source_url is
  'Cheaper-find candidate listing URL; does not overwrite source_url until Switch.';
comment on column public.stash_products.candidate_price is
  'Cheaper-find candidate price (AUD); Switch promotes it to current_price.';
comment on column public.stash_products.previous_source_url is
  'Prior source_url retained when a candidate offer is switched in.';
