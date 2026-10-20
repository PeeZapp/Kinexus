-- Phase 2: per-user Google Calendar connection + household event push mapping.
-- Tokens are service-role only (API). Clients never SELECT refresh/access tokens.

create table public.user_google_calendar (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  google_email text,
  refresh_token text not null,
  access_token text,
  access_expires_at timestamptz,
  push_enabled boolean not null default true,
  push_calendar_id text,
  push_calendar_name text,
  pull_calendar_ids text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_google_calendar_refresh check (char_length(refresh_token) >= 8),
  constraint user_google_calendar_push_cal check (
    push_calendar_id is null or char_length(trim(push_calendar_id)) between 1 and 256
  )
);

create trigger user_google_calendar_set_updated_at
  before update on public.user_google_calendar
  for each row execute function public.set_updated_at();

alter table public.user_google_calendar enable row level security;

-- No policies for authenticated: only the service role (API) reads/writes tokens.

create table public.household_event_google_maps (
  household_event_id uuid not null references public.household_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  google_calendar_id text not null,
  google_event_id text not null,
  synced_at timestamptz not null default now(),
  primary key (household_event_id, user_id),
  constraint household_event_google_maps_cal check (char_length(trim(google_calendar_id)) between 1 and 256),
  constraint household_event_google_maps_evt check (char_length(trim(google_event_id)) between 1 and 256)
);

create index household_event_google_maps_user_idx
  on public.household_event_google_maps (user_id);

alter table public.household_event_google_maps enable row level security;

-- No policies for authenticated: sync mapping is API/service-role only.
