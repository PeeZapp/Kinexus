-- Let Sport news readers rank the sports they care about most.

alter table public.user_overview
  add column if not exists sport_priorities text[] not null default '{}';

alter table public.user_overview drop constraint if exists user_overview_sport_priorities_count;

alter table public.user_overview add constraint user_overview_sport_priorities_count check (
  cardinality(sport_priorities) <= 6
);
