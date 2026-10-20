-- Personal journal entries. Each row is one logged note for the signed-in user.
-- The household cannot read another member's entries.

create table public.user_journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint user_journal_entries_body check (char_length(trim(body)) between 1 and 8000)
);

create index user_journal_entries_user_created_idx
  on public.user_journal_entries (user_id, created_at desc);

grant select, insert, update, delete on table public.user_journal_entries to authenticated;

alter table public.user_journal_entries enable row level security;

create policy user_journal_entries_select on public.user_journal_entries
  for select to authenticated
  using (user_id = auth.uid());

create policy user_journal_entries_insert on public.user_journal_entries
  for insert to authenticated
  with check (user_id = auth.uid());

create policy user_journal_entries_update on public.user_journal_entries
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_journal_entries_delete on public.user_journal_entries
  for delete to authenticated
  using (user_id = auth.uid());
