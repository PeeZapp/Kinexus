-- Shared household "Talk" list for Today: capture things to discuss later.

create table public.household_talk_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 120),
  done boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index household_talk_items_household_created_idx
  on public.household_talk_items (household_id, created_at desc);

create or replace function public.household_talk_item_guard()
returns trigger
language plpgsql
as $$
begin
  new.body := left(trim(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g')), 120);
  if new.body = '' then
    raise exception 'Talk item cannot be empty';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.created_by := old.created_by;
  end if;
  if new.created_by is null then
    raise exception 'Talk item requires created_by';
  end if;
  return new;
end;
$$;

create trigger household_talk_items_guard
  before insert or update on public.household_talk_items
  for each row execute function public.household_talk_item_guard();

create trigger household_talk_items_set_updated_at
  before update on public.household_talk_items
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.household_talk_items to authenticated;

alter table public.household_talk_items enable row level security;

create policy household_talk_items_select on public.household_talk_items
  for select to authenticated
  using (public.is_household_member(household_id));

create policy household_talk_items_insert on public.household_talk_items
  for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and created_by = auth.uid()
  );

create policy household_talk_items_update on public.household_talk_items
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy household_talk_items_delete on public.household_talk_items
  for delete to authenticated
  using (public.is_household_member(household_id));

alter table public.household_talk_items replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.household_talk_items;
  exception
    when duplicate_object then null;
  end;
end;
$$;

notify pgrst, 'reload schema';
