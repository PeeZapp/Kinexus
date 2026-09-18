-- Brickset is the LEGO fallback when BrickEconomy is blocked.

alter table public.finance_collectibles drop constraint if exists finance_collectibles_source_check;
alter table public.finance_collectibles add constraint finance_collectibles_source_check
  check (source in ('brickeconomy', 'brickset', 'pricecharting', 'discogs', 'stockx', 'chrono24', 'manual'));
