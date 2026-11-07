-- Train plan calendar (7c): map plan days ↔ household_events + auto-sync flag.

alter table public.training_plans
  add column if not exists calendar_auto_sync boolean not null default false;

create table public.training_plan_day_events (
  training_plan_day_id uuid primary key
    references public.training_plan_days (id) on delete cascade,
  household_event_id uuid not null
    references public.household_events (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index training_plan_day_events_event_uidx
  on public.training_plan_day_events (household_event_id);

grant select, insert, update, delete on table public.training_plan_day_events to authenticated;

alter table public.training_plan_day_events enable row level security;

create policy training_plan_day_events_select on public.training_plan_day_events
  for select to authenticated
  using (
    public.can_view_training_plan(
      (select d.plan_id from public.training_plan_days d where d.id = training_plan_day_id)
    )
  );

create policy training_plan_day_events_mutate on public.training_plan_day_events
  for all to authenticated
  using (
    public.can_edit_training_plan(
      (select d.plan_id from public.training_plan_days d where d.id = training_plan_day_id)
    )
  )
  with check (
    public.can_edit_training_plan(
      (select d.plan_id from public.training_plan_days d where d.id = training_plan_day_id)
    )
  );

notify pgrst, 'reload schema';
