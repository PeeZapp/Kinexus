-- Per-day plan visibility: each training_plan_days row can be Family / All / etc.

alter table public.training_plan_days
  add column if not exists visibility text not null default 'private',
  add column if not exists audience_person_ids uuid[] not null default '{}'::uuid[];

alter table public.training_plan_days drop constraint if exists training_plan_days_visibility_check;
alter table public.training_plan_days
  add constraint training_plan_days_visibility_check
  check (
    visibility in (
      'private',
      'household',
      'people',
      'buddies',
      'buddies_selected',
      'all',
      'global'
    )
  );

-- Backfill from plan-level visibility so existing shares keep working day-by-day.
update public.training_plan_days d
set
  visibility = p.visibility,
  audience_person_ids = coalesce(p.audience_person_ids, '{}'::uuid[])
from public.training_plans p
where p.id = d.plan_id;

create table if not exists public.training_plan_day_buddy_shares (
  day_id uuid not null references public.training_plan_days (id) on delete cascade,
  buddy_user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  primary key (day_id, buddy_user_id)
);

create index if not exists training_plan_day_buddy_shares_buddy_idx
  on public.training_plan_day_buddy_shares (buddy_user_id);

-- Copy plan buddy picks onto every existing day for that plan.
insert into public.training_plan_day_buddy_shares (day_id, buddy_user_id, household_id)
select d.id, s.buddy_user_id, s.household_id
from public.training_plan_buddy_shares s
join public.training_plan_days d on d.plan_id = s.plan_id
on conflict do nothing;

create or replace function public.training_plan_day_audience_shared_with_me(_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.training_plan_days d
    join public.household_people hp on hp.id = any (d.audience_person_ids)
    where d.id = _day_id
      and hp.user_id = auth.uid()
  );
$$;

create or replace function public.training_plan_day_buddy_shared_with_me(_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.training_plan_day_buddy_shares s
    where s.day_id = _day_id
      and s.buddy_user_id = auth.uid()
  );
$$;

create or replace function public.training_plan_day_buddy_share_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_household uuid;
  v_owner uuid;
begin
  select p.household_id, p.owner_id into v_household, v_owner
  from public.training_plan_days d
  join public.training_plans p on p.id = d.plan_id
  where d.id = new.day_id;

  if v_household is null or v_household is distinct from new.household_id then
    raise exception 'Buddy share must belong to the plan household';
  end if;

  if v_owner is null or v_owner = new.buddy_user_id then
    raise exception 'Invalid buddy share target';
  end if;

  if not public.are_train_buddies(v_owner, new.buddy_user_id) then
    raise exception 'Buddy share requires an accepted train buddy connection';
  end if;

  return new;
end;
$$;

drop trigger if exists training_plan_day_buddy_shares_guard on public.training_plan_day_buddy_shares;
create trigger training_plan_day_buddy_shares_guard
  before insert or update on public.training_plan_day_buddy_shares
  for each row execute function public.training_plan_day_buddy_share_guard();

create or replace function public.can_view_training_plan_day(_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.training_plan_days d
    join public.training_plans p on p.id = d.plan_id
    where d.id = _day_id
      and (
        p.owner_id is not distinct from auth.uid()
        or (
          d.visibility = 'global'
          and auth.uid() is not null
        )
        or public.can_view_shared(
          p.household_id,
          p.owner_id,
          case
            when d.visibility in ('buddies', 'buddies_selected', 'global') then 'private'
            when d.visibility = 'all' then 'household'
            else d.visibility
          end,
          public.training_plan_day_audience_shared_with_me(d.id)
        )
        or (
          d.visibility in ('buddies', 'all')
          and public.buddy_can(p.owner_id, auth.uid(), 'can_view_plan')
        )
        or (
          d.visibility = 'buddies_selected'
          and public.training_plan_day_buddy_shared_with_me(d.id)
          and public.buddy_can(p.owner_id, auth.uid(), 'can_view_plan')
        )
        or (
          public.is_household_member(p.household_id)
          and exists (
            select 1
            from public.user_train_prefs prefs
            where prefs.user_id = p.owner_id
              and prefs.family_plan_share in ('plan', 'plan_activity')
          )
        )
      )
  );
$$;

-- Plan is visible if you own it, family-share prefs expose it, or any day is visible to you.
create or replace function public.can_view_training_plan(_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.training_plans p
    where p.id = _plan_id
      and (
        p.owner_id is not distinct from auth.uid()
        or (
          public.is_household_member(p.household_id)
          and exists (
            select 1
            from public.user_train_prefs prefs
            where prefs.user_id = p.owner_id
              and prefs.family_plan_share in ('plan', 'plan_activity')
          )
        )
        or exists (
          select 1
          from public.training_plan_days d
          where d.plan_id = p.id
            and public.can_view_training_plan_day(d.id)
        )
      )
  );
$$;

grant select, insert, update, delete on table public.training_plan_day_buddy_shares to authenticated;
alter table public.training_plan_day_buddy_shares enable row level security;

revoke all on function public.training_plan_day_audience_shared_with_me(uuid) from public;
revoke all on function public.training_plan_day_buddy_shared_with_me(uuid) from public;
revoke all on function public.can_view_training_plan_day(uuid) from public;
grant execute on function public.training_plan_day_audience_shared_with_me(uuid) to authenticated;
grant execute on function public.training_plan_day_buddy_shared_with_me(uuid) to authenticated;
grant execute on function public.can_view_training_plan_day(uuid) to authenticated;

drop policy if exists training_plan_days_select on public.training_plan_days;
create policy training_plan_days_select on public.training_plan_days
  for select to authenticated
  using (public.can_view_training_plan_day(id));

drop policy if exists training_plan_day_buddy_shares_select on public.training_plan_day_buddy_shares;
create policy training_plan_day_buddy_shares_select on public.training_plan_day_buddy_shares
  for select to authenticated
  using (public.can_view_training_plan_day(day_id));

drop policy if exists training_plan_day_buddy_shares_mutate on public.training_plan_day_buddy_shares;
create policy training_plan_day_buddy_shares_mutate on public.training_plan_day_buddy_shares
  for all to authenticated
  using (
    public.can_edit_training_plan(
      (select d.plan_id from public.training_plan_days d where d.id = day_id)
    )
  )
  with check (
    public.can_edit_training_plan(
      (select d.plan_id from public.training_plan_days d where d.id = day_id)
    )
  );

drop policy if exists training_plan_day_events_select on public.training_plan_day_events;
create policy training_plan_day_events_select on public.training_plan_day_events
  for select to authenticated
  using (public.can_view_training_plan_day(training_plan_day_id));

notify pgrst, 'reload schema';
