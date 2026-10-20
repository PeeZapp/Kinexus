-- Daily puzzle desk progress, and the puzzles card on Today.

alter table public.user_overview drop constraint if exists user_overview_widgets_known;

alter table public.user_overview add constraint user_overview_widgets_known check (
  widgets <@ array['weather', 'news', 'wordle', 'puzzles']::text[]
  and cardinality(widgets) = (
    (array['weather']::text[] <@ widgets)::integer
    + (array['news']::text[] <@ widgets)::integer
    + (array['wordle']::text[] <@ widgets)::integer
    + (array['puzzles']::text[] <@ widgets)::integer
  )
);

update public.user_overview
set widgets = widgets || array['puzzles']::text[]
where not (widgets @> array['puzzles']::text[]);

create table if not exists public.user_puzzle_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  played_on date not null,
  game text not null,
  state jsonb not null default '{}'::jsonb,
  primary key (user_id, played_on, game),
  constraint user_puzzle_days_game check (
    game in ('crossword', 'groups', 'sudoku', 'memory', 'logic', 'pattern')
  )
);

grant select, insert, update, delete on table public.user_puzzle_days to authenticated;

alter table public.user_puzzle_days enable row level security;

drop policy if exists user_puzzle_days_select on public.user_puzzle_days;
drop policy if exists user_puzzle_days_insert on public.user_puzzle_days;
drop policy if exists user_puzzle_days_update on public.user_puzzle_days;
drop policy if exists user_puzzle_days_delete on public.user_puzzle_days;

create policy user_puzzle_days_select on public.user_puzzle_days
  for select to authenticated
  using (user_id = auth.uid());

create policy user_puzzle_days_insert on public.user_puzzle_days
  for insert to authenticated
  with check (user_id = auth.uid());

create policy user_puzzle_days_update on public.user_puzzle_days
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_puzzle_days_delete on public.user_puzzle_days
  for delete to authenticated
  using (user_id = auth.uid());
