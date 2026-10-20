-- Curated topic lists for Sport, Film, Music, Fashion, Gaming, and Business news.

alter table public.user_overview
  add column if not exists news_topic_priorities jsonb not null default '{}'::jsonb;

update public.user_overview
set news_topic_priorities = jsonb_build_object('sport', to_jsonb(sport_priorities))
where cardinality(sport_priorities) > 0
  and coalesce(news_topic_priorities, '{}'::jsonb) = '{}'::jsonb;

alter table public.user_overview drop constraint if exists user_overview_news_topic_priorities_object;

alter table public.user_overview add constraint user_overview_news_topic_priorities_object check (
  jsonb_typeof(news_topic_priorities) = 'object'
);
