-- One review per household person per watchlist title.

create table public.watchlist_reviews (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title_id uuid not null references public.watchlist_titles (id) on delete cascade,
  person_id uuid not null references public.household_people (id) on delete cascade,
  score smallint not null check (score between 1 and 10),
  body text check (body is null or char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title_id, person_id)
);

create index watchlist_reviews_household_idx on public.watchlist_reviews (household_id);
create index watchlist_reviews_title_idx on public.watchlist_reviews (title_id);

create or replace function public.watchlist_review_guard()
returns trigger
language plpgsql
as $$
declare
  v_title public.watchlist_titles%rowtype;
begin
  select * into v_title from public.watchlist_titles where id = new.title_id;
  if not found then
    raise exception 'Title not found';
  end if;
  if v_title.household_id <> new.household_id then
    raise exception 'Review must belong to the title household';
  end if;
  if not exists (
    select 1
    from public.household_people p
    where p.id = new.person_id
      and p.household_id = new.household_id
  ) then
    raise exception 'That person is not in this household';
  end if;
  if new.body is not null then
    new.body = nullif(trim(new.body), '');
  end if;
  return new;
end;
$$;

create trigger watchlist_reviews_guard
  before insert or update on public.watchlist_reviews
  for each row execute function public.watchlist_review_guard();

create trigger watchlist_reviews_set_updated_at
  before update on public.watchlist_reviews
  for each row execute function public.set_updated_at();

create or replace function public.can_review_watchlist_title(_title_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.watchlist_items i
    where i.title_id = _title_id
      and public.can_view_watchlist_list(i.list_id)
  );
$$;

revoke all on function public.can_review_watchlist_title(uuid) from public;
grant execute on function public.can_review_watchlist_title(uuid) to authenticated;

grant select, insert, update, delete on table public.watchlist_reviews to authenticated;

alter table public.watchlist_reviews enable row level security;

create policy watchlist_reviews_select on public.watchlist_reviews
  for select to authenticated
  using (public.can_review_watchlist_title(title_id));

create policy watchlist_reviews_insert on public.watchlist_reviews
  for insert to authenticated
  with check (public.can_review_watchlist_title(title_id));

create policy watchlist_reviews_update on public.watchlist_reviews
  for update to authenticated
  using (public.can_review_watchlist_title(title_id))
  with check (public.can_review_watchlist_title(title_id));

create policy watchlist_reviews_delete on public.watchlist_reviews
  for delete to authenticated
  using (public.can_review_watchlist_title(title_id));

alter table public.watchlist_reviews replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.watchlist_reviews;
  exception
    when duplicate_object then null;
  end;
end;
$$;
