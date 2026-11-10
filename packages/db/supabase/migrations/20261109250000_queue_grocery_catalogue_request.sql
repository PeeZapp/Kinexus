-- Authenticated/API path to queue a live-miss into next week's catalogue extras.

create or replace function public.queue_grocery_catalogue_request(
  p_ingredient_key text,
  p_search_query text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  key text := left(trim(coalesce(p_ingredient_key, '')), 80);
  query text := left(trim(coalesce(p_search_query, '')), 60);
begin
  if key = '' or query = '' then
    return;
  end if;

  insert into public.grocery_catalogue_requests as r (
    ingredient_key,
    search_query,
    request_count,
    last_requested_at
  )
  values (key, query, 1, now())
  on conflict (ingredient_key) do update
    set request_count = r.request_count + 1,
        last_requested_at = now(),
        search_query = excluded.search_query;
end;
$$;

revoke all on function public.queue_grocery_catalogue_request(text, text) from public;
grant execute on function public.queue_grocery_catalogue_request(text, text) to authenticated;
grant execute on function public.queue_grocery_catalogue_request(text, text) to service_role;
