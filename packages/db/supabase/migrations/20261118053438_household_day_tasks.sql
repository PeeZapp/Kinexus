-- Shared / assigned day tasks for Today (household-visible or member-assigned).
-- Personal-only tasks stay on public.user_days.tasks.

create table public.household_day_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  day date not null,
  label text not null
    check (char_length(trim(label)) > 0 and char_length(label) <= 120),
  done boolean not null default false,
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index household_day_tasks_household_day_idx
  on public.household_day_tasks (household_id, day);

create index household_day_tasks_household_open_idx
  on public.household_day_tasks (household_id, day)
  where done = false;

create or replace function public.household_day_task_guard()
returns trigger
language plpgsql
as $$
begin
  new.label := left(trim(regexp_replace(coalesce(new.label, ''), '\s+', ' ', 'g')), 120);
  if new.label = '' then
    raise exception 'Task cannot be empty';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.created_by := old.created_by;
  end if;
  if new.created_by is null then
    raise exception 'Task requires created_by';
  end if;
  if new.assigned_to is not null
     and not exists (
       select 1
       from public.household_members m
       where m.household_id = new.household_id
         and m.user_id = new.assigned_to
     ) then
    raise exception 'Assignee must be a household member';
  end if;
  return new;
end;
$$;

create trigger household_day_tasks_guard
  before insert or update on public.household_day_tasks
  for each row execute function public.household_day_task_guard();

create trigger household_day_tasks_set_updated_at
  before update on public.household_day_tasks
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.household_day_tasks to authenticated;

alter table public.household_day_tasks enable row level security;

create policy household_day_tasks_select on public.household_day_tasks
  for select to authenticated
  using (public.is_household_member(household_id));

create policy household_day_tasks_insert on public.household_day_tasks
  for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and created_by = auth.uid()
  );

create policy household_day_tasks_update on public.household_day_tasks
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy household_day_tasks_delete on public.household_day_tasks
  for delete to authenticated
  using (public.is_household_member(household_id));

alter table public.household_day_tasks replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.household_day_tasks;
  exception
    when duplicate_object then null;
  end;
end;
$$;

-- Optional segment so household task creates can notify the family.
alter table public.user_alert_prefs
  drop constraint if exists user_alert_prefs_segment;
alter table public.user_alert_prefs
  add constraint user_alert_prefs_segment check (
    segment in (
      'meal_plan',
      'calendar',
      'talk',
      'tasks',
      'wishlist',
      'shopping',
      'checklist',
      'watchlist_available',
      'budget',
      'investment_alert'
    )
  );

alter table public.user_alerts
  drop constraint if exists user_alerts_segment;
alter table public.user_alerts
  add constraint user_alerts_segment check (
    segment in (
      'meal_plan',
      'calendar',
      'talk',
      'tasks',
      'wishlist',
      'shopping',
      'checklist',
      'watchlist_available',
      'budget',
      'investment_alert'
    )
  );

notify pgrst, 'reload schema';
