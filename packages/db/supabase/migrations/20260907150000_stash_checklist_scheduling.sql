-- Checklist due dates, recurrence, and assignees.

alter table public.stash_list_items
  add column if not exists due_on date;

alter table public.stash_list_items
  add column if not exists recurrence text not null default 'none';

alter table public.stash_list_items
  drop constraint if exists stash_list_items_recurrence_check;

alter table public.stash_list_items
  add constraint stash_list_items_recurrence_check
  check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly'));

alter table public.stash_list_items
  add column if not exists assigned_person_id uuid references public.household_people (id) on delete set null;

create index if not exists stash_list_items_due_idx
  on public.stash_list_items (household_id, due_on)
  where due_on is not null and is_checked = false;

create index if not exists stash_list_items_assignee_idx
  on public.stash_list_items (assigned_person_id)
  where assigned_person_id is not null;

create or replace function public.stash_list_item_guard()
returns trigger
language plpgsql
as $$
declare
  v_list public.stash_lists%rowtype;
  v_person public.household_people%rowtype;
begin
  select * into v_list from public.stash_lists where id = new.list_id;
  if not found then
    raise exception 'List not found';
  end if;
  if v_list.kind <> 'checklist' then
    raise exception 'Items can only be added to checklists';
  end if;
  if v_list.household_id <> new.household_id then
    raise exception 'Item must belong to the same household as the list';
  end if;
  if new.assigned_person_id is not null then
    select * into v_person from public.household_people where id = new.assigned_person_id;
    if not found or v_person.household_id <> new.household_id then
      raise exception 'Assignee must belong to the same household';
    end if;
  end if;
  return new;
end;
$$;
