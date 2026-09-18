-- Widen collectible kinds and catalog sources.

alter table public.finance_collectibles drop constraint if exists finance_collectibles_kind_check;
alter table public.finance_collectibles add constraint finance_collectibles_kind_check
  check (kind in (
    'lego',
    'minifig',
    'trading_card',
    'video_game',
    'comic',
    'funko',
    'coin',
    'vinyl',
    'sneaker',
    'watch',
    'other'
  ));

alter table public.finance_collectibles drop constraint if exists finance_collectibles_source_check;
alter table public.finance_collectibles add constraint finance_collectibles_source_check
  check (source in ('brickeconomy', 'pricecharting', 'discogs', 'stockx', 'chrono24', 'manual'));
