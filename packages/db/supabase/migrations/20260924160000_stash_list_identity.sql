-- List identity: emoji + theme color (Huddle-style).

alter table public.stash_lists
  add column if not exists emoji text;

alter table public.stash_lists
  add column if not exists theme text;

notify pgrst, 'reload schema';
