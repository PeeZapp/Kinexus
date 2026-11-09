-- Train plan sharing (7d): public share links + creator-only Everyone publish guard.
-- Mirrors workouts/watchlist share_token pattern and 6d train_plan_global_publish_guard
-- (training_plans have no level/goal/equipment tags — owner + approved creator only).

-- ---------------------------------------------------------------------------
-- Public link sharing
-- ---------------------------------------------------------------------------

alter table public.training_plans
  add column if not exists share_token uuid;

alter table public.training_plans
  add column if not exists is_shared boolean not null default false;

create unique index if not exists training_plans_share_token_uidx
  on public.training_plans (share_token)
  where share_token is not null;

-- ---------------------------------------------------------------------------
-- Guard: only owner + approved creator may publish/unpublish Everyone
-- ---------------------------------------------------------------------------

create or replace function public.training_plan_global_publish_guard()
returns trigger
language plpgsql
as $$
begin
  if new.visibility = 'global' then
    if new.owner_id is distinct from auth.uid() then
      raise exception 'Only the plan owner can publish to Everyone';
    end if;
    if not public.is_approved_creator() then
      raise exception 'Only verified creators can publish to Everyone';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and old.visibility = 'global'
    and new.visibility is distinct from 'global'
    and old.owner_id is distinct from auth.uid()
  then
    raise exception 'Only the plan owner can unpublish from Everyone';
  end if;

  return new;
end;
$$;

drop trigger if exists training_plans_global_publish_guard on public.training_plans;
create trigger training_plans_global_publish_guard
  before insert or update on public.training_plans
  for each row execute function public.training_plan_global_publish_guard();

notify pgrst, 'reload schema';
