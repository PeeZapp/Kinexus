-- Optional personal usernames on top of permanent global_handle.
-- Domain (packages/domain/src/moderation/profanity.ts) remains the source of truth
-- for the profanity block/allow lists; SQL embeds the same lists so set_username /
-- check_username_available are authoritative server-side.

-- ---------------------------------------------------------------------------
-- Format constraint (null allowed)
-- ---------------------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_username_format_check;

alter table public.profiles
  add constraint profiles_username_format_check
  check (
    username is null
    or (
      char_length(username::text) between 3 and 24
      and username::text ~ '^[a-z0-9._]+$'
      and username::text !~ '^\.'
      and username::text !~ '\.$'
      and username::text !~ '\.\.'
    )
  );

-- ---------------------------------------------------------------------------
-- Reserved usernames (system seeds; 3c will add creator handles)
-- ---------------------------------------------------------------------------

create table if not exists public.reserved_usernames (
  username extensions.citext primary key,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.reserved_usernames enable row level security;

insert into public.reserved_usernames (username, reason) values
  ('admin', 'system'),
  ('kinexus', 'system'),
  ('support', 'system'),
  ('staff', 'system'),
  ('official', 'system'),
  ('moderator', 'system')
on conflict (username) do nothing;

-- ---------------------------------------------------------------------------
-- Lookalike key: strip separators so sunny.otter.1234 ≡ Sunny-Otter-1234
-- ---------------------------------------------------------------------------

create or replace function public.normalize_username_key(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(regexp_replace(coalesce(p_value, ''), '[._\-]+', '', 'g'));
$$;

revoke all on function public.normalize_username_key(text) from public;

-- ---------------------------------------------------------------------------
-- Profanity (mirrors packages/domain/src/moderation/profanity.ts)
-- ---------------------------------------------------------------------------

create or replace function public.username_contains_profanity(p_input text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  blocklist text[] := array[
    'anal', 'anus', 'arse', 'ass', 'asshole', 'ballsack', 'bastard', 'bitch',
    'biatch', 'bloody', 'blowjob', 'bollock', 'bollok', 'boner', 'boob', 'bugger',
    'bum', 'buttplug', 'clitoris', 'cock', 'coon', 'crap', 'cunt', 'damn', 'dick',
    'dildo', 'dyke', 'fag', 'faggot', 'feck', 'fellate', 'fellatio', 'felching',
    'fuck', 'fudgepacker', 'flange', 'goddamn', 'hell', 'homo', 'jerk', 'jizz',
    'knobend', 'labia', 'muff', 'nigger', 'nigga', 'penis', 'piss', 'poop',
    'prick', 'pube', 'pussy', 'queer', 'scrotum', 'sex', 'shit', 'slut', 'smegma',
    'spunk', 'tit', 'tosser', 'turd', 'twat', 'vagina', 'wank', 'whore', 'wtf',
    'retard', 'retarded', 'rape', 'rapist', 'molest', 'pedo', 'paedo', 'nazis',
    'nazi', 'fck', 'fuk', 'fock', 'fvck', 'fcuk'
  ];
  -- Longest first for masking (Scunthorpe). Mirrors domain ALLOWLIST.
  allowlist text[] := array[
    'constitution', 'assumption', 'associate', 'assembly', 'assemble', 'assassin',
    'scunthorpe', 'shiitake', 'shitake', 'therapist', 'middlesex', 'hellenic',
    'cucumber', 'document', 'espresso', 'cocktail', 'peacock', 'hancock',
    'dickens', 'analysis', 'analyst', 'arsenal', 'balloon', 'bassoon', 'classic',
    'compass', 'passion', 'raccoon', 'racoon', 'assault', 'assert', 'assess',
    'asset', 'assign', 'assist', 'sussex', 'essex', 'title', 'attitude', 'grape',
    'hello', 'shell', 'brass', 'class', 'canal', 'scrap', 'bass', 'pass'
  ];
  lower_in text;
  chars text[];
  variants text[] := array[''];
  next_variants text[];
  ch text;
  mapped text;
  variant text;
  letters_only text;
  collapsed text;
  candidates text[] := array[]::text[];
  candidate text;
  masked text;
  allowed text;
  word text;
begin
  if trim(coalesce(p_input, '')) = '' then
    return false;
  end if;

  lower_in := lower(p_input);
  chars := string_to_array(lower_in, null);

  -- Expand ambiguous leet (1 → i|l); map other leet digits/symbols.
  foreach ch in array chars loop
    next_variants := array[]::text[];
    if ch = '1' then
      foreach variant in array variants loop
        next_variants := next_variants || (variant || 'i') || (variant || 'l');
      end loop;
    else
      mapped := case ch
        when '0' then 'o'
        when '3' then 'e'
        when '4' then 'a'
        when '5' then 's'
        when '7' then 't'
        when '@' then 'a'
        when '$' then 's'
        else ch
      end;
      foreach variant in array variants loop
        next_variants := next_variants || (variant || mapped);
      end loop;
    end if;
    variants := next_variants;
  end loop;

  foreach variant in array variants loop
    letters_only := regexp_replace(variant, '[^a-z]', '', 'g');
    if letters_only <> '' then
      candidates := candidates || letters_only;
      collapsed := regexp_replace(letters_only, '(.)\1+', '\1', 'g');
      if collapsed <> '' then
        candidates := candidates || collapsed;
      end if;
    end if;
  end loop;

  -- Digits-as-separators only (no letter substitution).
  letters_only := regexp_replace(lower_in, '[^a-z]', '', 'g');
  if letters_only <> '' then
    candidates := candidates || letters_only;
    collapsed := regexp_replace(letters_only, '(.)\1+', '\1', 'g');
    if collapsed <> '' then
      candidates := candidates || collapsed;
    end if;
  end if;

  foreach candidate in array candidates loop
    masked := candidate;
    foreach allowed in array allowlist loop
      masked := replace(masked, allowed, repeat(' ', char_length(allowed)));
    end loop;
    masked := replace(masked, ' ', '');
    if masked = '' then
      continue;
    end if;

    foreach word in array blocklist loop
      if position(word in masked) > 0 then
        return true;
      end if;
    end loop;

    collapsed := regexp_replace(masked, '(.)\1+', '\1', 'g');
    if collapsed <> '' and collapsed <> masked then
      foreach word in array blocklist loop
        if position(word in collapsed) > 0 then
          return true;
        end if;
      end loop;
    end if;
  end loop;

  return false;
end;
$$;

revoke all on function public.username_contains_profanity(text) from public;

-- ---------------------------------------------------------------------------
-- Shared validation → reason code or null when ok
-- ---------------------------------------------------------------------------

create or replace function public.username_validation_reason(
  p_username text,
  p_exclude_user_id uuid default null
)
returns text
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  u text := lower(trim(coalesce(p_username, '')));
  key text;
begin
  if u = '' then
    return 'invalid_format';
  end if;

  if char_length(u) < 3 or char_length(u) > 24 then
    return 'invalid_format';
  end if;
  if u !~ '^[a-z0-9._]+$' then
    return 'invalid_format';
  end if;
  if u ~ '^\.' or u ~ '\.$' or u ~ '\.\.' then
    return 'invalid_format';
  end if;

  if exists (
    select 1 from public.reserved_usernames r where r.username = u::extensions.citext
  ) then
    return 'reserved';
  end if;

  if public.username_contains_profanity(u) then
    return 'profanity';
  end if;

  key := public.normalize_username_key(u);

  -- Must not equal or look like any permanent handle (including the caller's).
  if exists (
    select 1
    from public.profiles p
    where public.normalize_username_key(p.global_handle::text) = key
  ) then
    return 'handle_collision';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.username = u::extensions.citext
      and (p_exclude_user_id is null or p.id <> p_exclude_user_id)
  ) then
    return 'taken';
  end if;

  return null;
end;
$$;

revoke all on function public.username_validation_reason(text, uuid) from public;

create or replace function public.username_suggestions(
  p_base text,
  p_exclude_user_id uuid default null,
  p_limit int default 3
)
returns text[]
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  base text := lower(regexp_replace(trim(coalesce(p_base, '')), '[^a-z0-9._]', '', 'g'));
  out text[] := array[]::text[];
  candidate text;
  n int;
  attempt int := 0;
begin
  if char_length(base) < 1 then
    base := 'user';
  end if;
  if char_length(base) > 18 then
    base := left(base, 18);
  end if;
  -- Avoid leading/trailing/double dots in the stem.
  base := regexp_replace(base, '^\.+', '');
  base := regexp_replace(base, '\.+$', '');
  base := regexp_replace(base, '\.{2,}', '.');
  if base = '' or base ~ '^\.|\.$|\.\.' then
    base := 'user';
  end if;

  while coalesce(array_length(out, 1), 0) < p_limit and attempt < 40 loop
    attempt := attempt + 1;
    n := 100 + floor(random() * 900)::int;
    if attempt % 2 = 0 then
      candidate := left(base, 20) || n::text;
    else
      candidate := left(base, 19) || '_' || n::text;
    end if;
    if char_length(candidate) > 24 then
      candidate := right(candidate, 24);
      candidate := regexp_replace(candidate, '^\.+', '');
    end if;
    if public.username_validation_reason(candidate, p_exclude_user_id) is null
       and not (candidate = any (out))
    then
      out := out || candidate;
    end if;
  end loop;

  return out;
end;
$$;

revoke all on function public.username_suggestions(text, uuid, int) from public;

-- ---------------------------------------------------------------------------
-- RPC: check_username_available
-- ---------------------------------------------------------------------------

create or replace function public.check_username_available(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  u text := lower(trim(coalesce(p_username, '')));
  uid uuid := auth.uid();
  reason text;
  suggestions text[];
begin
  if uid is not null and exists (
    select 1 from public.profiles p
    where p.id = uid and p.username = u::extensions.citext
  ) then
    return jsonb_build_object(
      'ok', true,
      'reason', null,
      'suggestions', '[]'::jsonb
    );
  end if;

  reason := public.username_validation_reason(u, uid);
  if reason is null then
    return jsonb_build_object(
      'ok', true,
      'reason', null,
      'suggestions', '[]'::jsonb
    );
  end if;

  suggestions := public.username_suggestions(u, uid, 3);
  return jsonb_build_object(
    'ok', false,
    'reason', reason,
    'suggestions', to_jsonb(suggestions)
  );
end;
$$;

revoke all on function public.check_username_available(text) from public;
grant execute on function public.check_username_available(text) to authenticated;

-- ---------------------------------------------------------------------------
-- set_username_for: shared mutation (used by RPC + apply-time tests)
-- ---------------------------------------------------------------------------

create or replace function public.set_username_for(p_user_id uuid, p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_username extensions.citext;
  changed_at timestamptz;
  u text;
  reason text;
  suggestions text[];
  retry_at timestamptz;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  select p.username, p.username_changed_at
  into current_username, changed_at
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Clear (empty string treated as clear)
  if p_username is null or trim(p_username) = '' then
    if current_username is null then
      return jsonb_build_object('ok', true, 'reason', null);
    end if;

    if changed_at is not null and changed_at > now() - interval '30 days' then
      retry_at := changed_at + interval '30 days';
      return jsonb_build_object(
        'ok', false,
        'reason', 'cooldown',
        'retry_at', to_jsonb(retry_at)
      );
    end if;

    update public.profiles
    set username = null,
        username_changed_at = now()
    where id = p_user_id;

    return jsonb_build_object('ok', true, 'reason', null);
  end if;

  u := lower(trim(p_username));

  if current_username is not null and current_username = u::extensions.citext then
    return jsonb_build_object('ok', true, 'reason', null);
  end if;

  if changed_at is not null and changed_at > now() - interval '30 days' then
    retry_at := changed_at + interval '30 days';
    return jsonb_build_object(
      'ok', false,
      'reason', 'cooldown',
      'retry_at', to_jsonb(retry_at)
    );
  end if;

  reason := public.username_validation_reason(u, p_user_id);
  if reason is not null then
    suggestions := public.username_suggestions(u, p_user_id, 3);
    return jsonb_build_object(
      'ok', false,
      'reason', reason,
      'suggestions', to_jsonb(suggestions)
    );
  end if;

  update public.profiles
  set username = u::extensions.citext,
      username_changed_at = now()
  where id = p_user_id;

  return jsonb_build_object('ok', true, 'reason', null);
end;
$$;

revoke all on function public.set_username_for(uuid, text) from public;

create or replace function public.set_username(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return public.set_username_for(auth.uid(), p_username);
end;
$$;

revoke all on function public.set_username(text) from public;
grant execute on function public.set_username(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Acceptance checks (run at apply time)
-- ---------------------------------------------------------------------------

do $$
declare
  r jsonb;
  reason text;
begin
  -- Invalid formats
  reason := public.username_validation_reason('ab', null);
  if reason is distinct from 'invalid_format' then
    raise exception 'expected short username invalid_format, got %', reason;
  end if;

  reason := public.username_validation_reason(repeat('a', 25), null);
  if reason is distinct from 'invalid_format' then
    raise exception 'expected long username invalid_format, got %', reason;
  end if;

  reason := public.username_validation_reason('Bad Name!', null);
  if reason is distinct from 'invalid_format' then
    raise exception 'expected charset invalid_format, got %', reason;
  end if;

  reason := public.username_validation_reason('.leading', null);
  if reason is distinct from 'invalid_format' then
    raise exception 'expected leading-dot invalid_format, got %', reason;
  end if;

  reason := public.username_validation_reason('trailing.', null);
  if reason is distinct from 'invalid_format' then
    raise exception 'expected trailing-dot invalid_format, got %', reason;
  end if;

  reason := public.username_validation_reason('dou..ble', null);
  if reason is distinct from 'invalid_format' then
    raise exception 'expected double-dot invalid_format, got %', reason;
  end if;

  -- Profanity
  reason := public.username_validation_reason('fuck', null);
  if reason is distinct from 'profanity' then
    raise exception 'expected fuck → profanity, got %', reason;
  end if;

  reason := public.username_validation_reason('sh1t', null);
  if reason is distinct from 'profanity' then
    raise exception 'expected sh1t → profanity, got %', reason;
  end if;

  reason := public.username_validation_reason('f.u.c.k', null);
  if reason is distinct from 'profanity' then
    raise exception 'expected f.u.c.k → profanity, got %', reason;
  end if;

  if public.username_contains_profanity('raccoon') then
    raise exception 'false positive: raccoon';
  end if;
  if public.username_contains_profanity('classic') then
    raise exception 'false positive: classic';
  end if;

  -- Reserved
  reason := public.username_validation_reason('admin', null);
  if reason is distinct from 'reserved' then
    raise exception 'expected admin → reserved, got %', reason;
  end if;

  reason := public.username_validation_reason('Kinexus', null);
  if reason is distinct from 'reserved' then
    raise exception 'expected Kinexus → reserved, got %', reason;
  end if;

  -- check_username_available shape
  r := public.check_username_available('ab');
  if (r->>'ok')::boolean is not false or r->>'reason' is distinct from 'invalid_format' then
    raise exception 'check_username_available format failed: %', r;
  end if;
  if jsonb_typeof(r->'suggestions') is distinct from 'array' then
    raise exception 'check_username_available missing suggestions: %', r;
  end if;

  r := public.check_username_available('admin');
  if (r->>'ok')::boolean is not false or r->>'reason' is distinct from 'reserved' then
    raise exception 'check_username_available reserved failed: %', r;
  end if;

  raise notice 'username format/profanity/reserved checks ok';
end;
$$;

do $$
declare
  a uuid;
  b uuid;
  a_handle text;
  lookalike text;
  r jsonb;
  reason text;
  claimed text := 'unique_name_' || floor(random() * 1000000)::int;
  claimed2 text := 'unique_name_' || floor(random() * 1000000)::int;
begin
  select id, global_handle::text
  into a, a_handle
  from public.profiles
  order by created_at asc, id asc
  limit 1;

  select id into b
  from public.profiles
  where id <> a
  order by created_at asc, id asc
  limit 1;

  if a is null then
    raise notice 'username set/cooldown checks skipped (no profiles)';
    return;
  end if;

  -- Lookalike of an existing handle must be rejected.
  lookalike := lower(replace(replace(a_handle, '-', '.'), '_', '.'));
  if lookalike ~ '^[a-z0-9._]+$'
     and lookalike !~ '^\.'
     and lookalike !~ '\.$'
     and lookalike !~ '\.\.'
     and char_length(lookalike) between 3 and 24
  then
    reason := public.username_validation_reason(lookalike, b);
    if reason is distinct from 'handle_collision' then
      raise exception 'expected handle lookalike collision, got % for %', reason, lookalike;
    end if;
  end if;

  -- Reset cooldown so first set works
  update public.profiles
  set username = null, username_changed_at = null
  where id = a;

  r := public.set_username_for(a, claimed);
  if (r->>'ok')::boolean is not true then
    raise exception 'first set_username failed: %', r;
  end if;

  if not exists (
    select 1 from public.profiles where id = a and username = claimed::extensions.citext
  ) then
    raise exception 'username not persisted';
  end if;

  -- Second change within 30 days rejected (new name)
  r := public.set_username_for(a, claimed2);
  if (r->>'ok')::boolean is not false or r->>'reason' is distinct from 'cooldown' then
    raise exception 'expected cooldown on second set, got %', r;
  end if;

  -- Clearing also counts / is rejected within cooldown
  r := public.set_username_for(a, null);
  if (r->>'ok')::boolean is not false or r->>'reason' is distinct from 'cooldown' then
    raise exception 'expected cooldown on clear, got %', r;
  end if;

  -- Expire cooldown, clear — old name released immediately
  update public.profiles
  set username_changed_at = now() - interval '31 days'
  where id = a;

  r := public.set_username_for(a, null);
  if (r->>'ok')::boolean is not true then
    raise exception 'clear after cooldown failed: %', r;
  end if;

  if exists (select 1 from public.profiles where id = a and username is not null) then
    raise exception 'username not cleared';
  end if;

  -- Old name reusable immediately by another user (if we have one)
  if b is not null then
    update public.profiles
    set username = null, username_changed_at = null
    where id = b;

    r := public.set_username_for(b, claimed);
    if (r->>'ok')::boolean is not true then
      raise exception 'old name not reusable immediately: %', r;
    end if;

    update public.profiles
    set username = null, username_changed_at = null
    where id = b;
  end if;

  update public.profiles
  set username = null, username_changed_at = null
  where id = a;

  raise notice 'username set/cooldown/reuse checks ok';
end;
$$;
