-- Per-user journal lock. Only a salted PIN hash is stored — never the PIN itself.

create table public.user_journal_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pin_salt text not null,
  pin_hash text not null,
  updated_at timestamptz not null default now(),
  constraint user_journal_prefs_pin_salt check (char_length(pin_salt) between 16 and 64),
  constraint user_journal_prefs_pin_hash check (char_length(pin_hash) = 64)
);

create trigger user_journal_prefs_set_updated_at
  before update on public.user_journal_prefs
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.user_journal_prefs to authenticated;

alter table public.user_journal_prefs enable row level security;

create policy user_journal_prefs_select on public.user_journal_prefs
  for select to authenticated
  using (user_id = auth.uid());

create policy user_journal_prefs_insert on public.user_journal_prefs
  for insert to authenticated
  with check (user_id = auth.uid());

create policy user_journal_prefs_update on public.user_journal_prefs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_journal_prefs_delete on public.user_journal_prefs
  for delete to authenticated
  using (user_id = auth.uid());
