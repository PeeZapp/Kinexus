-- Official / system global workouts (owned by no account; seeded via SQL).
-- Clients cannot create or mutate is_system rows; ratings on global system rows still work.

alter table public.workouts
  add column if not exists is_system boolean not null default false,
  add column if not exists description text null;

alter table public.workouts
  alter column household_id drop not null;

alter table public.workouts drop constraint if exists workouts_household_system_check;
alter table public.workouts
  add constraint workouts_household_system_check
  check (is_system or household_id is not null);

alter table public.workouts drop constraint if exists workouts_description_len;
alter table public.workouts
  add constraint workouts_description_len
  check (description is null or char_length(description) <= 300);

create index if not exists workouts_system_global_idx
  on public.workouts (updated_at desc)
  where visibility = 'global' and is_system;

-- System workouts have no household; exercise rows must match (null).
alter table public.workout_exercises
  alter column household_id drop not null;

create or replace function public.workout_exercise_guard()
returns trigger
language plpgsql
as $$
declare
  v_household uuid;
  v_is_system boolean;
begin
  select household_id, is_system
    into v_household, v_is_system
  from public.workouts
  where id = new.workout_id;

  if coalesce(v_is_system, false) then
    if new.household_id is not null then
      raise exception 'Exercise must belong to the workout household';
    end if;
    return new;
  end if;

  if v_household is null or v_household is distinct from new.household_id then
    raise exception 'Exercise must belong to the workout household';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guard: system rows only via SQL editor / service role (auth.uid() is null).
-- Clients cannot insert is_system=true or flip is_system on update.
-- ---------------------------------------------------------------------------

create or replace function public.workout_global_publish_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.is_system then
    if auth.uid() is not null then
      raise exception 'System workouts cannot be created by clients';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.is_system is distinct from old.is_system then
      raise exception 'is_system cannot be changed';
    end if;
    if old.is_system and auth.uid() is not null then
      raise exception 'System workouts cannot be updated by clients';
    end if;
  end if;

  if new.is_system then
    if new.visibility = 'global'
      and (new.level is null or new.goal is null or coalesce(cardinality(new.equipment), 0) = 0)
    then
      raise exception 'Everyone publish requires level, goal, and equipment tags';
    end if;
    return new;
  end if;

  if new.visibility = 'global' then
    if new.created_by is distinct from auth.uid() then
      raise exception 'Only the workout owner can publish to Everyone';
    end if;
    if not public.is_approved_creator() then
      raise exception 'Only verified creators can publish to Everyone';
    end if;
    if new.level is null or new.goal is null or coalesce(cardinality(new.equipment), 0) = 0 then
      raise exception 'Everyone publish requires level, goal, and equipment tags';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and old.visibility = 'global'
    and new.visibility is distinct from 'global'
    and old.created_by is distinct from auth.uid()
  then
    raise exception 'Only the workout owner can unpublish from Everyone';
  end if;

  return new;
end;
$$;

drop trigger if exists workouts_global_publish_guard on public.workouts;
create trigger workouts_global_publish_guard
  before insert or update on public.workouts
  for each row execute function public.workout_global_publish_guard();

-- ---------------------------------------------------------------------------
-- RLS: system globals stay readable via visibility=global; never editable/deletable.
-- ---------------------------------------------------------------------------

create or replace function public.can_edit_workout(_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workouts w
    where w.id = _workout_id
      and not w.is_system
      and (
        public.can_edit_shared(
          w.household_id,
          w.created_by,
          case
            when w.visibility in ('buddies', 'buddies_selected', 'global') then 'private'
            else w.visibility
          end,
          public.workout_shared_with_me(w.id),
          false
        )
        or (
          w.created_by is not null
          and w.visibility in ('buddies', 'buddies_selected')
          and (
            (w.visibility = 'buddies' and public.buddy_can(w.created_by, auth.uid(), 'can_coedit_shared'))
            or (
              w.visibility = 'buddies_selected'
              and public.workout_buddy_shared_with_me(w.id)
              and public.buddy_can(w.created_by, auth.uid(), 'can_coedit_shared')
            )
          )
        )
      )
  );
$$;

drop policy if exists workouts_insert on public.workouts;
create policy workouts_insert on public.workouts
  for insert to authenticated
  with check (
    not is_system
    and created_by = auth.uid()
    and public.is_household_member(household_id)
    and (
      visibility in ('private', 'household', 'people', 'buddies', 'buddies_selected')
      or (visibility = 'global' and public.is_approved_creator())
    )
  );

drop policy if exists workouts_update on public.workouts;
create policy workouts_update on public.workouts
  for update to authenticated
  using (not is_system and public.can_edit_workout(id))
  with check (
    not is_system
    and public.can_create_shared(household_id)
    and (
      visibility = 'household'
      or visibility = 'people'
      or visibility = 'buddies'
      or visibility = 'buddies_selected'
      or (visibility = 'private' and created_by = auth.uid())
      or (
        visibility = 'global'
        and created_by = auth.uid()
        and public.is_approved_creator()
      )
    )
  );

drop policy if exists workouts_delete on public.workouts;
create policy workouts_delete on public.workouts
  for delete to authenticated
  using (not is_system and public.can_edit_workout(id));

notify pgrst, 'reload schema';
