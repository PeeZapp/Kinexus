-- Saved Coles and Woolworths price for a shopping row.
-- Looked up once when the row is created, until the household asks for a re-check.

alter table public.shopping_items
  add column if not exists grocery_quote jsonb;
