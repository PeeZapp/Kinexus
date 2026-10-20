-- Parallel family + personal meals on the same day/slot are allowed.
-- Only block the same person appearing on two non-hidden audiences for that meal.

create or replace function public.enforce_meal_slot_audience_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
begin
  if new.hidden then
    return new;
  end if;

  -- Household (empty audience) can sit beside personal/group meals.
  if cardinality(new.audience_person_ids) = 0 then
    return new;
  end if;

  foreach v_pid in array new.audience_person_ids loop
    if exists (
      select 1
      from public.meal_slots s
      where s.meal_plan_id = new.meal_plan_id
        and s.day = new.day
        and s.slot_key = new.slot_key
        and s.id is distinct from new.id
        and not s.hidden
        and v_pid = any (s.audience_person_ids)
    ) then
      raise exception 'That person already has a % on this day', new.slot_key;
    end if;
  end loop;

  return new;
end;
$$;
