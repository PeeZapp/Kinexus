-- When the user selects a preset via profiles.avatar_url, clear optional Google photo.
-- Apply after 20261106140000_profile_avatar_google.sql.
-- Authenticated clients cannot write avatar_source / avatar_google_url; this trigger clears them on NEW.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'avatar_source'
  ) then
    raise exception 'Apply 20261106140000_profile_avatar_google.sql before clearing Google on preset write';
  end if;
end;
$$;

create or replace function public.profiles_avatar_preset_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.avatar_url is not distinct from old.avatar_url
  then
    return new;
  end if;

  if public.is_profile_avatar_preset(new.avatar_url) then
    new.avatar_source := 'preset';
    new.avatar_google_url := null;
    return new;
  end if;

  raise exception 'avatar_url must be a known preset id (or null)'
    using errcode = 'check_violation';
end;
$$;
