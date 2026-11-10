-- Book catalog cache for Readlist providers (server/service role only).

create table if not exists public.book_catalog_cache (
  provider text not null,
  key_hash text not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (provider, key_hash)
);

create index if not exists book_catalog_cache_expires_idx
  on public.book_catalog_cache (expires_at);

comment on table public.book_catalog_cache is
  'Forward cache for Open Library / Hardcover / Google Books catalog payloads. Service role only.';

alter table public.book_catalog_cache enable row level security;
-- No client policies: deny all for authenticated/anon. Service role bypasses RLS.
