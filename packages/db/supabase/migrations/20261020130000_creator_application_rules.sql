-- Soften value_pitch (no longer required), require a social link, limit to 1 application / day.

alter table public.creator_applications
  alter column value_pitch drop not null;

alter table public.creator_applications
  alter column value_pitch set default '';

update public.creator_applications
set value_pitch = coalesce(value_pitch, '')
where value_pitch is null;

create or replace function public.submit_creator_application(
  p_display_name text,
  p_bio text,
  p_expertise text,
  p_portfolio_url text default null,
  p_instagram_url text default null,
  p_youtube_url text default null,
  p_tiktok_url text default null,
  p_website_url text default null,
  p_other_links text default null,
  p_value_pitch text default null,
  p_originality_attested boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_social_count integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if exists (
    select 1 from public.creators where user_id = v_uid and status = 'approved'
  ) then
    raise exception 'You are already an approved creator';
  end if;
  if exists (
    select 1 from public.creator_applications where user_id = v_uid and status = 'pending'
  ) then
    raise exception 'You already have a pending application';
  end if;
  if exists (
    select 1
    from public.creator_applications
    where user_id = v_uid
      and created_at >= (timezone('utc', now())::date)::timestamptz
  ) then
    raise exception 'You can only submit one creator application per day';
  end if;
  if not coalesce(p_originality_attested, false) then
    raise exception 'You must attest that your content is original or licensed';
  end if;
  if char_length(trim(coalesce(p_display_name, ''))) = 0
     or char_length(trim(coalesce(p_bio, ''))) = 0
     or char_length(trim(coalesce(p_expertise, ''))) = 0 then
    raise exception 'Fill in every required application field';
  end if;

  v_social_count := (
    case when nullif(trim(p_instagram_url), '') is not null then 1 else 0 end
    + case when nullif(trim(p_youtube_url), '') is not null then 1 else 0 end
    + case when nullif(trim(p_tiktok_url), '') is not null then 1 else 0 end
  );
  if v_social_count < 1 then
    raise exception 'Add at least one social profile link so we can message you there';
  end if;

  insert into public.creator_applications (
    user_id, status, display_name, bio, expertise,
    portfolio_url, instagram_url, youtube_url, tiktok_url, website_url, other_links,
    value_pitch, originality_attested
  ) values (
    v_uid, 'pending',
    trim(p_display_name), trim(p_bio), trim(p_expertise),
    nullif(trim(p_portfolio_url), ''), nullif(trim(p_instagram_url), ''),
    nullif(trim(p_youtube_url), ''), nullif(trim(p_tiktok_url), ''),
    nullif(trim(p_website_url), ''), nullif(trim(p_other_links), ''),
    coalesce(nullif(trim(p_value_pitch), ''), ''), true
  )
  returning id into v_id;

  return v_id;
end;
$$;
