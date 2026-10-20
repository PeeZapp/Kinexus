-- Free-text news interests, and a personal daily Wordle record.
-- Interests and guesses belong to the signed-in user.
-- Safe to re-run: the previous attempt stopped because some rows still had 9 categories.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_overview'
      and column_name = 'news_categories'
  ) then
    alter table public.user_overview drop constraint if exists user_overview_news_known;

    update public.user_overview u
    set news_categories = mapped.items
    from (
      select
        o.user_id,
        array_agg(
          case lower(t.item)
            when 'top' then 'Top stories'
            when 'australia' then 'Australia'
            when 'world' then 'World'
            when 'business' then 'Business'
            when 'technology' then 'Technology'
            when 'science' then 'Science'
            when 'health' then 'Health'
            when 'sport' then 'Sport'
            when 'culture' then 'Culture'
            else t.item
          end
          order by t.ord
        ) filter (where t.ord <= 8) as items
      from public.user_overview o
      cross join lateral unnest(o.news_categories) with ordinality as t(item, ord)
      group by o.user_id
    ) mapped
    where u.user_id = mapped.user_id;

    alter table public.user_overview rename column news_categories to news_interests;
  end if;
end $$;

update public.user_overview
set news_interests = coalesce((
  select array_agg(limited.item order by limited.ord)
  from (
    select t.item, t.ord
    from unnest(news_interests) with ordinality as t(item, ord)
    where t.ord <= 8
  ) limited
), '{}')
where cardinality(news_interests) > 8;

alter table public.user_overview drop constraint if exists user_overview_widgets_known;

alter table public.user_overview add constraint user_overview_widgets_known check (
  widgets <@ array['weather', 'news', 'wordle']::text[]
  and cardinality(widgets) = (
    (array['weather']::text[] <@ widgets)::integer
    + (array['news']::text[] <@ widgets)::integer
    + (array['wordle']::text[] <@ widgets)::integer
  )
);

alter table public.user_overview drop constraint if exists user_overview_interests_count;

alter table public.user_overview add constraint user_overview_interests_count check (
  cardinality(news_interests) <= 8
);

create table if not exists public.user_wordle_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  played_on date not null,
  guesses text[] not null default '{}',
  primary key (user_id, played_on),
  constraint user_wordle_guess_count check (cardinality(guesses) <= 6)
);

grant select, insert, update, delete on table public.user_wordle_days to authenticated;

alter table public.user_wordle_days enable row level security;

drop policy if exists user_wordle_days_select on public.user_wordle_days;
drop policy if exists user_wordle_days_insert on public.user_wordle_days;
drop policy if exists user_wordle_days_update on public.user_wordle_days;
drop policy if exists user_wordle_days_delete on public.user_wordle_days;

create policy user_wordle_days_select on public.user_wordle_days
  for select to authenticated
  using (user_id = auth.uid());

create policy user_wordle_days_insert on public.user_wordle_days
  for insert to authenticated
  with check (user_id = auth.uid());

create policy user_wordle_days_update on public.user_wordle_days
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_wordle_days_delete on public.user_wordle_days
  for delete to authenticated
  using (user_id = auth.uid());
