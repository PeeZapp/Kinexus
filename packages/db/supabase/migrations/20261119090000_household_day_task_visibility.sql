-- Per-task viewers: household-wide, or a tagged subset of members.
-- Replaces assigned_to (assignment proxy) with visibility + visible_to.

alter table public.household_day_tasks
  add column if not exists visibility text not null default 'household',
  add column if not exists visible_to uuid[] not null default '{}'::uuid[];

alter table public.household_day_tasks
  drop constraint if exists household_day_tasks_visibility_check;
alter table public.household_day_tasks
  add constraint household_day_tasks_visibility_check
    check (visibility in ('household', 'people'));

-- Backfill from assigned_to when present.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'household_day_tasks'
      and column_name = 'assigned_to'
  ) then
    update public.household_day_tasks
    set
      visibility = 'people',
      visible_to = array[assigned_to]
    where assigned_to is not null
      and visibility = 'household'
      and cardinality(visible_to) = 0;

    alter table public.household_day_tasks drop column assigned_to;
  end if;
end;
$$;

create or replace function public.can_view_household_day_task(
  _household_id uuid,
  _created_by uuid,
  _visibility text,
  _visible_to uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_household_member(_household_id)
    and (
      _created_by is not distinct from auth.uid()
      or _visibility = 'household'
      or (
        _visibility = 'people'
        and auth.uid() = any (coalesce(_visible_to, '{}'::uuid[]))
      )
    );
$$;

revoke all on function public.can_view_household_day_task(uuid, uuid, text, uuid[]) from public;
revoke all on function public.can_view_household_day_task(uuid, uuid, text, uuid[]) from anon;
grant execute on function public.can_view_household_day_task(uuid, uuid, text, uuid[]) to authenticated;

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

  if new.visibility is null or new.visibility not in ('household', 'people') then
    raise exception 'Invalid task visibility';
  end if;

  new.visible_to := coalesce(new.visible_to, '{}'::uuid[]);
  -- Creator always sees via created_by; keep them out of the tagged list.
  new.visible_to := array(
    select distinct x
    from unnest(new.visible_to) as x
    where x is not null
      and x is distinct from new.created_by
  );

  if new.visibility = 'household' then
    new.visible_to := '{}'::uuid[];
  elsif cardinality(new.visible_to) = 0 then
    raise exception 'Tag at least one other person, or keep the task private';
  end if;

  if exists (
    select 1
    from unnest(new.visible_to) as viewer(user_id)
    where not exists (
      select 1
      from public.household_members m
      where m.household_id = new.household_id
        and m.user_id = viewer.user_id
    )
  ) then
    raise exception 'Viewers must be household members';
  end if;

  return new;
end;
$$;

drop policy if exists household_day_tasks_select on public.household_day_tasks;
drop policy if exists household_day_tasks_insert on public.household_day_tasks;
drop policy if exists household_day_tasks_update on public.household_day_tasks;
drop policy if exists household_day_tasks_delete on public.household_day_tasks;

create policy household_day_tasks_select on public.household_day_tasks
  for select to authenticated
  using (
    public.can_view_household_day_task(household_id, created_by, visibility, visible_to)
  );

create policy household_day_tasks_insert on public.household_day_tasks
  for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and created_by = auth.uid()
    and (
      visibility = 'household'
      or (
        visibility = 'people'
        and cardinality(coalesce(visible_to, '{}'::uuid[])) > 0
      )
    )
  );

create policy household_day_tasks_update on public.household_day_tasks
  for update to authenticated
  using (
    public.can_view_household_day_task(household_id, created_by, visibility, visible_to)
  )
  with check (
    public.can_view_household_day_task(household_id, created_by, visibility, visible_to)
  );

create policy household_day_tasks_delete on public.household_day_tasks
  for delete to authenticated
  using (
    public.can_view_household_day_task(household_id, created_by, visibility, visible_to)
  );

notify pgrst, 'reload schema';
