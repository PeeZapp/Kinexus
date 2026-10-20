-- Platform staff, creator applications, and creator catalog publishing.
-- Catalog rows stay blocked from direct client insert; creators publish via RPCs.

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------

create table public.platform_staff (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.platform_staff_invites (
  email text primary key,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table public.platform_staff_bootstrap_emails (
  email text primary key
);

insert into public.platform_staff_bootstrap_emails (email)
values (lower(trim('pzappft@gmail.com')))
on conflict do nothing;

alter table public.platform_staff enable row level security;
alter table public.platform_staff_invites enable row level security;
alter table public.platform_staff_bootstrap_emails enable row level security;

create or replace function public.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_staff where user_id = auth.uid()
  );
$$;

create or replace function public.normalized_auth_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(
    (select email from public.profiles where id = auth.uid()),
    auth.jwt() ->> 'email',
    ''
  )));
$$;

create or replace function public.claim_platform_staff()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_meta jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.platform_staff where user_id = v_uid) then
    return true;
  end if;

  v_email := public.normalized_auth_email();
  if v_email = '' then
    return false;
  end if;

  -- Staff may land on /staff before household ensureProfile runs.
  select raw_user_meta_data into v_meta from auth.users where id = v_uid;
  insert into public.profiles (id, display_name, avatar_url, email)
  values (
    v_uid,
    coalesce(
      nullif(v_meta ->> 'full_name', ''),
      nullif(v_meta ->> 'name', ''),
      split_part(v_email, '@', 1)
    ),
    coalesce(nullif(v_meta ->> 'avatar_url', ''), nullif(v_meta ->> 'picture', '')),
    v_email
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        updated_at = now();

  if exists (
    select 1 from public.platform_staff_bootstrap_emails where email = v_email
  ) then
    insert into public.platform_staff (user_id, invited_by)
    values (v_uid, null)
    on conflict (user_id) do nothing;
    return true;
  end if;

  if exists (
    select 1
    from public.platform_staff_invites
    where email = v_email and accepted_at is null
  ) then
    insert into public.platform_staff (user_id, invited_by)
    select v_uid, invited_by
    from public.platform_staff_invites
    where email = v_email
    on conflict (user_id) do nothing;

    update public.platform_staff_invites
    set accepted_at = now()
    where email = v_email and accepted_at is null;

    return exists (select 1 from public.platform_staff where user_id = v_uid);
  end if;

  return false;
end;
$$;

create or replace function public.invite_platform_staff(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_platform_staff() then
    raise exception 'Staff only';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Enter a valid email';
  end if;
  if exists (
    select 1
    from public.profiles p
    join public.platform_staff s on s.user_id = p.id
    where lower(trim(coalesce(p.email, ''))) = v_email
  ) then
    raise exception 'That account is already staff';
  end if;

  insert into public.platform_staff_invites (email, invited_by)
  values (v_email, auth.uid())
  on conflict (email) do update
    set invited_by = excluded.invited_by,
        created_at = now(),
        accepted_at = null;
end;
$$;

create or replace function public.revoke_platform_staff(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_staff() then
    raise exception 'Staff only';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot remove yourself';
  end if;
  delete from public.platform_staff where user_id = p_user_id;
end;
$$;

create policy platform_staff_select on public.platform_staff
  for select to authenticated
  using (public.is_platform_staff());

create policy platform_staff_invites_select on public.platform_staff_invites
  for select to authenticated
  using (public.is_platform_staff());

-- Bootstrap emails are never readable by clients.
grant select on table public.platform_staff to authenticated;
grant select on table public.platform_staff_invites to authenticated;

grant execute on function public.is_platform_staff() to authenticated;
grant execute on function public.claim_platform_staff() to authenticated;
grant execute on function public.invite_platform_staff(text) to authenticated;
grant execute on function public.revoke_platform_staff(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Creators
-- ---------------------------------------------------------------------------

create type public.creator_application_status as enum (
  'pending',
  'approved',
  'rejected',
  'revoked'
);

create table public.creators (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status public.creator_application_status not null
    check (status in ('approved', 'revoked')),
  display_name text not null,
  approved_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.creator_application_status not null default 'pending',
  display_name text not null check (char_length(trim(display_name)) > 0),
  bio text not null check (char_length(trim(bio)) > 0),
  expertise text not null check (char_length(trim(expertise)) > 0),
  portfolio_url text,
  instagram_url text,
  youtube_url text,
  tiktok_url text,
  website_url text,
  other_links text,
  value_pitch text not null check (char_length(trim(value_pitch)) > 0),
  originality_attested boolean not null default false,
  staff_notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_applications_attestation check (
    status = 'pending' or originality_attested = true or status in ('rejected', 'revoked')
  )
);

create unique index creator_applications_one_pending_idx
  on public.creator_applications (user_id)
  where status = 'pending';

create index creator_applications_status_idx
  on public.creator_applications (status, created_at desc);

alter table public.creators enable row level security;
alter table public.creator_applications enable row level security;

create or replace function public.is_approved_creator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.creators
    where user_id = auth.uid() and status = 'approved'
  );
$$;

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
  if not coalesce(p_originality_attested, false) then
    raise exception 'You must attest that your content is original or licensed';
  end if;
  if char_length(trim(coalesce(p_display_name, ''))) = 0
     or char_length(trim(coalesce(p_bio, ''))) = 0
     or char_length(trim(coalesce(p_expertise, ''))) = 0
     or char_length(trim(coalesce(p_value_pitch, ''))) = 0 then
    raise exception 'Fill in the required application fields';
  end if;
  if coalesce(nullif(trim(p_portfolio_url), ''), nullif(trim(p_instagram_url), ''),
              nullif(trim(p_youtube_url), ''), nullif(trim(p_tiktok_url), ''),
              nullif(trim(p_website_url), ''), nullif(trim(p_other_links), '')) is null then
    raise exception 'Add at least one link so we can verify your work';
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
    trim(p_value_pitch), true
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.review_creator_application(
  p_application_id uuid,
  p_action text,
  p_staff_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
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
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    where id = p_application_id;
    return;
  end if;

  update public.creator_applications
  set status = 'approved',
      staff_notes = nullif(trim(coalesce(p_staff_notes, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_application_id;

  insert into public.creators (user_id, status, display_name, approved_at, revoked_at, revoked_reason, updated_at)
  values (v_app.user_id, 'approved', v_app.display_name, now(), null, null, now())
  on conflict (user_id) do update
    set status = 'approved',
        display_name = excluded.display_name,
        approved_at = now(),
        revoked_at = null,
        revoked_reason = null,
        updated_at = now();
end;
$$;

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
      updated_at = now()
  where user_id = p_user_id;

  update public.creator_applications
  set status = 'revoked',
      staff_notes = coalesce(nullif(trim(coalesce(p_reason, '')), ''), staff_notes),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where user_id = p_user_id and status = 'approved';
end;
$$;

create policy creators_select on public.creators
  for select to authenticated
  using (user_id = auth.uid() or public.is_platform_staff());

create policy creator_applications_select on public.creator_applications
  for select to authenticated
  using (user_id = auth.uid() or public.is_platform_staff());

grant select on table public.creators to authenticated;
grant select on table public.creator_applications to authenticated;

grant execute on function public.is_approved_creator() to authenticated;
grant execute on function public.submit_creator_application(
  text, text, text, text, text, text, text, text, text, text, boolean
) to authenticated;
grant execute on function public.review_creator_application(uuid, text, text) to authenticated;
grant execute on function public.revoke_creator(uuid, text) to authenticated;

-- Staff can read profiles of applicants / creators for review.
create policy profiles_staff_select on public.profiles
  for select to authenticated
  using (
    public.is_platform_staff()
    and (
      exists (select 1 from public.creator_applications a where a.user_id = profiles.id)
      or exists (select 1 from public.creators c where c.user_id = profiles.id)
      or exists (select 1 from public.platform_staff s where s.user_id = profiles.id)
    )
  );

-- ---------------------------------------------------------------------------
-- Recipe attribution + creator publish trail
-- ---------------------------------------------------------------------------

alter table public.recipes
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists creator_published_at timestamptz,
  add column if not exists creator_source_recipe_id uuid references public.recipes (id) on delete set null;

create index if not exists recipes_created_by_idx
  on public.recipes (created_by)
  where created_by is not null;

create index if not exists recipes_creator_published_at_idx
  on public.recipes (creator_published_at desc)
  where creator_published_at is not null;

create unique index if not exists recipes_creator_source_unique_idx
  on public.recipes (creator_source_recipe_id)
  where creator_source_recipe_id is not null;

alter table public.recipes
  drop constraint if exists recipes_creator_source_catalog_only;

alter table public.recipes
  add constraint recipes_creator_source_catalog_only
  check (creator_source_recipe_id is null or household_id is null);

create table public.creator_content_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('recipe')),
  content_id uuid not null,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  published_at timestamptz not null default now()
);

create index creator_content_events_day_idx
  on public.creator_content_events (published_at desc, kind);

alter table public.creator_content_events enable row level security;

create policy creator_content_events_select on public.creator_content_events
  for select to authenticated
  using (public.is_platform_staff() or creator_id = auth.uid());

grant select on table public.creator_content_events to authenticated;

create or replace function public.slugify_catalog_fragment(p_text text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    lower(regexp_replace(coalesce(p_text, ''), '[^a-zA-Z0-9]+', '-', 'g')),
    '-+', '-', 'g'
  ));
$$;

create or replace function public.publish_creator_recipe(p_source_recipe_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_src public.recipes%rowtype;
  v_existing uuid;
  v_id uuid;
  v_key text;
  v_slug text;
  v_short text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_approved_creator() then
    raise exception 'Only approved creators can publish to the library';
  end if;

  select * into v_src
  from public.recipes
  where id = p_source_recipe_id
  for share;

  if not found then
    raise exception 'Recipe not found';
  end if;
  if v_src.household_id is null then
    raise exception 'Publish from a household recipe';
  end if;
  if not public.is_household_member(v_src.household_id) then
    raise exception 'Not a member of that household';
  end if;
  if char_length(trim(v_src.name)) = 0 then
    raise exception 'Recipe needs a name';
  end if;
  if jsonb_typeof(v_src.ingredients) <> 'array' or jsonb_array_length(v_src.ingredients) < 1 then
    raise exception 'Add at least one ingredient before publishing';
  end if;
  if jsonb_typeof(v_src.method) <> 'array' or jsonb_array_length(v_src.method) < 1 then
    raise exception 'Add method steps before publishing';
  end if;

  select id into v_existing
  from public.recipes
  where creator_source_recipe_id = p_source_recipe_id
    and created_by = v_uid
  limit 1;

  if v_existing is not null then
    update public.recipes set
      name = v_src.name,
      emoji = v_src.emoji,
      cuisine = v_src.cuisine,
      cook_time = v_src.cook_time,
      servings = v_src.servings,
      protein = v_src.protein,
      calories = v_src.calories,
      carbs = v_src.carbs,
      fat = v_src.fat,
      vegetarian = v_src.vegetarian,
      ingredients = v_src.ingredients,
      method = v_src.method,
      chef_tip = v_src.chef_tip,
      notes = v_src.notes,
      meal_slots = v_src.meal_slots,
      is_component = v_src.is_component,
      excluded_from_auto = false,
      source_url = v_src.source_url,
      image_url = v_src.image_url,
      removed = false,
      creator_published_at = now(),
      updated_at = now()
    where id = v_existing;

    insert into public.creator_content_events (kind, content_id, creator_id, title, published_at)
    values ('recipe', v_existing, v_uid, v_src.name, now());

    return v_existing;
  end if;

  v_short := replace(left(v_uid::text, 8), '-', '');
  v_slug := public.slugify_catalog_fragment(v_src.name);
  if v_slug = '' then
    v_slug := 'recipe';
  end if;
  v_key := 'creator_' || v_short || '_' || left(v_slug, 48);
  if exists (select 1 from public.recipes where catalog_key = v_key) then
    v_key := v_key || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  end if;

  insert into public.recipes (
    household_id, catalog_key, name, emoji, cuisine, cook_time, servings,
    protein, calories, carbs, fat, vegetarian, ingredients, method,
    chef_tip, notes, meal_slots, is_component, excluded_from_auto,
    is_public, source_url, image_url, removed, created_by,
    creator_published_at, creator_source_recipe_id
  ) values (
    null, v_key, v_src.name, v_src.emoji, v_src.cuisine, v_src.cook_time, v_src.servings,
    v_src.protein, v_src.calories, v_src.carbs, v_src.fat, v_src.vegetarian,
    v_src.ingredients, v_src.method, v_src.chef_tip, v_src.notes, v_src.meal_slots,
    v_src.is_component, false, true, v_src.source_url, v_src.image_url, false,
    v_uid, now(), p_source_recipe_id
  )
  returning id into v_id;

  insert into public.creator_content_events (kind, content_id, creator_id, title, published_at)
  values ('recipe', v_id, v_uid, v_src.name, now());

  return v_id;
end;
$$;

create or replace function public.unpublish_creator_recipe(p_recipe_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.recipes%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from public.recipes where id = p_recipe_id for update;
  if not found then
    raise exception 'Recipe not found';
  end if;
  if v_row.household_id is not null or v_row.created_by is null then
    raise exception 'Not a creator-published recipe';
  end if;
  if v_row.created_by <> v_uid and not public.is_platform_staff() then
    raise exception 'Not allowed';
  end if;
  if v_row.created_by = v_uid and not public.is_approved_creator() and not public.is_platform_staff() then
    raise exception 'Creator access revoked';
  end if;

  update public.recipes
  set removed = true, updated_at = now()
  where id = p_recipe_id;
end;
$$;

create or replace function public.staff_creator_content_digest(p_day date default (timezone('utc', now()))::date)
returns table (
  event_id uuid,
  kind text,
  content_id uuid,
  creator_id uuid,
  creator_display_name text,
  title text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.kind,
    e.content_id,
    e.creator_id,
    coalesce(c.display_name, p.display_name, p.email, 'Creator'),
    e.title,
    e.published_at
  from public.creator_content_events e
  left join public.creators c on c.user_id = e.creator_id
  left join public.profiles p on p.id = e.creator_id
  where public.is_platform_staff()
    and (e.published_at at time zone 'utc')::date = p_day
  order by e.published_at desc;
$$;

grant execute on function public.publish_creator_recipe(uuid) to authenticated;
grant execute on function public.unpublish_creator_recipe(uuid) to authenticated;
grant execute on function public.staff_creator_content_digest(date) to authenticated;
