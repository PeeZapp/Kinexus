-- Private staff/developer alerts (segment = 'staff') + notify fan-out.

-- Allow household_id to be null for platform-scoped staff alerts.
alter table public.user_alerts
  alter column household_id drop not null;

alter table public.user_alert_prefs
  drop constraint if exists user_alert_prefs_segment;
alter table public.user_alert_prefs
  add constraint user_alert_prefs_segment check (
    segment in (
      'meal_plan',
      'calendar',
      'talk',
      'tasks',
      'wishlist',
      'shopping',
      'checklist',
      'watchlist_available',
      'budget',
      'investment_alert',
      'staff'
    )
  );

alter table public.user_alerts
  drop constraint if exists user_alerts_segment;
alter table public.user_alerts
  add constraint user_alerts_segment check (
    segment in (
      'meal_plan',
      'calendar',
      'talk',
      'tasks',
      'wishlist',
      'shopping',
      'checklist',
      'watchlist_available',
      'budget',
      'investment_alert',
      'staff'
    )
  );

-- Staff alerts are account-private and do not require a household.
alter table public.user_alerts
  drop constraint if exists user_alerts_household_for_segment;
alter table public.user_alerts
  add constraint user_alerts_household_for_segment check (
    (segment = 'staff')
    or (household_id is not null)
  );

create or replace function public.notify_platform_staff_alert(
  p_title text,
  p_body text default null,
  p_href text default null,
  p_payload jsonb default '{}'::jsonb,
  p_household_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_title is null or trim(p_title) = '' then
    raise exception 'title is required';
  end if;

  insert into public.user_alerts (
    user_id,
    household_id,
    actor_user_id,
    segment,
    title,
    body,
    href,
    payload
  )
  select
    s.user_id,
    p_household_id,
    v_uid,
    'staff',
    left(trim(p_title), 160),
    case when p_body is null then null else left(p_body, 400) end,
    case when p_href is null then null else left(p_href, 400) end,
    coalesce(p_payload, '{}'::jsonb)
  from public.platform_staff s
  where s.user_id is distinct from v_uid;
end;
$$;

-- Staff fan-out is internal-only (called from other SECURITY DEFINER RPCs).
revoke all on function public.notify_platform_staff_alert(text, text, text, jsonb, uuid) from public;
revoke all on function public.notify_platform_staff_alert(text, text, text, jsonb, uuid) from anon;
revoke all on function public.notify_platform_staff_alert(text, text, text, jsonb, uuid) from authenticated;

-- Notify staff when a creator application is submitted.
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
  p_originality_attested boolean default false,
  p_requested_username text default null,
  p_requested_platform text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_social_count integer;
  v_username text := lower(trim(coalesce(p_requested_username, '')));
  v_platform text := lower(trim(coalesce(p_requested_platform, '')));
  v_reason text;
  v_platform_url text;
  v_name text := trim(coalesce(p_display_name, ''));
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
  if char_length(v_name) = 0
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

  if v_platform not in ('instagram', 'youtube', 'tiktok') then
    raise exception 'Choose Instagram, YouTube, or TikTok for your requested username';
  end if;

  v_platform_url := case v_platform
    when 'instagram' then nullif(trim(coalesce(p_instagram_url, '')), '')
    when 'youtube' then nullif(trim(coalesce(p_youtube_url, '')), '')
    when 'tiktok' then nullif(trim(coalesce(p_tiktok_url, '')), '')
  end;
  if v_platform_url is null then
    raise exception 'Add the % profile that matches your requested username', v_platform;
  end if;

  v_reason := public.username_validation_reason(v_username, v_uid);
  if v_reason is not null then
    raise exception 'Requested username unavailable: %', v_reason;
  end if;

  insert into public.creator_applications (
    user_id, status, display_name, bio, expertise,
    portfolio_url, instagram_url, youtube_url, tiktok_url, website_url, other_links,
    value_pitch, originality_attested,
    requested_username, requested_platform
  ) values (
    v_uid, 'pending',
    v_name, trim(p_bio), trim(p_expertise),
    nullif(trim(p_portfolio_url), ''), nullif(trim(p_instagram_url), ''),
    nullif(trim(p_youtube_url), ''), nullif(trim(p_tiktok_url), ''),
    nullif(trim(p_website_url), ''), nullif(trim(p_other_links), ''),
    coalesce(nullif(trim(p_value_pitch), ''), ''), true,
    v_username::extensions.citext, v_platform
  )
  returning id into v_id;

  insert into public.reserved_usernames (username, reason, application_id, held_for_user_id, platform)
  values (v_username::extensions.citext, 'creator_pending', v_id, v_uid, v_platform);

  perform public.notify_platform_staff_alert(
    'Creator application pending',
    left(v_name || ' applied as a creator (@' || v_username || ')', 400),
    '/staff/applications',
    jsonb_build_object(
      'applicationId', v_id,
      'requestedUsername', v_username,
      'requestedPlatform', v_platform
    ),
    null
  );

  return v_id;
end;
$$;

revoke all on function public.submit_creator_application(
  text, text, text, text, text, text, text, text, text, text, boolean, text, text
) from public;
grant execute on function public.submit_creator_application(
  text, text, text, text, text, text, text, text, text, text, boolean, text, text
) to authenticated;

notify pgrst, 'reload schema';
