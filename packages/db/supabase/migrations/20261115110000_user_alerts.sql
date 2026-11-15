-- In-app alerts: inbox + per-segment opt-out prefs.

do $$
begin
  -- Segment constraints (keep in sync with app constants).
  -- NOTE: This is duplicated across tables because Postgres CHECK constraints
  -- cannot be shared without a domain/enum (kept simple on purpose).
end;
$$;

create table public.user_alert_prefs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  segment text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, household_id, segment),
  constraint user_alert_prefs_segment check (
    segment in (
      'meal_plan',
      'calendar',
      'talk',
      'wishlist',
      'shopping',
      'checklist',
      'watchlist_available',
      'budget'
    )
  )
);

create trigger user_alert_prefs_set_updated_at
  before update on public.user_alert_prefs
  for each row execute function public.set_updated_at();

-- In-app inbox rows (one per recipient).
create table public.user_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  segment text not null,
  title text not null,
  body text,
  href text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_alerts_segment check (
    segment in (
      'meal_plan',
      'calendar',
      'talk',
      'wishlist',
      'shopping',
      'checklist',
      'watchlist_available',
      'budget'
    )
  )
);

create index user_alerts_user_created_idx on public.user_alerts (user_id, created_at desc);
create index user_alerts_user_unread_idx on public.user_alerts (user_id) where read_at is null;
create index user_alerts_household_created_idx on public.user_alerts (household_id, created_at desc);

-- Track watchlist availability per (user, title) to avoid duplicate alerts.
create table public.user_watchlist_availability (
  user_id uuid not null references public.profiles (id) on delete cascade,
  title_id uuid not null references public.watchlist_titles (id) on delete cascade,
  provider_ids integer[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id),
  constraint user_watchlist_availability_provider_ids check (
    cardinality(provider_ids) <= 48
    and 0 < all (provider_ids)
  )
);

create trigger user_watchlist_availability_set_updated_at
  before update on public.user_watchlist_availability
  for each row execute function public.set_updated_at();

-- Grants + RLS (prefs & inbox are user-owned).
grant select, insert, update, delete on table public.user_alert_prefs to authenticated;
grant select, update, delete on table public.user_alerts to authenticated;
grant select, insert, update, delete on table public.user_watchlist_availability to authenticated;

alter table public.user_alert_prefs enable row level security;
alter table public.user_alerts enable row level security;
alter table public.user_watchlist_availability enable row level security;

create policy user_alert_prefs_select on public.user_alert_prefs
  for select to authenticated
  using (user_id = auth.uid());

create policy user_alert_prefs_insert on public.user_alert_prefs
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create policy user_alert_prefs_update on public.user_alert_prefs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create policy user_alert_prefs_delete on public.user_alert_prefs
  for delete to authenticated
  using (user_id = auth.uid());

create policy user_alerts_select on public.user_alerts
  for select to authenticated
  using (user_id = auth.uid());

create policy user_alerts_update on public.user_alerts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_alerts_delete on public.user_alerts
  for delete to authenticated
  using (user_id = auth.uid());

create policy user_watchlist_availability_select on public.user_watchlist_availability
  for select to authenticated
  using (user_id = auth.uid());

create policy user_watchlist_availability_insert on public.user_watchlist_availability
  for insert to authenticated
  with check (user_id = auth.uid());

create policy user_watchlist_availability_update on public.user_watchlist_availability
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_watchlist_availability_delete on public.user_watchlist_availability
  for delete to authenticated
  using (user_id = auth.uid());

-- SECURITY DEFINER RPC: notify other household members (missing pref = enabled).
create or replace function public.notify_household_alert(
  p_household_id uuid,
  p_segment text,
  p_title text,
  p_body text default null,
  p_href text default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_household_id is null then
    raise exception 'household_id is required';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Not a member of this household';
  end if;

  if p_segment is null or trim(p_segment) = '' then
    raise exception 'segment is required';
  end if;

  insert into public.user_alerts (
    user_id,
    household_id,
    actor_user_id,
    segment,
    title,
    body,
    href,
    payload
  )
  select
    m.user_id,
    p_household_id,
    v_uid,
    p_segment,
    left(coalesce(nullif(trim(p_title), ''), 'Update'), 160),
    case when p_body is null then null else left(p_body, 400) end,
    case when p_href is null then null else left(p_href, 400) end,
    coalesce(p_payload, '{}'::jsonb)
  from public.household_members m
  left join public.user_alert_prefs pref
    on pref.user_id = m.user_id
   and pref.household_id = p_household_id
   and pref.segment = p_segment
  where m.household_id = p_household_id
    and m.user_id is distinct from v_uid
    and coalesce(pref.enabled, true) = true;
end;
$$;

revoke all on function public.notify_household_alert(uuid, text, text, text, text, jsonb) from public;
revoke all on function public.notify_household_alert(uuid, text, text, text, text, jsonb) from anon;
grant execute on function public.notify_household_alert(uuid, text, text, text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';

