-- Dedicated watched lists: one private list per person, one family list per household.

alter table public.watchlist_lists
  add column if not exists kind text not null default 'custom';

alter table public.watchlist_lists
  drop constraint if exists watchlist_lists_kind_check;

alter table public.watchlist_lists
  add constraint watchlist_lists_kind_check
  check (
    kind = 'custom'
    or (kind = 'watched_family' and visibility = 'household')
    or (kind = 'watched_private' and visibility = 'private' and created_by is not null)
  );

create unique index if not exists watchlist_lists_family_watched_idx
  on public.watchlist_lists (household_id)
  where kind = 'watched_family';

create unique index if not exists watchlist_lists_private_watched_idx
  on public.watchlist_lists (household_id, created_by)
  where kind = 'watched_private';

create or replace function public.watchlist_list_guard()
returns trigger
language plpgsql
as $$
begin
  if new.visibility = 'private' and auth.uid() is not null and new.created_by is distinct from auth.uid() then
    raise exception 'Private watchlists must belong to you';
  end if;
  if new.kind = 'watched_private' and auth.uid() is not null and new.created_by is distinct from auth.uid() then
    raise exception 'Private watched lists must belong to you';
  end if;
  if tg_op = 'UPDATE' and old.kind is distinct from new.kind then
    raise exception 'Watchlist kind cannot change';
  end if;
  if tg_op = 'UPDATE' and old.kind <> 'custom' then
    if new.name is distinct from old.name or new.visibility is distinct from old.visibility or new.created_by is distinct from old.created_by then
      raise exception 'Watched lists cannot be renamed';
    end if;
  end if;
  return new;
end;
$$;

insert into public.watchlist_lists (household_id, created_by, name, visibility, kind)
select
  h.id,
  (
    select m.user_id
    from public.household_members m
    where m.household_id = h.id
    order by case m.role::text when 'owner' then 0 when 'admin' then 1 else 2 end, m.joined_at
    limit 1
  ),
  'Family',
  'household',
  'watched_family'
from public.households h
where not exists (
  select 1
  from public.watchlist_lists l
  where l.household_id = h.id
    and l.kind = 'watched_family'
);

-- Titles already marked watched join the family list. They stay on their original lists too.
insert into public.watchlist_items (household_id, list_id, title_id, added_by, status, added_at)
select distinct on (i.title_id)
  i.household_id,
  family.id,
  i.title_id,
  i.added_by,
  'watched',
  i.added_at
from public.watchlist_items i
join public.watchlist_lists family
  on family.household_id = i.household_id
 and family.kind = 'watched_family'
where i.status = 'watched'
  and not exists (
    select 1
    from public.watchlist_items existing
    where existing.list_id = family.id
      and existing.title_id = i.title_id
  )
order by i.title_id, i.added_at;
