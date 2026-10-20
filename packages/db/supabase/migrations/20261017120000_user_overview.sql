-- Personal daily overview. Cards, weather place, and news categories belong to
-- the signed-in user, not the household.

create table public.user_overview (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  widgets text[] not null default '{}',
  weather_label text,
  weather_latitude double precision,
  weather_longitude double precision,
  weather_timezone text,
  news_categories text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint user_overview_widgets_known check (
    widgets <@ array['weather', 'news']::text[]
    and cardinality(widgets) = (
      (array['weather']::text[] <@ widgets)::integer
      + (array['news']::text[] <@ widgets)::integer
    )
  ),
  constraint user_overview_news_known check (
    news_categories <@ array[
      'top',
      'australia',
      'world',
      'business',
      'technology',
      'science',
      'health',
      'sport',
      'culture'
    ]::text[]
    and cardinality(news_categories) = (
      (array['top']::text[] <@ news_categories)::integer
      + (array['australia']::text[] <@ news_categories)::integer
      + (array['world']::text[] <@ news_categories)::integer
      + (array['business']::text[] <@ news_categories)::integer
      + (array['technology']::text[] <@ news_categories)::integer
      + (array['science']::text[] <@ news_categories)::integer
      + (array['health']::text[] <@ news_categories)::integer
      + (array['sport']::text[] <@ news_categories)::integer
      + (array['culture']::text[] <@ news_categories)::integer
    )
  ),
  constraint user_overview_weather_label check (
    weather_label is null or char_length(trim(weather_label)) between 1 and 120
  ),
  constraint user_overview_weather_coords check (
    (
      weather_latitude is null
      and weather_longitude is null
    )
    or (
      weather_latitude between -90 and 90
      and weather_longitude between -180 and 180
    )
  )
);

create trigger user_overview_set_updated_at
  before update on public.user_overview
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.user_overview to authenticated;

alter table public.user_overview enable row level security;

create policy user_overview_select on public.user_overview
  for select to authenticated
  using (user_id = auth.uid());

create policy user_overview_insert on public.user_overview
  for insert to authenticated
  with check (user_id = auth.uid());

create policy user_overview_update on public.user_overview
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_overview_delete on public.user_overview
  for delete to authenticated
  using (user_id = auth.uid());
