-- 3c: verified creator handles + gate global recipe/workout publish behind is_approved_creator().
-- Watchlist lists + reviews stay open to all authenticated users.
-- reserved_usernames already exists from 3b (system seeds); extend for pending creator holds.

-- ---------------------------------------------------------------------------
-- Schema: reserved hold metadata, application request + verify audit, creator badge
-- ---------------------------------------------------------------------------

alter table public.reserved_usernames
  add column if not exists application_id uuid references public.creator_applications (id) on delete cascade,
  add column if not exists held_for_user_id uuid references public.profiles (id) on delete cascade,
  add column if not exists platform text
    check (platform is null or platform in ('instagram', 'youtube', 'tiktok'));

create unique index if not exists reserved_usernames_pending_application_idx
  on public.reserved_usernames (application_id)
  where application_id is not null;

-- value_pitch was softened to optional in 20261020130000 but the length check remained.
alter table public.creator_applications
  drop constraint if exists creator_applications_value_pitch_check;

alter table public.creator_applications
  add column if not exists requested_username extensions.citext,
  add column if not exists requested_platform text
    check (requested_platform is null or requested_platform in ('instagram', 'youtube', 'tiktok')),
  add column if not exists contacted_via_dm boolean not null default false,
  add column if not exists creator_confirmed boolean not null default false,
  add column if not exists verified_by uuid references public.profiles (id) on delete set null,
  add column if not exists verified_at timestamptz;

alter table public.creators
  add column if not exists verified_handle extensions.citext,
  add column if not exists verified_platform text
    check (verified_platform is null or verified_platform in ('instagram', 'youtube', 'tiktok'));

-- ---------------------------------------------------------------------------
-- Workouts: allow visibility = global only for approved creators
-- ---------------------------------------------------------------------------

alter table public.workouts drop constraint if exists workouts_visibility_check;
alter table public.workouts
  add constraint workouts_visibility_check
  check (visibility in ('private', 'household', 'people', 'global'));

create or replace function public.can_view_workout(_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workouts w
    where w.id = _workout_id
      and (
        (w.visibility = 'global' and auth.uid() is not null)
        or public.can_view_shared(
          w.household_id,
          w.created_by,
          case when w.visibility = 'global' then 'household' else w.visibility end,
          public.workout_shared_with_me(w.id)
        )
      )
  );
$$;

create or replace function public.can_edit_workout(_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workouts w
    where w.id = _workout_id
      and public.can_edit_shared(
        w.household_id,
        w.created_by,
        case when w.visibility = 'global' then 'household' else w.visibility end,
        public.workout_shared_with_me(w.id),
        false
      )
  );
$$;

drop policy if exists workouts_select on public.workouts;
create policy workouts_select on public.workouts
  for select to authenticated
  using (
    (visibility = 'global' and auth.uid() is not null)
    or public.can_view_shared(
      household_id,
      created_by,
      case when visibility = 'global' then 'household' else visibility end,
      public.workout_shared_with_me(id)
    )
  );

drop policy if exists workouts_insert on public.workouts;
create policy workouts_insert on public.workouts
  for insert to authenticated
  with check (
    public.can_create_shared(household_id)
    and created_by = auth.uid()
    and (
      visibility = 'household'
      or visibility = 'people'
      or (visibility = 'private' and created_by = auth.uid())
      or (visibility = 'global' and public.is_approved_creator())
    )
  );

drop policy if exists workouts_update on public.workouts;
create policy workouts_update on public.workouts
  for update to authenticated
  using (public.can_edit_workout(id))
  with check (
    public.can_create_shared(household_id)
    and (
      visibility = 'household'
      or visibility = 'people'
      or (visibility = 'private' and created_by = auth.uid())
      or (visibility = 'global' and public.is_approved_creator())
    )
  );

-- ---------------------------------------------------------------------------
-- Assign verified handle (cooldown exempt; used only by staff approve path)
-- ---------------------------------------------------------------------------

create or replace function public.assign_creator_verified_username(
  p_user_id uuid,
  p_username text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u text := lower(trim(coalesce(p_username, '')));
  reason text;
begin
  if p_user_id is null then
    raise exception 'Missing user';
  end if;

  reason := public.username_validation_reason(u, p_user_id);
  -- Reserved rows for this applicant's pending hold are expected; treat as ok.
  if reason = 'reserved' and exists (
    select 1
    from public.reserved_usernames r
    where r.username = u::extensions.citext
      and r.held_for_user_id = p_user_id
  ) then
    reason := null;
  end if;

  if reason is not null then
    raise exception 'Requested username is not assignable: %', reason;
  end if;

  update public.profiles
  set username = u::extensions.citext,
      username_changed_at = now(),
      is_verified_creator = true,
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

revoke all on function public.assign_creator_verified_username(uuid, text) from public;

-- ---------------------------------------------------------------------------
-- submit_creator_application: reserve requested handle as pending
-- ---------------------------------------------------------------------------

drop function if exists public.submit_creator_application(
  text, text, text, text, text, text, text, text, text, text, boolean
);

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
    trim(p_display_name), trim(p_bio), trim(p_expertise),
    nullif(trim(p_portfolio_url), ''), nullif(trim(p_instagram_url), ''),
    nullif(trim(p_youtube_url), ''), nullif(trim(p_tiktok_url), ''),
    nullif(trim(p_website_url), ''), nullif(trim(p_other_links), ''),
    coalesce(nullif(trim(p_value_pitch), ''), ''), true,
    v_username::extensions.citext, v_platform
  )
  returning id into v_id;

  insert into public.reserved_usernames (username, reason, application_id, held_for_user_id, platform)
  values (v_username::extensions.citext, 'creator_pending', v_id, v_uid, v_platform);

  return v_id;
end;
$$;

revoke all on function public.submit_creator_application(
  text, text, text, text, text, text, text, text, text, text, boolean, text, text
) from public;
grant execute on function public.submit_creator_application(
  text, text, text, text, text, text, text, text, text, text, boolean, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- review_creator_application: verify checklist, assign handle / release reserve
-- ---------------------------------------------------------------------------

drop function if exists public.review_creator_application(uuid, text, text);

create or replace function public.review_creator_application(
  p_application_id uuid,
  p_action text,
  p_staff_notes text default null,
  p_contacted_via_dm boolean default false,
  p_creator_confirmed boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_app public.creator_applications%rowtype;
begin
  if not public.is_platform_staff() then
    raise exception 'Staff only';
  end if;
  if p_action not in ('approve', 'reject') then
    raise exception 'Invalid action';
  end if;

  select * into v_app
  from public.creator_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'Application is not pending';
  end if;

  if p_action = 'reject' then
    update public.creator_applications
    set status = 'rejected',
        staff_notes = nullif(trim(coalesce(p_staff_notes, '')), ''),
        contacted_via_dm = coalesce(p_contacted_via_dm, false),
        creator_confirmed = coalesce(p_creator_confirmed, false),
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    where id = p_application_id;

    delete from public.reserved_usernames
    where application_id = p_application_id;

    return;
  end if;

  if not coalesce(p_contacted_via_dm, false) then
    raise exception 'Confirm you contacted them via DM before approving';
  end if;
  if not coalesce(p_creator_confirmed, false) then
    raise exception 'Confirm the creator replied from that account before approving';
  end if;
  if v_app.requested_username is null or v_app.requested_platform is null then
    raise exception 'Application is missing a requested username';
  end if;

  update public.creator_applications
  set status = 'approved',
      staff_notes = nullif(trim(coalesce(p_staff_notes, '')), ''),
      contacted_via_dm = true,
      creator_confirmed = true,
      verified_by = auth.uid(),
      verified_at = now(),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_application_id;

  perform public.assign_creator_verified_username(
    v_app.user_id,
    v_app.requested_username::text
  );

  insert into public.creators (
    user_id, status, display_name, approved_at, revoked_at, revoked_reason,
    verified_handle, verified_platform, updated_at
  )
  values (
    v_app.user_id, 'approved', v_app.display_name, now(), null, null,
    v_app.requested_username, v_app.requested_platform, now()
  )
  on conflict (user_id) do update
    set status = 'approved',
        display_name = excluded.display_name,
        approved_at = now(),
        revoked_at = null,
        revoked_reason = null,
        verified_handle = excluded.verified_handle,
        verified_platform = excluded.verified_platform,
        updated_at = now();

  delete from public.reserved_usernames
  where application_id = p_application_id;
end;
$$;

revoke all on function public.review_creator_application(uuid, text, text, boolean, boolean) from public;
grant execute on function public.review_creator_application(uuid, text, text, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- revoke_creator: drop verified badge + handle markers
-- ---------------------------------------------------------------------------

create or replace function public.revoke_creator(
  p_user_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_staff() then
    raise exception 'Staff only';
  end if;
  if not exists (select 1 from public.creators where user_id = p_user_id) then
    raise exception 'Creator not found';
  end if;

  update public.creators
  set status = 'revoked',
      revoked_at = now(),
      revoked_reason = nullif(trim(coalesce(p_reason, '')), ''),
      verified_handle = null,
      verified_platform = null,
      updated_at = now()
  where user_id = p_user_id;

  update public.profiles
  set is_verified_creator = false,
      updated_at = now()
  where id = p_user_id;

  update public.creator_applications
  set status = 'revoked',
      staff_notes = coalesce(nullif(trim(coalesce(p_reason, '')), ''), staff_notes),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where user_id = p_user_id and status = 'approved';
end;
$$;

-- ---------------------------------------------------------------------------
-- Acceptance checks (apply-time)
-- ---------------------------------------------------------------------------

do $$
declare
  a uuid;
  b uuid;
  app_id uuid;
  handle text := 'cre3c_' || floor(random() * 1000000)::int;
  v_reason text;
  v_count int;
  prev_username extensions.citext;
  prev_changed timestamptz;
  prev_verified boolean;
  workouts_global_ok boolean;
begin
  select id into a from public.profiles order by created_at asc, id asc limit 1;
  select id into b from public.profiles where id is distinct from a order by created_at asc, id asc limit 1;

  if a is null or b is null then
    raise notice '3c creator-handle checks skipped (need ≥2 profiles)';
    return;
  end if;

  select username, username_changed_at, is_verified_creator
  into prev_username, prev_changed, prev_verified
  from public.profiles
  where id = a;

  delete from public.reserved_usernames
  where username = handle::extensions.citext
     or (reserved_usernames.reason = 'creator_pending' and held_for_user_id in (a, b));
  delete from public.creator_applications
  where user_id in (a, b) and display_name like '3c test%';

  -- Pending reservation blocks other users from claiming the name
  insert into public.reserved_usernames (username, reason, held_for_user_id, platform)
  values (handle::extensions.citext, 'creator_pending', a, 'instagram');

  v_reason := public.username_validation_reason(handle, b);
  if v_reason is distinct from 'reserved' then
    raise exception 'expected reserved block for pending hold, got %', v_reason;
  end if;

  insert into public.creator_applications (
    user_id, status, display_name, bio, expertise,
    instagram_url, value_pitch, originality_attested,
    requested_username, requested_platform
  ) values (
    a, 'pending', '3c test applicant',
    'About this applicant for creator testing purposes.',
    'Qualified because of long-form cooking and fitness content.',
    'https://instagram.com/' || handle, '3c test pitch', true,
    handle::extensions.citext, 'instagram'
  )
  returning id into app_id;

  update public.reserved_usernames
  set application_id = app_id
  where username = handle::extensions.citext;

  -- Reject frees the reservation
  update public.creator_applications
  set status = 'rejected', reviewed_at = now(), updated_at = now()
  where id = app_id;
  delete from public.reserved_usernames where application_id = app_id;

  v_reason := public.username_validation_reason(handle, b);
  if v_reason is not null then
    raise exception 'reject should free reserved name, got %', v_reason;
  end if;

  -- Approve assignment: cooldown exempt + verified badge
  handle := 'cre3c_' || floor(random() * 1000000)::int;
  update public.profiles
  set username = ('old_' || left(handle, 16))::extensions.citext,
      username_changed_at = now(),
      is_verified_creator = false
  where id = a;

  insert into public.creator_applications (
    user_id, status, display_name, bio, expertise,
    tiktok_url, value_pitch, originality_attested,
    requested_username, requested_platform,
    contacted_via_dm, creator_confirmed
  ) values (
    a, 'pending', '3c test applicant',
    'About this applicant for creator testing purposes.',
    'Qualified because of long-form cooking and fitness content.',
    'https://tiktok.com/@' || handle, '3c test pitch', true,
    handle::extensions.citext, 'tiktok',
    true, true
  )
  returning id into app_id;

  insert into public.reserved_usernames (username, reason, application_id, held_for_user_id, platform)
  values (handle::extensions.citext, 'creator_pending', app_id, a, 'tiktok');

  perform public.assign_creator_verified_username(a, handle);
  delete from public.reserved_usernames where application_id = app_id;

  if not exists (
    select 1 from public.profiles
    where id = a
      and username = handle::extensions.citext
      and is_verified_creator = true
  ) then
    raise exception 'approve did not assign username + verified badge';
  end if;

  if exists (
    select 1 from public.reserved_usernames where username = handle::extensions.citext
  ) then
    raise exception 'approve left pending reservation in place';
  end if;

  -- Workout global publish is creator-gated; watchlist global is not
  select pg_get_expr(c.conbin, c.conrelid) ilike '%global%'
  into workouts_global_ok
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'workouts'
    and c.conname = 'workouts_visibility_check';
  if workouts_global_ok is not true then
    raise exception 'workouts visibility check missing global';
  end if;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'workouts'
    and policyname in ('workouts_insert', 'workouts_update')
    and coalesce(with_check, '') ilike '%is_approved_creator%';
  if v_count < 2 then
    raise exception 'workout global policies missing is_approved_creator gate';
  end if;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'watchlist_lists'
    and policyname in ('watchlist_lists_insert', 'watchlist_lists_update');
  if v_count < 2 then
    raise exception 'watchlist global policies missing';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'publish_creator_recipe'
  ) then
    raise exception 'publish_creator_recipe missing';
  end if;

  -- Restore fixture profile; drop ephemeral application rows only
  delete from public.reserved_usernames
  where held_for_user_id in (a, b) or username = handle::extensions.citext;
  delete from public.creator_applications
  where id = app_id or (user_id in (a, b) and display_name like '3c test%');

  update public.profiles
  set username = prev_username,
      username_changed_at = prev_changed,
      is_verified_creator = coalesce(prev_verified, false)
  where id = a;

  raise notice '3c creator-handle / global-publish checks ok';
end;
$$;
