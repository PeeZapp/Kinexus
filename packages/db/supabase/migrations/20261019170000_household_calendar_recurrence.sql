-- Recurring household calendar events (series expands in the app).

alter table public.household_events
  add column if not exists recurrence text not null default 'none';

alter table public.household_events
  drop constraint if exists household_events_recurrence_check;

alter table public.household_events
  add constraint household_events_recurrence_check
  check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly'));

alter table public.household_events
  add column if not exists until_on date;

alter table public.household_events
  drop constraint if exists household_events_until_check;

alter table public.household_events
  add constraint household_events_until_check
  check (until_on is null or until_on >= starts_on);

create or replace function public.household_event_guard()
returns trigger
language plpgsql
as $$
begin
  new.title := trim(new.title);
  new.notes := coalesce(new.notes, '');
  new.location := coalesce(trim(new.location), '');
  new.recurrence := coalesce(new.recurrence, 'none');
  if new.all_day then
    new.start_time := null;
    new.end_time := null;
  end if;
  if new.recurrence = 'none' then
    new.until_on := null;
  end if;
  if new.ends_on < new.starts_on then
    raise exception 'Event end date must be on or after the start date';
  end if;
  if new.until_on is not null and new.until_on < new.starts_on then
    raise exception 'Series end must be on or after the start date';
  end if;
  return new;
end;
$$;
