-- Remix sessions can run before anyone saves them into the workout library.
-- Rest games keep each person's best score for a game and rest length, plus a global top.

alter table public.workout_sessions
  add column remix_spec text,
  add column duration_min integer,
  add constraint workout_sessions_remix_spec_len check (remix_spec is null or char_length(remix_spec) <= 500),
  add constraint workout_sessions_duration_min_check check (duration_min is null or duration_min between 1 and 300);

create table public.rest_game_scores (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('quiz', 'memory')),
  rest_seconds integer not null check (rest_seconds in (60, 90, 120)),
  best_score integer not null check (best_score >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game, rest_seconds)
);

create or replace function public.rest_game_tops()
returns table (game text, rest_seconds integer, best_score integer)
language sql
stable
security definer
set search_path = public
as $$
  select s.game, s.rest_seconds, max(s.best_score)::integer as best_score
  from public.rest_game_scores s
  group by s.game, s.rest_seconds;
$$;

grant select, insert, update, delete on table public.rest_game_scores to authenticated;
grant execute on function public.rest_game_tops() to authenticated;

alter table public.rest_game_scores enable row level security;

create policy rest_game_scores_all on public.rest_game_scores
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
