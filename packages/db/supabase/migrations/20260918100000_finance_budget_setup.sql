-- Initial budget setup is explicit. Planned amounts stay standing; spend is kept on dated transactions.

alter table public.finance_budgets
  add column if not exists setup_completed_at timestamptz;

update public.finance_budgets b
set setup_completed_at = coalesce(b.updated_at, b.created_at)
where b.setup_completed_at is null
  and (
    exists (
      select 1
      from public.finance_budget_lines l
      where l.budget_id = b.id
        and l.planned > 0
    )
    or exists (
      select 1
      from public.finance_budget_txns t
      where t.budget_id = b.id
    )
  );

create or replace function public.ensure_finance_budget(p_household_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Not a member of this household';
  end if;

  select id into v_id
  from public.finance_budgets
  where household_id = p_household_id;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.finance_budgets (household_id)
  values (p_household_id)
  on conflict (household_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.finance_budgets
    where household_id = p_household_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.ensure_finance_budget(uuid) from public;
grant execute on function public.ensure_finance_budget(uuid) to authenticated;
