-- Shared supermarket unit prices per country. Recipes are costed locally from
-- this catalog (Huddle model), not by calling AI once per recipe.

create table public.ingredient_price_overrides (
  country text not null check (char_length(country) = 2),
  currency text not null check (char_length(currency) = 3),
  prices jsonb not null default '{}'::jsonb,
  priced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (country, currency)
);

alter table public.ingredient_price_overrides enable row level security;

create policy ingredient_price_overrides_select on public.ingredient_price_overrides
  for select to authenticated
  using (true);

create trigger ingredient_price_overrides_updated_at
  before update on public.ingredient_price_overrides
  for each row execute function public.set_updated_at();
