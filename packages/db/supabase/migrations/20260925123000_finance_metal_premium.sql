-- Premium over spot for metal holdings, such as coins worth 10% more than the bar price.

alter table public.finance_metal_holdings
  add column premium_percent numeric not null default 0 check (premium_percent >= -100);
