-- Investment ideas / watchlist + trade journal (NOT media watchlist).
-- Private visibility: creator or household owner only (matches domain canSeeShared private).

-- ---------------------------------------------------------------------------
-- Alert segment: investment_alert
-- ---------------------------------------------------------------------------

alter table public.user_alert_prefs
  drop constraint if exists user_alert_prefs_segment;
alter table public.user_alert_prefs
  add constraint user_alert_prefs_segment check (
    segment in (
      'meal_plan',
      'calendar',
      'talk',
      'wishlist',
      'shopping',
      'checklist',
      'watchlist_available',
      'budget',
      'investment_alert'
    )
  );

alter table public.user_alerts
  drop constraint if exists user_alerts_segment;
alter table public.user_alerts
  add constraint user_alerts_segment check (
    segment in (
      'meal_plan',
      'calendar',
      'talk',
      'wishlist',
      'shopping',
      'checklist',
      'watchlist_available',
      'budget',
      'investment_alert'
    )
  );

-- ---------------------------------------------------------------------------
-- Investment watchlist / ideas
-- ---------------------------------------------------------------------------

create table public.finance_investment_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  visibility text not null default 'household'
    check (visibility in ('household', 'private')),
  symbol text,
  title text not null,
  thesis text not null default '',
  notes text not null default '',
  tags text[] not null default '{}'::text[],
  status text not null default 'watching'
    check (status in ('watching', 'idea', 'holding', 'closed')),
  target_price numeric(18, 6),
  stop_price numeric(18, 6),
  alert_above numeric(18, 6),
  alert_below numeric(18, 6),
  alert_pct_move numeric(8, 4),
  last_price numeric(18, 6),
  last_price_at timestamptz,
  currency text not null default 'AUD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_investment_items_title_len check (
    char_length(trim(title)) > 0 and char_length(title) <= 120
  ),
  constraint finance_investment_items_symbol_len check (
    symbol is null or (char_length(trim(symbol)) > 0 and char_length(symbol) <= 32)
  )
);

create index finance_investment_items_household_idx
  on public.finance_investment_items (household_id, updated_at desc);

create index finance_investment_items_symbol_idx
  on public.finance_investment_items (household_id, symbol)
  where symbol is not null;

create or replace function public.finance_investment_item_guard()
returns trigger
language plpgsql
as $$
begin
  new.title := left(trim(regexp_replace(coalesce(new.title, ''), '\s+', ' ', 'g')), 120);
  if new.title = '' then
    raise exception 'Investment idea needs a title';
  end if;
  if new.symbol is not null then
    new.symbol := upper(trim(new.symbol));
    if new.symbol = '' then
      new.symbol := null;
    end if;
  end if;
  new.thesis := left(coalesce(new.thesis, ''), 4000);
  new.notes := left(coalesce(new.notes, ''), 4000);
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.created_by := old.created_by;
  end if;
  if new.created_by is null then
    raise exception 'Investment idea requires created_by';
  end if;
  return new;
end;
$$;

create trigger finance_investment_items_guard
  before insert or update on public.finance_investment_items
  for each row execute function public.finance_investment_item_guard();

create trigger finance_investment_items_set_updated_at
  before update on public.finance_investment_items
  for each row execute function public.set_updated_at();

create or replace function public.can_view_investment_item(_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.finance_investment_items i
    where i.id = _item_id
      and public.can_view_finances(i.household_id)
      and (
        i.visibility = 'household'
        or i.created_by = auth.uid()
        or public.has_household_role(i.household_id, array['owner']::public.household_role[])
      )
  );
$$;

revoke all on function public.can_view_investment_item(uuid) from public;
grant execute on function public.can_view_investment_item(uuid) to authenticated;

grant select, insert, update, delete on table public.finance_investment_items to authenticated;

alter table public.finance_investment_items enable row level security;

create policy finance_investment_items_select on public.finance_investment_items
  for select to authenticated
  using (
    public.can_view_finances(household_id)
    and (
      visibility = 'household'
      or created_by = auth.uid()
      or public.has_household_role(household_id, array['owner']::public.household_role[])
    )
  );

create policy finance_investment_items_insert on public.finance_investment_items
  for insert to authenticated
  with check (
    public.can_enter_budget_amounts(household_id)
    and created_by = auth.uid()
  );

create policy finance_investment_items_update on public.finance_investment_items
  for update to authenticated
  using (
    public.can_view_investment_item(id)
    and (
      created_by = auth.uid()
      or public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
    )
  )
  with check (
    public.can_view_finances(household_id)
    and (
      visibility = 'household'
      or created_by = auth.uid()
      or public.has_household_role(household_id, array['owner']::public.household_role[])
    )
  );

create policy finance_investment_items_delete on public.finance_investment_items
  for delete to authenticated
  using (
    public.can_view_investment_item(id)
    and (
      created_by = auth.uid()
      or public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
    )
  );

-- ---------------------------------------------------------------------------
-- Price alert evaluations (threshold rows; fired via cron)
-- ---------------------------------------------------------------------------

create table public.finance_investment_alerts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  item_id uuid not null references public.finance_investment_items (id) on delete cascade,
  kind text not null check (kind in ('above', 'below', 'pct_move')),
  threshold numeric(18, 6) not null,
  active boolean not null default true,
  last_triggered_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_investment_alerts_active_idx
  on public.finance_investment_alerts (household_id, active)
  where active;

create trigger finance_investment_alerts_set_updated_at
  before update on public.finance_investment_alerts
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.finance_investment_alerts to authenticated;

alter table public.finance_investment_alerts enable row level security;

create policy finance_investment_alerts_select on public.finance_investment_alerts
  for select to authenticated
  using (public.can_view_investment_item(item_id));

create policy finance_investment_alerts_insert on public.finance_investment_alerts
  for insert to authenticated
  with check (
    public.can_view_investment_item(item_id)
    and created_by = auth.uid()
  );

create policy finance_investment_alerts_update on public.finance_investment_alerts
  for update to authenticated
  using (
    public.can_view_investment_item(item_id)
    and (
      created_by = auth.uid()
      or public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
    )
  )
  with check (public.can_view_investment_item(item_id));

create policy finance_investment_alerts_delete on public.finance_investment_alerts
  for delete to authenticated
  using (
    public.can_view_investment_item(item_id)
    and (
      created_by = auth.uid()
      or public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
    )
  );

-- ---------------------------------------------------------------------------
-- Trade journal
-- ---------------------------------------------------------------------------

create table public.finance_trade_journal (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  visibility text not null default 'household'
    check (visibility in ('household', 'private')),
  item_id uuid references public.finance_investment_items (id) on delete set null,
  symbol text,
  side text not null check (side in ('buy', 'sell')),
  qty numeric(18, 6) not null check (qty > 0),
  price numeric(18, 6) not null check (price >= 0),
  fees numeric(18, 6) not null default 0 check (fees >= 0),
  traded_on date not null,
  thesis text not null default '',
  emotions text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_trade_journal_symbol_or_item check (
    symbol is not null or item_id is not null
  )
);

create index finance_trade_journal_household_idx
  on public.finance_trade_journal (household_id, traded_on desc);

create or replace function public.finance_trade_journal_guard()
returns trigger
language plpgsql
as $$
begin
  if new.symbol is not null then
    new.symbol := upper(trim(new.symbol));
    if new.symbol = '' then
      new.symbol := null;
    end if;
  end if;
  new.thesis := left(coalesce(new.thesis, ''), 4000);
  new.emotions := left(coalesce(new.emotions, ''), 1000);
  new.notes := left(coalesce(new.notes, ''), 4000);
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.created_by := old.created_by;
  end if;
  if new.created_by is null then
    raise exception 'Trade journal entry requires created_by';
  end if;
  return new;
end;
$$;

create trigger finance_trade_journal_guard
  before insert or update on public.finance_trade_journal
  for each row execute function public.finance_trade_journal_guard();

create trigger finance_trade_journal_set_updated_at
  before update on public.finance_trade_journal
  for each row execute function public.set_updated_at();

create or replace function public.can_view_trade_journal(_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.finance_trade_journal t
    where t.id = _entry_id
      and public.can_view_finances(t.household_id)
      and (
        t.visibility = 'household'
        or t.created_by = auth.uid()
        or public.has_household_role(t.household_id, array['owner']::public.household_role[])
      )
  );
$$;

revoke all on function public.can_view_trade_journal(uuid) from public;
grant execute on function public.can_view_trade_journal(uuid) to authenticated;

grant select, insert, update, delete on table public.finance_trade_journal to authenticated;

alter table public.finance_trade_journal enable row level security;

create policy finance_trade_journal_select on public.finance_trade_journal
  for select to authenticated
  using (
    public.can_view_finances(household_id)
    and (
      visibility = 'household'
      or created_by = auth.uid()
      or public.has_household_role(household_id, array['owner']::public.household_role[])
    )
  );

create policy finance_trade_journal_insert on public.finance_trade_journal
  for insert to authenticated
  with check (
    public.can_enter_budget_amounts(household_id)
    and created_by = auth.uid()
  );

create policy finance_trade_journal_update on public.finance_trade_journal
  for update to authenticated
  using (
    public.can_view_trade_journal(id)
    and (
      created_by = auth.uid()
      or public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
    )
  )
  with check (
    public.can_view_finances(household_id)
    and (
      visibility = 'household'
      or created_by = auth.uid()
      or public.has_household_role(household_id, array['owner']::public.household_role[])
    )
  );

create policy finance_trade_journal_delete on public.finance_trade_journal
  for delete to authenticated
  using (
    public.can_view_trade_journal(id)
    and (
      created_by = auth.uid()
      or public.has_household_role(household_id, array['owner', 'admin']::public.household_role[])
    )
  );

notify pgrst, 'reload schema';
