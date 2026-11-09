-- Fix training_plans create RLS.
-- Inserts were denied when can_create_shared missed leftover 'member' roles,
-- or when insert/update policies were missing after a partial schema apply.

-- Include legacy 'member' (pre adult/teen/child rename) so household creators can write.
create or replace function public.can_create_shared(_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_household_role(
    _household_id,
    array['owner', 'admin', 'adult', 'teen', 'member']::public.household_role[]
  );
$$;

grant execute on function public.can_create_shared(uuid) to authenticated;

-- Normalize any leftover member rows (idempotent with 20261002101000).
update public.household_members set role = 'adult' where role = 'member';
update public.household_invites set role = 'adult' where role = 'member';

grant select, insert, update, delete on table public.training_plans to authenticated;
grant select, insert, update, delete on table public.training_plan_days to authenticated;
grant select, insert, update, delete on table public.training_plan_buddy_shares to authenticated;

alter table public.training_plans enable row level security;
alter table public.training_plan_days enable row level security;
alter table public.training_plan_buddy_shares enable row level security;

drop policy if exists training_plans_select on public.training_plans;
create policy training_plans_select on public.training_plans
  for select to authenticated
  using (public.can_view_training_plan(id));

drop policy if exists training_plans_insert on public.training_plans;
create policy training_plans_insert on public.training_plans
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and public.is_household_member(household_id)
    and (
      visibility in ('private', 'household', 'people', 'buddies', 'buddies_selected')
      or (visibility = 'global' and public.is_approved_creator())
    )
  );

drop policy if exists training_plans_update on public.training_plans;
create policy training_plans_update on public.training_plans
  for update to authenticated
  using (public.can_edit_training_plan(id))
  with check (
    public.is_household_member(household_id)
    and (
      visibility in ('private', 'household', 'people', 'buddies', 'buddies_selected')
      or (visibility = 'global' and public.is_approved_creator())
    )
  );

drop policy if exists training_plans_delete on public.training_plans;
create policy training_plans_delete on public.training_plans
  for delete to authenticated
  using (public.can_edit_training_plan(id));

drop policy if exists training_plan_days_select on public.training_plan_days;
create policy training_plan_days_select on public.training_plan_days
  for select to authenticated
  using (public.can_view_training_plan(plan_id));

drop policy if exists training_plan_days_mutate on public.training_plan_days;
create policy training_plan_days_mutate on public.training_plan_days
  for all to authenticated
  using (public.can_edit_training_plan(plan_id))
  with check (public.can_edit_training_plan(plan_id));

drop policy if exists training_plan_buddy_shares_select on public.training_plan_buddy_shares;
create policy training_plan_buddy_shares_select on public.training_plan_buddy_shares
  for select to authenticated
  using (public.can_view_training_plan(plan_id));

drop policy if exists training_plan_buddy_shares_mutate on public.training_plan_buddy_shares;
create policy training_plan_buddy_shares_mutate on public.training_plan_buddy_shares
  for all to authenticated
  using (public.can_edit_training_plan(plan_id))
  with check (public.can_edit_training_plan(plan_id));

notify pgrst, 'reload schema';
