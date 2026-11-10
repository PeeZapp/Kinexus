-- Fix profile_display_handle: composite profiles arg did not resolve at call sites.
-- Safe if 20261110100000 already created the text signature (create or replace).

drop function if exists public.profile_display_handle(public.profiles);

create or replace function public.profile_display_handle(p_username text, p_global_handle text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(nullif(p_username, ''), p_global_handle);
$$;

revoke all on function public.profile_display_handle(text, text) from public;

create or replace function public.get_public_profile(p_key text)
returns table (
  permanent_id uuid,
  handle text,
  avatar_preset text,
  is_verified boolean,
  bio text,
  links jsonb
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_hidden boolean;
begin
  v_target := public.resolve_profile_user_id(p_key);
  if v_target is null then
    return;
  end if;

  if public.profile_viewer_blocked(v_uid, v_target) then
    return;
  end if;

  select coalesce(m.is_hidden, false) into v_hidden
  from public.public_profiles_meta m
  where m.user_id = v_target;

  v_hidden := coalesce(v_hidden, false);
  if v_hidden and (v_uid is null or v_uid is distinct from v_target) then
    return;
  end if;

  return query
  select
    p.id,
    public.profile_display_handle(p.username::text, p.global_handle::text),
    public.profile_avatar_preset(p.avatar_url),
    p.is_verified_creator,
    m.bio,
    coalesce(m.links, '[]'::jsonb)
  from public.profiles p
  left join public.public_profiles_meta m on m.user_id = p.id
  where p.id = v_target;
end;
$$;

create or replace function public.search_creators(
  p_q text,
  p_limit integer default 5
)
returns table (
  permanent_id uuid,
  handle text,
  avatar_preset text,
  is_verified boolean,
  rank_score real
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_q text := lower(trim(both from coalesce(p_q, '')));
  v_limit int := least(greatest(coalesce(p_limit, 5), 1), 20);
begin
  if char_length(v_q) < 1 then
    return;
  end if;

  return query
  with candidates as (
    select
      p.id,
      public.profile_display_handle(p.username::text, p.global_handle::text) as display_handle,
      public.profile_avatar_preset(p.avatar_url) as preset,
      p.is_verified_creator as verified,
      lower(coalesce(p.username::text, p.global_handle::text)) as key_handle,
      case
        when lower(coalesce(p.username::text, p.global_handle::text)) = v_q then 300::real
        when lower(coalesce(p.username::text, '')) like v_q || '%' then 200::real
        when lower(p.global_handle::text) like v_q || '%' then 180::real
        else extensions.similarity(
          lower(coalesce(p.username::text, p.global_handle::text)),
          v_q
        ) * 100::real
      end as score
    from public.profiles p
    left join public.public_profiles_meta m on m.user_id = p.id
    where coalesce(m.is_hidden, false) = false
      and not public.profile_viewer_blocked(v_uid, p.id)
      and (
        lower(coalesce(p.username::text, '')) like v_q || '%'
        or lower(p.global_handle::text) like v_q || '%'
        or extensions.similarity(
             lower(coalesce(p.username::text, p.global_handle::text)),
             v_q
           ) >= 0.25
      )
  )
  select
    c.id,
    c.display_handle,
    c.preset,
    c.verified,
    c.score
  from candidates c
  order by
    case when c.key_handle like v_q || '%' then 0 else 1 end,
    c.score desc,
    c.display_handle asc
  limit v_limit;
end;
$$;

notify pgrst, 'reload schema';
