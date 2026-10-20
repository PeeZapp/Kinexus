-- Phase 1 household calendar: shared events with optional people and reminders.

create table public.household_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0 and char_length(title) <= 120),
  notes text not null default '' check (char_length(notes) <= 2000),
  location text not null default '' check (char_length(location) <= 160),
  all_day boolean not null default true,
  starts_on date not null,
  ends_on date not null,
  start_time time,
  end_time time,
  color text not null default 'teal'
    check (color in ('teal', 'amber', 'rose', 'sky', 'violet', 'coral')),
  remind_minutes integer check (remind_minutes is null or remind_minutes >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint household_events_range check (ends_on >= starts_on),
  constraint household_events_times check (
    (all_day = true and start_time is null and end_time is null)
    or (
      all_day = false
      and start_time is not null
      and end_time is not null
      and (starts_on < ends_on or end_time > start_time)
    )
  )
);

create index household_events_household_range_idx
  on public.household_events (household_id, starts_on, ends_on);

create table public.household_event_people (
  event_id uuid not null references public.household_events (id) on delete cascade,
  person_id uuid not null references public.household_people (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  primary key (event_id, person_id)
);

create index household_event_people_person_idx
  on public.household_event_people (person_id);

create index household_event_people_household_idx
  on public.household_event_people (household_id);

create or replace function public.household_event_guard()
returns trigger
language plpgsql
as $$
begin
  new.title := trim(new.title);
  new.notes := coalesce(new.notes, '');
  new.location := coalesce(trim(new.location), '');
  if new.all_day then
    new.start_time := null;
    new.end_time := null;
  end if;
  if new.ends_on < new.starts_on then
    raise exception 'Event end date must be on or after the start date';
  end if;
  return new;
end;
$$;

create trigger household_events_guard
  before insert or update on public.household_events
  for each row execute function public.household_event_guard();

create trigger household_events_set_updated_at
  before update on public.household_events
  for each row execute function public.set_updated_at();

create or replace function public.household_event_people_guard()
returns trigger
language plpgsql
as $$
declare
  v_event public.household_events%rowtype;
  v_person public.household_people%rowtype;
begin
  select * into v_event from public.household_events where id = new.event_id;
  if not found then
    raise exception 'Event not found';
  end if;
  if v_event.household_id <> new.household_id then
    raise exception 'Event person must belong to the same household as the event';
  end if;
  select * into v_person from public.household_people where id = new.person_id;
  if not found or v_person.household_id <> new.household_id then
    raise exception 'Person must belong to the same household';
  end if;
  return new;
end;
$$;

create trigger household_event_people_guard
  before insert or update on public.household_event_people
  for each row execute function public.household_event_people_guard();

grant select, insert, update, delete on table public.household_events to authenticated;
grant select, insert, update, delete on table public.household_event_people to authenticated;

alter table public.household_events enable row level security;
alter table public.household_event_people enable row level security;

create policy household_events_all on public.household_events
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy household_event_people_all on public.household_event_people
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
