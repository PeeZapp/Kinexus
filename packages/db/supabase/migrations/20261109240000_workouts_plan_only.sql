-- Plan-linked workouts stay off the Workouts library until the user saves them.

alter table public.workouts
  add column if not exists plan_only boolean not null default false;

create index if not exists workouts_library_idx
  on public.workouts (household_id, updated_at desc)
  where plan_only = false;

create or replace function public.save_workout_to_library(p_workout_id uuid)
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

  if p_workout_id is null then
    raise exception 'workout_id is required';
  end if;

  if not exists (select 1 from public.workouts w where w.id = p_workout_id) then
    raise exception 'Workout not found';
  end if;

  if not public.can_edit_workout(p_workout_id) then
    raise exception 'Not allowed to save this workout';
  end if;

  update public.workouts
  set plan_only = false
  where id = p_workout_id
    and plan_only = true;
end;
$$;

revoke all on function public.save_workout_to_library(uuid) from public;
revoke all on function public.save_workout_to_library(uuid) from anon;
grant execute on function public.save_workout_to_library(uuid) to authenticated;

notify pgrst, 'reload schema';
