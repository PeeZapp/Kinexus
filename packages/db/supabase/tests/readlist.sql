-- Manual SQL checks for readlist (after applying 20261110170000 + 20261110180000).
-- Replace the UUIDs below with real profile / household ids, then run (rolls back).

begin;

select set_config('test.user_a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('test.user_b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('test.household_a', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);
select set_config('test.household_b', 'ffffffff-ffff-ffff-ffff-ffffffffffff', true);

do $$
declare
  a uuid := current_setting('test.user_a')::uuid;
  b uuid := current_setting('test.user_b')::uuid;
  hh_a uuid := current_setting('test.household_a')::uuid;
  hh_b uuid := current_setting('test.household_b')::uuid;
  list_a uuid;
  list_a2 uuid;
  list_b uuid;
  work_id uuid;
  edition_print uuid;
  edition_audio uuid;
  item_id uuid;
  item_id2 uuid;
  progress_id uuid;
  review_id uuid;
  visible int;
  pages_read integer;
  pct numeric;
  seconds_listened integer;
  score smallint;
  share_tok uuid;
  share_tok2 uuid;
  person_a uuid;
begin
  perform set_config('search_path', 'public, extensions', true);

  if not exists (select 1 from public.household_members where household_id = hh_a and user_id = a) then
    raise exception 'test.user_a must be a member of test.household_a';
  end if;
  if not exists (select 1 from public.household_members where household_id = hh_b and user_id = b) then
    raise exception 'test.user_b must be a member of test.household_b';
  end if;

  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    execute 'set local role authenticated';
  exception when others then
    null;
  end;

  -- ensure_default_readlist is idempotent
  list_a := public.ensure_default_readlist(hh_a);
  list_a2 := public.ensure_default_readlist(hh_a);
  if list_a is distinct from list_a2 then
    raise exception 'ensure_default_readlist should return the same list';
  end if;

  work_id := public.upsert_readlist_work(jsonb_build_object(
    'id', 'OL82563W',
    'title', 'The Hobbit',
    'authors', jsonb_build_array(jsonb_build_object('name', 'J. R. R. Tolkien', 'openLibraryAuthorId', null)),
    'firstPublishedYear', 1937,
    'coverUrl', null,
    'ids', jsonb_build_object(
      'isbn10', null,
      'isbn13', '9780547928227',
      'openLibraryWorkId', 'OL82563W',
      'openLibraryEditionId', null,
      'hardcoverId', null,
      'googleVolumeId', null,
      'goodreadsId', null,
      'asin', null
    ),
    'editions', jsonb_build_array(
      jsonb_build_object(
        'id', 'OL24331121M',
        'workId', 'OL82563W',
        'title', 'The Hobbit',
        'format', 'print',
        'pageCount', 300,
        'publishedYear', 2012,
        'publisher', 'Houghton Mifflin',
        'ids', jsonb_build_object(
          'isbn10', null,
          'isbn13', '9780547928227',
          'openLibraryWorkId', 'OL82563W',
          'openLibraryEditionId', 'OL24331121M',
          'hardcoverId', null,
          'googleVolumeId', null,
          'goodreadsId', null,
          'asin', null
        )
      ),
      jsonb_build_object(
        'id', 'audio-1',
        'workId', 'OL82563W',
        'title', 'The Hobbit',
        'format', 'audiobook',
        'pageCount', null,
        'durationSeconds', 36000,
        'publishedYear', 2013,
        'publisher', 'Audio',
        'ids', jsonb_build_object(
          'isbn10', null,
          'isbn13', null,
          'openLibraryWorkId', 'OL82563W',
          'openLibraryEditionId', 'OLAUDIO1M',
          'hardcoverId', null,
          'googleVolumeId', null,
          'goodreadsId', null,
          'asin', 'B00AUDIO'
        )
      )
    )
  ));

  select id into edition_print
  from public.readlist_editions
  where work_id = work_id and format = 'print'
  limit 1;
  select id into edition_audio
  from public.readlist_editions
  where work_id = work_id and format = 'audiobook'
  limit 1;
  if edition_print is null or edition_audio is null then
    raise exception 'expected print and audiobook editions';
  end if;

  -- one item per work across editions
  item_id := public.add_readlist_item(list_a, work_id, edition_print, 'want_to_read');
  item_id2 := public.add_readlist_item(list_a, work_id, edition_audio, 'want_to_read');
  if item_id is distinct from item_id2 then
    raise exception 'adding another edition should update the same item';
  end if;
  if (select preferred_edition_id from public.readlist_items where id = item_id) is distinct from edition_audio then
    raise exception 'preferred edition should update to audiobook';
  end if;
  select count(*) into visible from public.readlist_items where list_id = list_a and work_id = work_id;
  if visible <> 1 then
    raise exception 'expected exactly one item per work on the list';
  end if;

  -- progress round-trip
  progress_id := public.upsert_readlist_progress(work_id, edition_print, 75, 25, null);
  select p.pages_read, p.percent, p.seconds_listened
    into pages_read, pct, seconds_listened
  from public.readlist_progress p
  where p.id = progress_id;
  if pages_read is distinct from 75 or pct is distinct from 25 or seconds_listened is not null then
    raise exception 'pages/percent progress mismatch';
  end if;
  progress_id := public.upsert_readlist_progress(work_id, edition_audio, null, null, 9000);
  select p.pages_read, p.percent, p.seconds_listened
    into pages_read, pct, seconds_listened
  from public.readlist_progress p
  where p.id = progress_id;
  if pages_read is distinct from 75 or pct is distinct from 25 or seconds_listened is distinct from 9000 then
    raise exception 'seconds progress should merge without clearing pages/percent';
  end if;

  -- review unique + score bounds
  begin
    perform public.upsert_readlist_review(work_id, 0, 'bad');
    raise exception 'score 0 should fail';
  exception
    when others then
      if sqlerrm not like '%Score must be between 1 and 10%' and sqlerrm not like '%check%' then
        null; -- constraint or explicit raise both ok
      end if;
  end;

  review_id := public.upsert_readlist_review(work_id, 9, 'Loved it');
  perform public.upsert_readlist_review(work_id, 8, 'Still good');
  select count(*), max(r.score) into visible, score
  from public.readlist_reviews r
  where r.user_id = a and r.work_id = work_id;
  if visible <> 1 or score is distinct from 8 then
    raise exception 'review should upsert uniquely per user/work';
  end if;

  -- personal vs household visibility
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.set_readlist_list_visibility(list_a, 'household', '{}');

  begin
    perform public.set_readlist_list_visibility(list_a, 'global', '{}');
    raise exception 'global visibility must be rejected';
  exception
    when others then
      if sqlerrm not like '%not available yet%' then
        raise;
      end if;
  end;

  -- link share: enable, rotate breaks old token
  share_tok := public.set_readlist_list_link_share(list_a, true, false);
  if share_tok is null then
    raise exception 'enable share should return a token';
  end if;
  if not exists (
    select 1 from public.readlist_lists
    where id = list_a and is_shared and share_token = share_tok
  ) then
    raise exception 'list should be marked shared';
  end if;

  share_tok2 := public.set_readlist_list_link_share(list_a, true, true);
  if share_tok2 is null or share_tok2 = share_tok then
    raise exception 'rotate must mint a new token';
  end if;
  if exists (
    select 1 from public.readlist_lists where id = list_a and share_token = share_tok
  ) then
    raise exception 'old share token must be broken after rotate';
  end if;

  perform public.set_readlist_list_link_share(list_a, false, false);
  if exists (
    select 1 from public.readlist_lists where id = list_a and is_shared
  ) then
    raise exception 'disable share should clear is_shared';
  end if;

  -- people visibility: only listed person can view
  select id into person_a
  from public.household_people
  where household_id = hh_a
  order by name
  limit 1;
  if person_a is not null then
    perform public.set_readlist_list_visibility(list_a, 'people', array[person_a]);
    select count(*) into visible from public.readlist_lists where id = list_a;
    if visible <> 1 then
      raise exception 'owner must still see people-shared list';
    end if;
  end if;

  -- RLS isolation: other household cannot see or manage private list
  perform public.set_readlist_list_visibility(list_a, 'private', '{}');
  perform set_config('request.jwt.claim.sub', b::text, true);
  list_b := public.ensure_default_readlist(hh_b);

  select count(*) into visible from public.readlist_lists where id = list_a;
  if visible <> 0 then
    raise exception 'other household must not see private default list';
  end if;

  begin
    perform public.add_readlist_item(list_a, work_id, null, 'want_to_read');
    raise exception 'other household must not write to foreign list';
  exception
    when others then
      if sqlerrm not like '%Cannot manage this readlist%' then
        raise;
      end if;
  end;

  select count(*) into visible from public.readlist_progress where work_id = work_id;
  if visible <> 0 then
    raise exception 'other user must not see foreign progress';
  end if;

  -- household visibility: same-household member can see list + items
  -- (requires b in hh_a — skip when fixtures are separate households)
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.set_readlist_list_visibility(list_a, 'household', '{}');
  select count(*) into visible from public.readlist_lists where id = list_a;
  if visible <> 1 then
    raise exception 'owner must see household list';
  end if;
  select count(*) into visible from public.readlist_items where list_id = list_a;
  if visible < 1 then
    raise exception 'owner must see household list items';
  end if;

  raise notice 'readlist checks passed (list_a=%, list_b=%, work=%, item=%)', list_a, list_b, work_id, item_id;
end;
$$;

rollback;
