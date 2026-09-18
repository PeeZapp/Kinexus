-- Watchlist: movies and series the household (or one member) wants to watch.

create table public.watchlist_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  visibility text not null default 'household' check (visibility in ('household', 'personal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index watchlist_lists_household_idx on public.watchlist_lists (household_id);

create table public.watchlist_titles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  tmdb_id integer not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null check (char_length(trim(title)) > 0),
  year integer,
  overview text,
  poster_path text,
  backdrop_path text,
  imdb_id text,
  source_url text,
  tmdb_watch_url text,
  providers jsonb not null default '[]'::jsonb,
  providers_country text,
  providers_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, tmdb_id, media_type)
);

create index watchlist_titles_household_idx on public.watchlist_titles (household_id);

create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.watchlist_lists (id) on delete cascade,
  title_id uuid not null references public.watchlist_titles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  status text not null default 'want' check (status in ('want', 'watching', 'watched')),
  notes text,
  added_at timestamptz not null default now(),
  unique (list_id, title_id)
);

create index watchlist_items_household_idx on public.watchlist_items (household_id);
create index watchlist_items_title_idx on public.watchlist_items (title_id);
create index watchlist_items_list_idx on public.watchlist_items (list_id);

create or replace function public.watchlist_list_guard()
returns trigger
language plpgsql
as $$
begin
  if new.visibility = 'personal' and new.created_by is distinct from auth.uid() then
    raise exception 'Personal watchlists must belong to you';
  end if;
  return new;
end;
$$;

create trigger watchlist_lists_guard
  before insert or update on public.watchlist_lists
  for each row execute function public.watchlist_list_guard();

create or replace function public.watchlist_item_guard()
returns trigger
language plpgsql
as $$
declare
  v_list public.watchlist_lists%rowtype;
  v_title public.watchlist_titles%rowtype;
begin
  select * into v_list from public.watchlist_lists where id = new.list_id;
  if not found then
    raise exception 'Watchlist not found';
  end if;
  select * into v_title from public.watchlist_titles where id = new.title_id;
  if not found then
    raise exception 'Title not found';
  end if;
  if v_list.household_id <> v_title.household_id or v_list.household_id <> new.household_id then
    raise exception 'Watchlist item must belong to the same household';
  end if;
  return new;
end;
$$;

create trigger watchlist_items_guard
  before insert or update on public.watchlist_items
  for each row execute function public.watchlist_item_guard();

create trigger watchlist_lists_set_updated_at
  before update on public.watchlist_lists
  for each row execute function public.set_updated_at();

create trigger watchlist_titles_set_updated_at
  before update on public.watchlist_titles
  for each row execute function public.set_updated_at();

create or replace function public.can_view_watchlist_list(_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.watchlist_lists l
    where l.id = _list_id
      and public.is_household_member(l.household_id)
      and (
        l.visibility = 'household'
        or l.created_by = auth.uid()
      )
  );
$$;

create or replace function public.can_manage_watchlist_list(_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.watchlist_lists l
    where l.id = _list_id
      and public.is_household_member(l.household_id)
      and (
        l.created_by = auth.uid()
        or (
          l.visibility = 'household'
          and public.has_household_role(l.household_id, array['owner', 'admin']::public.household_role[])
        )
      )
  );
$$;

create or replace function public.can_view_watchlist_title(_title_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.watchlist_titles t
    where t.id = _title_id
      and public.is_household_member(t.household_id)
  );
$$;

create or replace function public.watchlist_cleanup_title()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.watchlist_items where title_id = old.title_id) then
    delete from public.watchlist_titles where id = old.title_id;
  end if;
  return old;
end;
$$;

create trigger watchlist_items_cleanup
  after delete on public.watchlist_items
  for each row execute function public.watchlist_cleanup_title();

revoke all on function public.can_view_watchlist_list(uuid) from public;
revoke all on function public.can_manage_watchlist_list(uuid) from public;
revoke all on function public.can_view_watchlist_title(uuid) from public;
grant execute on function public.can_view_watchlist_list(uuid) to authenticated;
grant execute on function public.can_manage_watchlist_list(uuid) to authenticated;
grant execute on function public.can_view_watchlist_title(uuid) to authenticated;

grant select, insert, update, delete on table public.watchlist_lists to authenticated;
grant select, insert, update, delete on table public.watchlist_titles to authenticated;
grant select, insert, update, delete on table public.watchlist_items to authenticated;

alter table public.watchlist_lists enable row level security;
alter table public.watchlist_titles enable row level security;
alter table public.watchlist_items enable row level security;

create policy watchlist_lists_select on public.watchlist_lists
  for select to authenticated
  using (public.can_view_watchlist_list(id));

create policy watchlist_lists_insert on public.watchlist_lists
  for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and (
      visibility = 'household'
      or (visibility = 'personal' and created_by = auth.uid())
    )
  );

create policy watchlist_lists_update on public.watchlist_lists
  for update to authenticated
  using (public.can_manage_watchlist_list(id))
  with check (
    public.is_household_member(household_id)
    and (
      visibility = 'household'
      or (visibility = 'personal' and created_by = auth.uid())
    )
  );

create policy watchlist_lists_delete on public.watchlist_lists
  for delete to authenticated
  using (public.can_manage_watchlist_list(id));

create policy watchlist_titles_select on public.watchlist_titles
  for select to authenticated
  using (public.is_household_member(household_id));

create policy watchlist_titles_insert on public.watchlist_titles
  for insert to authenticated
  with check (public.is_household_member(household_id));

create policy watchlist_titles_update on public.watchlist_titles
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy watchlist_titles_delete on public.watchlist_titles
  for delete to authenticated
  using (public.is_household_member(household_id));

create policy watchlist_items_select on public.watchlist_items
  for select to authenticated
  using (public.can_view_watchlist_list(list_id));

create policy watchlist_items_insert on public.watchlist_items
  for insert to authenticated
  with check (public.can_view_watchlist_list(list_id));

create policy watchlist_items_update on public.watchlist_items
  for update to authenticated
  using (public.can_view_watchlist_list(list_id))
  with check (public.can_view_watchlist_list(list_id));

create policy watchlist_items_delete on public.watchlist_items
  for delete to authenticated
  using (public.can_view_watchlist_list(list_id));

alter table public.watchlist_lists replica identity full;
alter table public.watchlist_titles replica identity full;
alter table public.watchlist_items replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.watchlist_lists;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.watchlist_titles;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.watchlist_items;
  exception
    when duplicate_object then null;
  end;
end;
$$;
