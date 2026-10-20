-- Allow multiple Google accounts per Kinexus user for calendar sync.

alter table public.user_google_calendar
  add column if not exists id uuid,
  add column if not exists google_sub text;

update public.user_google_calendar
set id = gen_random_uuid()
where id is null;

alter table public.user_google_calendar
  alter column id set default gen_random_uuid(),
  alter column id set not null;

alter table public.user_google_calendar
  drop constraint if exists user_google_calendar_pkey;

alter table public.user_google_calendar
  add primary key (id);

create unique index if not exists user_google_calendar_user_sub_uidx
  on public.user_google_calendar (user_id, google_sub)
  where google_sub is not null;

create unique index if not exists user_google_calendar_user_email_uidx
  on public.user_google_calendar (user_id, lower(google_email))
  where google_email is not null;

create index if not exists user_google_calendar_user_idx
  on public.user_google_calendar (user_id);

alter table public.household_event_google_maps
  add column if not exists connection_id uuid references public.user_google_calendar (id) on delete cascade;

update public.household_event_google_maps as maps
set connection_id = conn.id
from public.user_google_calendar as conn
where maps.connection_id is null
  and conn.user_id = maps.user_id;

delete from public.household_event_google_maps
where connection_id is null;

alter table public.household_event_google_maps
  alter column connection_id set not null;

alter table public.household_event_google_maps
  drop constraint if exists household_event_google_maps_pkey;

alter table public.household_event_google_maps
  add primary key (household_event_id, connection_id);

create index if not exists household_event_google_maps_connection_idx
  on public.household_event_google_maps (connection_id);
