-- Preferred shop, Grok connector tokens, and one-time trolley handoffs.

alter table public.households
  add column if not exists preferred_grocery_chain text;

alter table public.households
  drop constraint if exists households_preferred_grocery_chain_check;

alter table public.households
  add constraint households_preferred_grocery_chain_check
  check (preferred_grocery_chain is null or preferred_grocery_chain in ('coles', 'woolworths'));

create table if not exists public.grocery_connectors (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'Grok',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists grocery_connectors_household_idx
  on public.grocery_connectors (household_id);

create table if not exists public.grocery_handoffs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  token_hash text not null unique,
  chain_id text not null,
  lines jsonb not null,
  skipped jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  opened_at timestamptz
);

create index if not exists grocery_handoffs_expires_idx
  on public.grocery_handoffs (expires_at);

alter table public.grocery_connectors enable row level security;
alter table public.grocery_handoffs enable row level security;

grant select, insert, update, delete on table public.grocery_connectors to authenticated;
grant select on table public.grocery_handoffs to authenticated;

create or replace function public.set_preferred_grocery_chain(p_household_id uuid, p_chain text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a member';
  end if;
  if p_chain is not null and p_chain not in ('coles', 'woolworths') then
    raise exception 'unknown shop';
  end if;
  update public.households
    set preferred_grocery_chain = p_chain
    where id = p_household_id;
end;
$$;

grant execute on function public.set_preferred_grocery_chain(uuid, text) to authenticated;

drop policy if exists grocery_connectors_own on public.grocery_connectors;
create policy grocery_connectors_own on public.grocery_connectors
  for all to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id))
  with check (user_id = auth.uid() and public.is_household_member(household_id));
