-- Count of pieces on a metal holding. Weight stays the size of one piece.

alter table public.finance_metal_holdings
  add column quantity integer not null default 1 check (quantity >= 1);
