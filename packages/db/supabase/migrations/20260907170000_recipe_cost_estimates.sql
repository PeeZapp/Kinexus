-- Approximate supermarket cost per serve, scoped by country so catalog recipes
-- can be shared across households without mixing AU and US prices.

create table public.recipe_cost_estimates (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  country text not null check (char_length(country) = 2),
  currency text not null check (char_length(currency) = 3),
  total_cost numeric,
  cost_per_serve numeric,
  servings_basis integer,
  stores text[] not null default '{}',
  breakdown jsonb not null default '[]'::jsonb,
  priced_at timestamptz,
  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, country, currency)
);

create index recipe_cost_estimates_recipe_id_idx on public.recipe_cost_estimates (recipe_id);
create index recipe_cost_estimates_market_idx on public.recipe_cost_estimates (country, currency);

alter table public.recipe_cost_estimates enable row level security;

create policy recipe_cost_estimates_select on public.recipe_cost_estimates
  for select to authenticated
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id
        and (r.household_id is null or public.is_household_member(r.household_id))
    )
  );

create trigger recipe_cost_estimates_updated_at
  before update on public.recipe_cost_estimates
  for each row execute function public.set_updated_at();
