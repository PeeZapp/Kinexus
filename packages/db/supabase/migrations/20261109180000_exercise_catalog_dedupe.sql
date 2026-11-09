-- Near-dedupe catalogue exercises: keep one visible row per movement+equipment+target.
-- Non-canonical rows get merged_into + status=hidden (never deleted).
-- Missing media / instructions / secondary muscles copy onto the canonical row;
-- hidden names become aliases for search.

alter table public.exercises
  add column if not exists merged_into uuid references public.exercises (id),
  add column if not exists aliases text[] not null default '{}';

create index if not exists exercises_merged_into_idx
  on public.exercises (merged_into)
  where merged_into is not null;

create index if not exists exercises_aliases_gin_idx
  on public.exercises using gin (aliases);

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Crunches on Machine']::text[]) as a)
where id = '0b913ca0-f523-5fe9-9cd5-ebfc3fb588c3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '0b913ca0-f523-5fe9-9cd5-ebfc3fb588c3',
  status = 'hidden'
where id = '2226685c-e2da-5aed-bdec-b31a815c3d57'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Cable Crunch', 'cable standing crunch', 'Rope Crunch', 'Side Crunch', 'Standing Rope Crunch']::text[]) as a)
where id = 'af808df8-dd0a-59c8-bb3f-e1c16ddeecee'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'af808df8-dd0a-59c8-bb3f-e1c16ddeecee',
  status = 'hidden'
where id = '9bfb002b-d4d4-542e-aed2-62df668a8d63'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'af808df8-dd0a-59c8-bb3f-e1c16ddeecee',
  status = 'hidden'
where id = '378756f8-be38-5f87-b963-24c104a224b2'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'af808df8-dd0a-59c8-bb3f-e1c16ddeecee',
  status = 'hidden'
where id = '284d5244-5831-5e42-b6ce-8d5f0e810ce2'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'af808df8-dd0a-59c8-bb3f-e1c16ddeecee',
  status = 'hidden'
where id = '3dd3f6f7-791c-5bbf-95ea-a06cf95755b6'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'af808df8-dd0a-59c8-bb3f-e1c16ddeecee',
  status = 'hidden'
where id = 'a775ab97-2779-5485-9c82-3819fbb417c8'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Standing Side Crunches']::text[]) as a)
where id = '00c7c28c-aa16-5ad5-a318-53181b6dce34'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '00c7c28c-aa16-5ad5-a318-53181b6dce34',
  status = 'hidden'
where id = 'fe843fd2-3e6a-5def-a666-359c2fc6b626'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Alternating dumbbell hammer curl']::text[]) as a)
where id = '5f0695a0-710a-5601-9e78-e9ac6ac5ef4b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '5f0695a0-710a-5601-9e78-e9ac6ac5ef4b',
  status = 'hidden'
where id = 'aaad9e85-2189-552c-a6b8-698cb523aad3'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Alternating bicep curls', 'Alternating Dumbbell Curl', 'Dumbbell Alternate Bicep Curl']::text[]) as a)
where id = '9f609477-d310-55f9-b53d-0f9815e85183'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '9f609477-d310-55f9-b53d-0f9815e85183',
  status = 'hidden'
where id = '46fd88dd-06d9-547e-a5b8-59ee7426f839'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '9f609477-d310-55f9-b53d-0f9815e85183',
  status = 'hidden'
where id = '869c4790-a851-5887-a23a-6d7fabc76d84'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '9f609477-d310-55f9-b53d-0f9815e85183',
  status = 'hidden'
where id = '6a08db30-99b5-5598-9d5b-c14f526aa8a0'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['dumbbell seated alternate press']::text[]) as a)
where id = '0ea2a22e-3b41-5ef0-8488-3e0f84024dc6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '0ea2a22e-3b41-5ef0-8488-3e0f84024dc6',
  status = 'hidden'
where id = '1ee4ef9a-952d-5de0-8dc3-77cad18e8c45'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Arnold Shoulder Press']::text[]) as a)
where id = 'e8235772-4703-5191-8544-8d9df4b43664'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'e8235772-4703-5191-8544-8d9df4b43664',
  status = 'hidden'
where id = '4300327b-1aa4-5846-98db-8297d4685490'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['assisted pull-up', 'assisted standing pull-up']::text[]) as a)
where id = '88d6ad4a-af9c-5118-b168-fb02513ba80d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '88d6ad4a-af9c-5118-b168-fb02513ba80d',
  status = 'hidden'
where id = '03d3f9a8-ca50-5e0f-b845-b4ebfbed25d4'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '88d6ad4a-af9c-5118-b168-fb02513ba80d',
  status = 'hidden'
where id = 'e1a53532-45a6-5823-a494-ef316a5811cf'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Bench Press']::text[]) as a)
where id = 'ae84d83e-1220-5f1f-b639-e535bdbe7dda'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'ae84d83e-1220-5f1f-b639-e535bdbe7dda',
  status = 'hidden'
where id = '89f5183a-92e5-5f0d-8991-cad08edc148c'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Concentration Curls', 'dumbbell standing concentration curl', 'Standing Concentration Curl']::text[]) as a)
where id = 'e9392876-6852-5e86-80c2-dfceba65daea'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'e9392876-6852-5e86-80c2-dfceba65daea',
  status = 'hidden'
where id = 'f9585bfd-7738-5fd0-971b-30ef81de6256'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'e9392876-6852-5e86-80c2-dfceba65daea',
  status = 'hidden'
where id = 'db5e6bc0-a144-5e48-8203-b044d04f016d'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'e9392876-6852-5e86-80c2-dfceba65daea',
  status = 'hidden'
where id = '24507419-ad71-5a90-adc6-03c3b86b1b95'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Lateral-to-Front Raises']::text[]) as a)
where id = '90d227b1-dbf7-5218-beee-88d9b143249e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '90d227b1-dbf7-5218-beee-88d9b143249e',
  status = 'hidden'
where id = '98b5a2c6-eaef-5a90-96a2-9790f4593d85'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Front Raises']::text[]) as a)
where id = 'f2943c06-f54b-5936-9087-4361a2002792'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'f2943c06-f54b-5936-9087-4361a2002792',
  status = 'hidden'
where id = 'e502b926-d6f5-5967-87ec-ba44ed968449'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['cable front shoulder raise']::text[]) as a)
where id = '9fc90476-e659-58eb-a014-66cdba5eecdb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '9fc90476-e659-58eb-a014-66cdba5eecdb',
  status = 'hidden'
where id = '8a5be1e5-c204-52a4-af06-3993881dcba3'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Shoulder Raise Side and Front DB']::text[]) as a)
where id = '75512abc-fadb-5694-9788-052fc0bee424'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '75512abc-fadb-5694-9788-052fc0bee424',
  status = 'hidden'
where id = '8df001f5-e07a-501a-8c10-cbae4bd860ed'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Good Morning']::text[]) as a)
where id = 'ca0f2de1-e130-5084-8df3-d7e84a79cd7b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'ca0f2de1-e130-5084-8df3-d7e84a79cd7b',
  status = 'hidden'
where id = '209b365b-c658-5b64-bb6c-26cf5d68db86'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Leg Extension']::text[]) as a)
where id = '63171775-228f-501e-863b-162139a0cbbf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '63171775-228f-501e-863b-162139a0cbbf',
  status = 'hidden'
where id = '42296fce-7048-51ef-92f2-170c6ad282b2'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Leg Extensions']::text[]) as a)
where id = 'fe5118c0-fec4-57ca-b094-f53f351a5435'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'fe5118c0-fec4-57ca-b094-f53f351a5435',
  status = 'hidden'
where id = '1e1f8c4d-dd9a-5ff2-9be1-e84ded7b63f9'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Cable pull through', 'Pull Through']::text[]) as a)
where id = 'a5acec78-dbd1-59f6-bca2-7b3b733d8637'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'a5acec78-dbd1-59f6-bca2-7b3b733d8637',
  status = 'hidden'
where id = '6d8273ec-3ad3-5cb5-a3de-92cbf8618660'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'a5acec78-dbd1-59f6-bca2-7b3b733d8637',
  status = 'hidden'
where id = '5c71fd25-0eb1-5791-b3ae-a2649d7e08be'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['dumbbell seated curl']::text[]) as a)
where id = 'dc5f79ea-3816-56cb-b79a-090dbc16857d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'dc5f79ea-3816-56cb-b79a-090dbc16857d',
  status = 'hidden'
where id = 'ef1525dc-255f-5f94-9e72-64501ca15112'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Seated Hip Abduction']::text[]) as a)
where id = '3bb8a78c-62bb-58c3-b0ca-7b661eff8a9d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '3bb8a78c-62bb-58c3-b0ca-7b661eff8a9d',
  status = 'hidden'
where id = '53897f52-2a69-5b08-8c62-72fe7d2165b8'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Cable Chest Press']::text[]) as a)
where id = '9a6a08dd-1b34-563e-b501-fcf569ee73cc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '9a6a08dd-1b34-563e-b501-fcf569ee73cc',
  status = 'hidden'
where id = 'fce55add-7e75-5251-ade9-436b49614dff'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Chest Press', 'Machine Chest Press', 'Trap press']::text[]) as a)
where id = '6643da1e-280c-57ac-a6f3-f039d9cbbb58'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '6643da1e-280c-57ac-a6f3-f039d9cbbb58',
  status = 'hidden'
where id = 'ef26fd54-a641-5e40-896f-37c7067e1767'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '6643da1e-280c-57ac-a6f3-f039d9cbbb58',
  status = 'hidden'
where id = 'd972b411-bbe7-55fb-9609-59227792ca5f'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '6643da1e-280c-57ac-a6f3-f039d9cbbb58',
  status = 'hidden'
where id = 'f6c16f23-e1e6-532c-a8c0-b91feb86226c'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Standing Dumbbell Press']::text[]) as a)
where id = '12915692-ce53-56c3-a435-45f5fbf1a083'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '12915692-ce53-56c3-a435-45f5fbf1a083',
  status = 'hidden'
where id = '0328d194-d2ea-5adc-8fdb-3c2711691d4b'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Leverage Machine Chest Press']::text[]) as a)
where id = 'f2e96789-abc7-5f8f-a826-fca7008daca3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'f2e96789-abc7-5f8f-a826-fca7008daca3',
  status = 'hidden'
where id = '3a51c9db-41b6-5107-adbf-65bc6be80d1c'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['smith shrug']::text[]) as a)
where id = 'a6e69dc2-a646-5478-8332-7537fa048252'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'a6e69dc2-a646-5478-8332-7537fa048252',
  status = 'hidden'
where id = 'd0755648-49be-5b76-b5b6-8807313c2b5a'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Barbell Triceps Extension']::text[]) as a)
where id = '0bfe52d9-fd65-5dbd-96f8-40335e2143d7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '0bfe52d9-fd65-5dbd-96f8-40335e2143d7',
  status = 'hidden'
where id = '55ec05f0-6b91-5235-98ed-0884be45688b'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Dumbbell Triceps Extension']::text[]) as a)
where id = '594befa9-d0d8-550a-86cc-040c58a897a9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '594befa9-d0d8-550a-86cc-040c58a897a9',
  status = 'hidden'
where id = 'a13ca989-759f-50e4-8407-2fabc2b36738'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Squats']::text[]) as a)
where id = '93d6cf71-89e9-5a7d-9efd-452d4826b26f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '93d6cf71-89e9-5a7d-9efd-452d4826b26f',
  status = 'hidden'
where id = 'fc6f4f3e-e7aa-5c9b-b246-477b48be7451'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Squat with Bands']::text[]) as a)
where id = 'c864d42e-4933-52f1-bf6f-f4f5cf5513c9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'c864d42e-4933-52f1-bf6f-f4f5cf5513c9',
  status = 'hidden'
where id = '7f1ed5a0-d347-560a-874f-f25b7458e6eb'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['cable standing rear delt row (with rope)']::text[]) as a)
where id = '8f982a42-15ce-57ee-8e13-4cd20c1540c6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '8f982a42-15ce-57ee-8e13-4cd20c1540c6',
  status = 'hidden'
where id = '16e63cbb-7b1c-564f-abe6-2b8630b8f7c1'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Dumbbell rear delt row']::text[]) as a)
where id = 'a0fdf54e-3d51-5c50-a028-d3e7c34b49a3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'a0fdf54e-3d51-5c50-a028-d3e7c34b49a3',
  status = 'hidden'
where id = 'd4faac76-2756-566b-b097-c95a10537ce4'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Barbell Ab Rollout', 'Barbell Rollout']::text[]) as a)
where id = 'e23f5721-f80a-5a92-988c-ef6706c74014'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'e23f5721-f80a-5a92-988c-ef6706c74014',
  status = 'hidden'
where id = '4dcf3e45-6ed6-5ff1-ae2f-5980e0b1d010'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'e23f5721-f80a-5a92-988c-ef6706c74014',
  status = 'hidden'
where id = '52d978a7-e988-5844-818a-e6c58944f448'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['barbell bent over row']::text[]) as a)
where id = '3964d1f2-1c4f-51cd-9b02-61d4ccce33ec'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '3964d1f2-1c4f-51cd-9b02-61d4ccce33ec',
  status = 'hidden'
where id = '3c4ba83e-5057-54fc-a8ea-2ce49cbadee3'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Biceps Curls With Barbell', 'Bodyweight Biceps Curl', 'Standing Bicep Curl']::text[]) as a)
where id = '96378706-2286-5e5e-b651-05cdc3d662bc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '96378706-2286-5e5e-b651-05cdc3d662bc',
  status = 'hidden'
where id = '4141fdfd-1585-5f74-a0a3-49ebc674f2ad'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '96378706-2286-5e5e-b651-05cdc3d662bc',
  status = 'hidden'
where id = 'd634e5c7-30a3-5d71-b45c-d12f480bbeca'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '96378706-2286-5e5e-b651-05cdc3d662bc',
  status = 'hidden'
where id = 'eb1ff677-3df9-575a-9e87-0b17e147d385'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Biceps Curl With Cable', 'Standing Biceps Cable Curl']::text[]) as a)
where id = '0ea2327d-930b-54c4-859c-a5459dca3fa8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '0ea2327d-930b-54c4-859c-a5459dca3fa8',
  status = 'hidden'
where id = 'a3e40d26-e0cc-5327-8189-255946f164f2'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '0ea2327d-930b-54c4-859c-a5459dca3fa8',
  status = 'hidden'
where id = '8dbc6955-4d65-5bc9-a5b8-47c3e6deeebd'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Dumbbell Bicep Curl', 'Dumbbell Curl', 'dumbbell standing biceps curl']::text[]) as a)
where id = 'a91d5e56-deed-5a92-8771-e9c33c077052'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'a91d5e56-deed-5a92-8771-e9c33c077052',
  status = 'hidden'
where id = '76577e0d-38d5-5e9e-a196-83acdc19b992'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'a91d5e56-deed-5a92-8771-e9c33c077052',
  status = 'hidden'
where id = '30a8faa4-36c2-5fc0-a42f-c46bcd452c49'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'a91d5e56-deed-5a92-8771-e9c33c077052',
  status = 'hidden'
where id = '04eb9a48-0cce-50bf-921b-5124645a1bdf'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Machine Bicep Curl']::text[]) as a)
where id = 'b4d8d889-a3b2-5eed-838d-4c109ed01c2e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'b4d8d889-a3b2-5eed-838d-4c109ed01c2e',
  status = 'hidden'
where id = '8215faba-59d1-5f61-bbce-32ec21936a69'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Deadlifts']::text[]) as a)
where id = 'c2673e11-248b-5016-8ac0-0ef13aafaca7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'c2673e11-248b-5016-8ac0-0ef13aafaca7',
  status = 'hidden'
where id = '2bd86f8c-9e48-5e56-8da7-daa8ace1e6fb'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Drag Curl']::text[]) as a)
where id = '95268358-5e43-56e6-a164-f7517eaaf8de'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '95268358-5e43-56e6-a164-f7517eaaf8de',
  status = 'hidden'
where id = 'b83610d0-c89f-55d6-9981-d3cb62684983'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Glute Bridge']::text[]) as a)
where id = 'ba9c21f2-ea30-5a4d-8241-af561cf4a2ca'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'ba9c21f2-ea30-5a4d-8241-af561cf4a2ca',
  status = 'hidden'
where id = '51a73d2e-c9b4-560c-be82-4d3b6609497f'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Hip Thrust']::text[]) as a)
where id = '46af8ef9-72d4-52fd-b9c3-ed5d5335ea7e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '46af8ef9-72d4-52fd-b9c3-ed5d5335ea7e',
  status = 'hidden'
where id = '1d6c5647-a1ed-59db-89c8-e1232eb8ff10'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Dumbbell Lunges Standing', 'Lunges']::text[]) as a)
where id = 'd34994a8-e8c4-5abe-bce2-d339629357a4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'd34994a8-e8c4-5abe-bce2-d339629357a4',
  status = 'hidden'
where id = '44ef30ca-e341-51ca-b835-ba3f435c5e44'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'd34994a8-e8c4-5abe-bce2-d339629357a4',
  status = 'hidden'
where id = 'dd030690-287d-5f3e-95b2-8f4bde13609b'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Barbell Lunges Walking']::text[]) as a)
where id = '6751f105-88c9-5b57-86aa-b4f8a35f4edf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '6751f105-88c9-5b57-86aa-b4f8a35f4edf',
  status = 'hidden'
where id = 'd41d0139-5860-5481-9064-c7ac54a4ca3b'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['barbell lying triceps extension']::text[]) as a)
where id = 'aebbec7c-34f3-5791-9cb8-ea72e765759b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'aebbec7c-34f3-5791-9cb8-ea72e765759b',
  status = 'hidden'
where id = 'ebd36c4b-eb4c-50a4-9d7f-78ef1fc4c93c'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Lying Dumbbell Tricep Extension']::text[]) as a)
where id = 'd5f27180-0162-501a-a091-1afcef7cff7f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'd5f27180-0162-501a-a091-1afcef7cff7f',
  status = 'hidden'
where id = '222d5311-1bd0-57c6-b211-858b06336297'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Overhead Squat']::text[]) as a)
where id = 'a493274a-a3ac-50b1-938f-100394bbd956'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'a493274a-a3ac-50b1-938f-100394bbd956',
  status = 'hidden'
where id = 'e098e9a6-c16d-5ec6-be6c-19d2e0dd4913'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Palms-Down Wrist Curl Over A Bench']::text[]) as a)
where id = '0a404a64-d7e0-5e5b-a1a7-3c2820c127d2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '0a404a64-d7e0-5e5b-a1a7-3c2820c127d2',
  status = 'hidden'
where id = '6e500d55-ba91-5cf6-8fdb-0909fc1bdaed'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Pin Presses']::text[]) as a)
where id = '7f17888d-6556-5ff2-8cc3-913385ca525b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '7f17888d-6556-5ff2-8cc3-913385ca525b',
  status = 'hidden'
where id = '4c43d4a2-3d69-52a4-8d97-f439e384a7b2'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Preacher Curl']::text[]) as a)
where id = '596a69bf-645e-5dc6-8f87-a1f6fa2b6bb1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '596a69bf-645e-5dc6-8f87-a1f6fa2b6bb1',
  status = 'hidden'
where id = '00acfddf-9f11-59fd-aa04-1da4ca878202'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['dumbbell standing preacher curl', 'Two-Arm Dumbbell Preacher Curl']::text[]) as a)
where id = '78f500f6-2cdf-56c8-829f-c1ad57f76c86'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '78f500f6-2cdf-56c8-829f-c1ad57f76c86',
  status = 'hidden'
where id = 'e903ae07-16bd-5528-a429-4ba4c566dab4'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '78f500f6-2cdf-56c8-829f-c1ad57f76c86',
  status = 'hidden'
where id = 'b84c77e2-bba1-54b6-b848-e0f7ad97338a'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Press Sit-Up']::text[]) as a)
where id = 'e1e3948e-4353-5377-a7a0-058428a649de'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'e1e3948e-4353-5377-a7a0-058428a649de',
  status = 'hidden'
where id = 'ae733ece-b792-58ad-aa04-5916ea42db65'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Pullover']::text[]) as a)
where id = '3438c1a6-8072-5ce2-849b-8a843736fa72'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '3438c1a6-8072-5ce2-849b-8a843736fa72',
  status = 'hidden'
where id = '17468fe2-d5d6-5479-b038-3787ee552f89'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Rack Pulls']::text[]) as a)
where id = '781afef4-8bcd-5f57-bb6d-dd2e2193992d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '781afef4-8bcd-5f57-bb6d-dd2e2193992d',
  status = 'hidden'
where id = 'e95c0c75-66fc-5cc6-96a5-8d1de593639b'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Rear Delt Raises']::text[]) as a)
where id = '409791ae-9cc6-57dd-81b5-dc5addb83e5e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '409791ae-9cc6-57dd-81b5-dc5addb83e5e',
  status = 'hidden'
where id = 'b585cb00-e0c6-5792-a9a4-875f8e403ac2'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['barbell reverse curl', 'Reverse Curl']::text[]) as a)
where id = 'f3e69cda-2fca-53bc-a19c-3d999eb3f25e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'f3e69cda-2fca-53bc-a19c-3d999eb3f25e',
  status = 'hidden'
where id = '64862f79-b275-5071-974b-14a9b99e42b1'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'f3e69cda-2fca-53bc-a19c-3d999eb3f25e',
  status = 'hidden'
where id = 'a9395709-a119-563f-99d3-a3e8dcf574cd'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Reverse EZ Bar Cable Curls']::text[]) as a)
where id = '23a94d36-45b6-5654-bac4-6bf2f21d63f5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '23a94d36-45b6-5654-bac4-6bf2f21d63f5',
  status = 'hidden'
where id = '371e6daa-dab6-59aa-8b7d-35e884e5721b'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['dumbbell standing reverse curl']::text[]) as a)
where id = '4fd6281a-1461-57d1-a9d5-24b33e7ccedc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '4fd6281a-1461-57d1-a9d5-24b33e7ccedc',
  status = 'hidden'
where id = '3d2a0da8-042b-5869-a436-21387dbc9160'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Seated Calf Raise']::text[]) as a)
where id = '29bea93d-486d-5133-b7ec-b9b0ba1d67aa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '29bea93d-486d-5133-b7ec-b9b0ba1d67aa',
  status = 'hidden'
where id = '495a355c-31e7-564e-bd79-29685cfcdb8f'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Side bend']::text[]) as a)
where id = '04de30c7-e54c-590c-8590-ec5daee75bd2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '04de30c7-e54c-590c-8590-ec5daee75bd2',
  status = 'hidden'
where id = '24da7414-0285-5001-8207-d53c03689735'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['barbell split squat']::text[]) as a)
where id = '5dec3423-56d6-5f97-8a7a-1e4f36663a33'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '5dec3423-56d6-5f97-8a7a-1e4f36663a33',
  status = 'hidden'
where id = '13c25a53-e05b-5c1e-8511-0d66e87b3835'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Machine Single-Arm Bent Over Row']::text[]) as a)
where id = 'd0dc25b5-4ec7-52be-aaee-cd4165ec0417'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'd0dc25b5-4ec7-52be-aaee-cd4165ec0417',
  status = 'hidden'
where id = '73288f9e-e1b7-53d3-a290-00cd476c495d'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['One Arm Floor Press']::text[]) as a)
where id = '45705a25-75a7-56ab-850a-153d0ede8895'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '45705a25-75a7-56ab-850a-153d0ede8895',
  status = 'hidden'
where id = 'c61c31e5-8b98-5a8c-ba92-94a7bc154caf'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Calf Raise On A Dumbbell', 'Dumbbell or Machine Calf Raise']::text[]) as a)
where id = 'ddf6bdbb-24fb-5995-88ed-97003e52cff6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'ddf6bdbb-24fb-5995-88ed-97003e52cff6',
  status = 'hidden'
where id = '6a2985bf-5d67-5fda-b2b5-387c1f4b7e27'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'ddf6bdbb-24fb-5995-88ed-97003e52cff6',
  status = 'hidden'
where id = 'cd0851ce-b6d7-510b-aa48-be78c3ea80a9'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Standing Calf Raises']::text[]) as a)
where id = '43b119a1-179a-520b-884b-4452fcf935b3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '43b119a1-179a-520b-884b-4452fcf935b3',
  status = 'hidden'
where id = '6c0feeb2-413f-59a6-b9c9-1bd832f4c56e'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Close-Grip EZ-Bar Curl with Band']::text[]) as a)
where id = '1e647399-3d67-5310-9e43-18b490ccc2a7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '1e647399-3d67-5310-9e43-18b490ccc2a7',
  status = 'hidden'
where id = 'eb8eb61c-f738-5992-861e-f639fbf12199'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Overhead Cable Tricep Extension', 'Overhead Triceps Extension', 'Triceps Overhead Extension with Rope']::text[]) as a)
where id = '78b070f4-f88f-5151-96a0-edd213e4df51'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '78b070f4-f88f-5151-96a0-edd213e4df51',
  status = 'hidden'
where id = 'c4740508-fa74-5595-b959-24f87cce70be'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '78b070f4-f88f-5151-96a0-edd213e4df51',
  status = 'hidden'
where id = 'fd7e7b4a-f6db-5188-a74c-d19fa42f9983'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '78b070f4-f88f-5151-96a0-edd213e4df51',
  status = 'hidden'
where id = '6c7d5b8f-25f8-5a18-9648-ba89ec581270'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['barbell standing wide-grip curl']::text[]) as a)
where id = 'b592f85f-7dea-56e9-94c7-36a50fedd298'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'b592f85f-7dea-56e9-94c7-36a50fedd298',
  status = 'hidden'
where id = '0bda2374-9f24-5cd7-9309-906dacff8009'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Step-ups', 'Weighted Step-ups']::text[]) as a)
where id = 'e63aa294-094c-5383-8a2b-1d83e512507b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'e63aa294-094c-5383-8a2b-1d83e512507b',
  status = 'hidden'
where id = 'caf546f1-f7c4-54bb-adaf-87226e650b27'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'e63aa294-094c-5383-8a2b-1d83e512507b',
  status = 'hidden'
where id = '7a86db5d-fbdb-5e48-bf85-7587ed8017eb'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Sumo Deadlift']::text[]) as a)
where id = 'ed027f0e-28c5-56cf-818d-b12942877c93'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'ed027f0e-28c5-56cf-818d-b12942877c93',
  status = 'hidden'
where id = 'fd97f6d0-35e0-53c1-9090-8a61f40c2f33'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Thruster']::text[]) as a)
where id = '0b1c2516-2cfc-5ffd-891b-1dc1d4f2e419'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '0b1c2516-2cfc-5ffd-891b-1dc1d4f2e419',
  status = 'hidden'
where id = '85118763-edca-5c4a-a01d-c133f665e83e'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Bent Press']::text[]) as a)
where id = '8b1a6a35-e1b8-5833-a3cf-39d0a5988ceb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '8b1a6a35-e1b8-5833-a3cf-39d0a5988ceb',
  status = 'hidden'
where id = 'd9865fad-db47-5c78-a402-48a591139b9b'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Fly With Cable']::text[]) as a)
where id = '8e075465-a128-54ff-af8c-056b79cf3ce7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '8e075465-a128-54ff-af8c-056b79cf3ce7',
  status = 'hidden'
where id = '64cfa39b-3612-5792-ba01-6fdbe4e1390e'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Lying Cable Curl']::text[]) as a)
where id = 'a76f87a1-ec0f-5487-bb57-367f58a1f9db'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'a76f87a1-ec0f-5487-bb57-367f58a1f9db',
  status = 'hidden'
where id = 'c304dad7-dcef-5fe8-99f7-eed4813afd31'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Row']::text[]) as a)
where id = 'e7bbba81-9ad2-579c-aecd-01535b541c9b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'e7bbba81-9ad2-579c-aecd-01535b541c9b',
  status = 'hidden'
where id = 'ad70e228-91e0-53cb-99b3-a96503e53178'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Single arm row']::text[]) as a)
where id = '5d11620a-3cdb-5e6e-bf59-6a8d97c4c18b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '5d11620a-3cdb-5e6e-bf59-6a8d97c4c18b',
  status = 'hidden'
where id = '69faf21b-2880-5d95-b5e6-f9d0a308ce46'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Single-Arm Towel Row']::text[]) as a)
where id = 'd0795c03-fd69-577e-8da8-fe870fc2e633'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'd0795c03-fd69-577e-8da8-fe870fc2e633',
  status = 'hidden'
where id = '1f5bd3b1-9b2b-5bde-8228-d6c51e9e0958'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Box Squat']::text[]) as a)
where id = 'a15ed9ad-cee1-57fd-aaa0-a8477260ffc6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'a15ed9ad-cee1-57fd-aaa0-a8477260ffc6',
  status = 'hidden'
where id = '05279f3f-e3d1-5717-ae6a-f9dc553c9db6'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Cable Chest Press - Decline']::text[]) as a)
where id = 'ea192c2f-6402-549d-b9d9-99049dd9257d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'ea192c2f-6402-549d-b9d9-99049dd9257d',
  status = 'hidden'
where id = 'f5876427-e415-5e72-8c19-f189030dfbd4'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Cable Fly Middle Chest']::text[]) as a)
where id = '66e556bb-a964-5867-88d7-cb9528028c51'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '66e556bb-a964-5867-88d7-cb9528028c51',
  status = 'hidden'
where id = 'e89f61c6-ae07-5efb-8b1a-c4cab9da2107'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Hammer Curls']::text[]) as a)
where id = '1c3d339e-1619-59db-a436-ea45bd7fea82'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '1c3d339e-1619-59db-a436-ea45bd7fea82',
  status = 'hidden'
where id = '52caac2a-e85c-5e1f-bc67-9051505e7ba6'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Cable High Pulley Overhead Triceps Extension']::text[]) as a)
where id = 'b82e8a0a-b359-5d09-9b03-4e46d53328e4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'b82e8a0a-b359-5d09-9b03-4e46d53328e4',
  status = 'hidden'
where id = '299e88e9-9029-5b57-be48-5cb43e06100d'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['cable incline triceps extension']::text[]) as a)
where id = '9816368a-37cf-5204-879f-8d8b8b1c1bc1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '9816368a-37cf-5204-879f-8d8b8b1c1bc1',
  status = 'hidden'
where id = '2859a704-4533-51cd-9121-39517d5715d8'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['dumbbell incline triceps extension']::text[]) as a)
where id = '17868110-754f-57f4-9c1c-ca08b7f58ecc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '17868110-754f-57f4-9c1c-ca08b7f58ecc',
  status = 'hidden'
where id = '4f8a9013-dd6f-5484-a5b1-b14111af510a'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['cable kickback', 'Cable Tricep Kickback']::text[]) as a)
where id = 'ff48d977-d1cf-54ae-bc5b-bf599bd3dda6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'ff48d977-d1cf-54ae-bc5b-bf599bd3dda6',
  status = 'hidden'
where id = '02d03ad9-9bf7-5c59-8f54-daf9fa44ec29'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'ff48d977-d1cf-54ae-bc5b-bf599bd3dda6',
  status = 'hidden'
where id = 'b5a6438f-069d-5e6d-956c-291c243f2f65'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['dumbbell standing kickback', 'Tricep Dumbbell Kickback']::text[]) as a)
where id = '065e917f-32b2-5248-9de2-36f9c7c0d3bd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '065e917f-32b2-5248-9de2-36f9c7c0d3bd',
  status = 'hidden'
where id = '42977cd1-5636-5f76-a285-d87cbad8f601'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '065e917f-32b2-5248-9de2-36f9c7c0d3bd',
  status = 'hidden'
where id = 'b1155d7e-752e-549b-bc6f-3e61499c4bd2'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Lateral Raises']::text[]) as a)
where id = 'aee960ee-a63c-56d4-b283-d55fea6101ae'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'aee960ee-a63c-56d4-b283-d55fea6101ae',
  status = 'hidden'
where id = '15d48bbc-17f8-55cb-b5cc-1b2b60ee0605'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Machine Side Lateral Raises']::text[]) as a)
where id = 'c1063014-9552-5cf3-ad76-f9d80ac29807'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'c1063014-9552-5cf3-ad76-f9d80ac29807',
  status = 'hidden'
where id = 'd831b261-b8a2-51c4-84eb-a0d513ce019d'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Cable One Arm Tricep Extension']::text[]) as a)
where id = 'b129d69f-86e4-5597-8696-6fa09c1be8cd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'b129d69f-86e4-5597-8696-6fa09c1be8cd',
  status = 'hidden'
where id = 'c3ff23dd-a57f-58a8-a3cd-8c61d658d632'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Dumbbell One-Arm Triceps Extension', 'Standing One-Arm Dumbbell Triceps Extension']::text[]) as a)
where id = 'c575dd5c-ef7d-5f07-aa2c-d85e0f59d1b1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'c575dd5c-ef7d-5f07-aa2c-d85e0f59d1b1',
  status = 'hidden'
where id = '42c86881-3409-5d97-a753-f3c69a2d7e8c'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'c575dd5c-ef7d-5f07-aa2c-d85e0f59d1b1',
  status = 'hidden'
where id = 'd26596fb-d922-5f9a-a3b3-bf996bfc5992'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Tricep Pushdown on Cable', 'Tricep Rope Pushdowns', 'Triceps Pushdown']::text[]) as a)
where id = '89417742-da76-585a-86f3-2b6765507e19'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '89417742-da76-585a-86f3-2b6765507e19',
  status = 'hidden'
where id = 'f3844b76-7ea9-5139-81fc-9146e22b795d'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '89417742-da76-585a-86f3-2b6765507e19',
  status = 'hidden'
where id = 'b2ca4e24-b025-5a5b-848d-662769a1305c'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '89417742-da76-585a-86f3-2b6765507e19',
  status = 'hidden'
where id = 'c4963c6f-e523-55a8-a099-b96a48ed1529'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Triceps Pushdown - Rope Attachment']::text[]) as a)
where id = 'ca24b85e-a4bf-5c82-b443-c390f395ea74'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'ca24b85e-a4bf-5c82-b443-c390f395ea74',
  status = 'hidden'
where id = 'b39ee234-4c30-5e86-a299-8db761ca12be'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Reverse Grip Triceps Pushdown']::text[]) as a)
where id = '105cce52-904e-5020-87b0-a3807a9553d9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '105cce52-904e-5020-87b0-a3807a9553d9',
  status = 'hidden'
where id = '710e5bce-daec-570e-8437-c42f9bef3f97'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['cable seated row', 'Seated Band Row']::text[]) as a)
where id = 'd5daa802-fd31-50c7-a893-9bd6a5e4b74d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'd5daa802-fd31-50c7-a893-9bd6a5e4b74d',
  status = 'hidden'
where id = '52df07a5-5745-5a6e-af58-d46edce1a10c'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'd5daa802-fd31-50c7-a893-9bd6a5e4b74d',
  status = 'hidden'
where id = '822674a9-c0ca-53a6-a057-9ebaa118c321'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Standing One-Arm Cable Curl']::text[]) as a)
where id = 'be568852-76e1-5c5e-853a-928667f428c3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'be568852-76e1-5c5e-853a-928667f428c3',
  status = 'hidden'
where id = 'a672fe28-f837-5d0f-b2aa-d7095192a43c'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Dumbbell Single-Arm Fly On Exercise Ball']::text[]) as a)
where id = '26cb84c5-7d8a-5fb5-a423-924682821a52'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '26cb84c5-7d8a-5fb5-a423-924682821a52',
  status = 'hidden'
where id = '1f2f160d-d525-5f92-971d-76a33d741bb0'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Dumbbell Incline Single-Arm Press']::text[]) as a)
where id = '3b85a982-873b-5257-bf63-424971fd82d1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '3b85a982-873b-5257-bf63-424971fd82d1',
  status = 'hidden'
where id = '9e274f5d-b92b-5689-be22-74ce3412fe63'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Cable Single-Arm Preacher Curl', 'Single-arm Preacher Curl']::text[]) as a)
where id = 'f2ab1c2e-444f-5e52-b597-8be9034bdd48'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'f2ab1c2e-444f-5e52-b597-8be9034bdd48',
  status = 'hidden'
where id = 'e785c056-20e8-5641-982b-a318bb164082'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'f2ab1c2e-444f-5e52-b597-8be9034bdd48',
  status = 'hidden'
where id = '4ed143e1-9722-5519-8fa6-7b09f79aa7cc'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Single-arm cable pushdown']::text[]) as a)
where id = 'a5ee3b71-a613-59d2-a8b5-392a1e21ee6b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'a5ee3b71-a613-59d2-a8b5-392a1e21ee6b',
  status = 'hidden'
where id = '6195fd4e-8a6d-5111-908c-1acb7ae99f3b'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Standing Inner-Biceps Curl']::text[]) as a)
where id = '0efafe2f-4c47-5313-b327-4f2f194d48ac'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '0efafe2f-4c47-5313-b327-4f2f194d48ac',
  status = 'hidden'
where id = 'cf349f85-041c-5bee-ab7f-1b6938a5cc8e'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Shoulder External Rotation (Cable)']::text[]) as a)
where id = 'ec9acc77-a6a0-506d-a6cf-76e528d6c299'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'ec9acc77-a6a0-506d-a6cf-76e528d6c299',
  status = 'hidden'
where id = '916b733c-6d9c-51b3-8dca-1d610642ad95'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['cable straight arm pulldown (with rope)', 'Side Straight-Arm Pulldown (Cable)']::text[]) as a)
where id = '8303c34c-9604-5fea-8125-4030a0af087f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '8303c34c-9604-5fea-8125-4030a0af087f',
  status = 'hidden'
where id = '3c4c4c2c-f02f-5b6c-a307-9d14bdc2e7e1'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '8303c34c-9604-5fea-8125-4030a0af087f',
  status = 'hidden'
where id = '3e6b7c52-c861-54b6-9d8a-1a008010293c'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Straight-Arm Pulldown']::text[]) as a)
where id = '55f99b98-08ff-5462-b6ba-99f9c8a32634'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '55f99b98-08ff-5462-b6ba-99f9c8a32634',
  status = 'hidden'
where id = '1c2796da-a86b-5e2a-8e17-31ff934d70cf'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Calf Press']::text[]) as a)
where id = '82303c9d-bb6e-541d-9927-9dc69b9759f6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '82303c9d-bb6e-541d-9927-9dc69b9759f6',
  status = 'hidden'
where id = '79c0b96b-0428-5bbe-8ac1-1026274bb153'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Standing Calf Stretch']::text[]) as a)
where id = 'd2b41f27-0801-51e7-8b36-e1145b23205a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'd2b41f27-0801-51e7-8b36-e1145b23205a',
  status = 'hidden'
where id = 'f875de0d-10a9-5b4d-9457-0c0bb69d78db'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Dips', 'Dips - Triceps Version']::text[]) as a)
where id = 'f61b0966-d3f6-53b5-aab6-8d2d12f84775'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'f61b0966-d3f6-53b5-aab6-8d2d12f84775',
  status = 'hidden'
where id = '8a9e1fa0-979d-5783-af55-797913a4f7a0'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = 'f61b0966-d3f6-53b5-aab6-8d2d12f84775',
  status = 'hidden'
where id = 'a8012f5f-e291-569b-a02d-4e332ff82e38'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Cross Body Hammer Curl']::text[]) as a)
where id = 'e15c8c1d-8219-54fc-8e70-efc7ba8b7ae3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'e15c8c1d-8219-54fc-8e70-efc7ba8b7ae3',
  status = 'hidden'
where id = '79d21e12-9157-5a8d-b799-6b1109e20b5c'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Dips Between Two Benches']::text[]) as a)
where id = 'c44ae914-0485-59b9-90ac-1a5383a3e054'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'c44ae914-0485-59b9-90ac-1a5383a3e054',
  status = 'hidden'
where id = 'e49aaf76-792d-5839-8e46-c482ee775d6a'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['dumbbell incline curl']::text[]) as a)
where id = '09b19c69-f03e-5d4f-ac27-0d8aa0f9ee47'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '09b19c69-f03e-5d4f-ac27-0d8aa0f9ee47',
  status = 'hidden'
where id = 'abd3f15c-33c8-5927-a45f-aa0504397090'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Incline Hammer Curls']::text[]) as a)
where id = '08281adf-e9f3-58d6-b480-063d41126d9b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '08281adf-e9f3-58d6-b480-063d41126d9b',
  status = 'hidden'
where id = '24aba917-c8de-549c-8842-675ff2acdd0b'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Incline Inner Biceps Curl']::text[]) as a)
where id = '0b88617f-259c-5487-b4e3-eb81e76d7a01'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '0b88617f-259c-5487-b4e3-eb81e76d7a01',
  status = 'hidden'
where id = '166120bf-5534-58bd-ad3d-0b0153eb4585'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Side-lying External Rotation']::text[]) as a)
where id = 'd334f7ec-e8e1-5dd4-98d8-9b95ba1094dc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'd334f7ec-e8e1-5dd4-98d8-9b95ba1094dc',
  status = 'hidden'
where id = '12f40ca0-3fc1-5f42-b95c-a19ff98b57ed'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['dumbbell lying supine biceps curl']::text[]) as a)
where id = '67bffe87-dde6-5b50-ac6e-b07ca7ae163d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '67bffe87-dde6-5b50-ac6e-b07ca7ae163d',
  status = 'hidden'
where id = 'f509895b-877c-5598-881d-b4ea65d6de66'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Weighted push-ups']::text[]) as a)
where id = 'a96858ec-bbb3-50b2-9360-8c3b3ae01397'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'a96858ec-bbb3-50b2-9360-8c3b3ae01397',
  status = 'hidden'
where id = '6858b00b-4501-565d-8144-fe2f3543830f'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Shoulder Raise (Dumbbell)']::text[]) as a)
where id = '06089152-9c0f-5208-81e7-35480bd76173'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '06089152-9c0f-5208-81e7-35480bd76173',
  status = 'hidden'
where id = '340ac014-6863-53bf-a3a2-08451537d71c'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Reverse Grip Bench Press']::text[]) as a)
where id = 'ad2d1cdd-0ae0-56ff-ad6c-29d77ca9ab20'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'ad2d1cdd-0ae0-56ff-ad6c-29d77ca9ab20',
  status = 'hidden'
where id = '969c8895-9562-5b35-9f89-86fa7016e3ab'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Reverse Triceps Bench Press']::text[]) as a)
where id = '4abf8d16-5bcb-585b-9338-8b52d895a7ea'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '4abf8d16-5bcb-585b-9338-8b52d895a7ea',
  status = 'hidden'
where id = '367a4e6f-0d4f-58e6-80f4-1af7ed3b5c04'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Seated Bent-Over Two-Arm Dumbbell Triceps Extension']::text[]) as a)
where id = 'e1f8c691-d522-5096-9da0-46cd949bff44'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'e1f8c691-d522-5096-9da0-46cd949bff44',
  status = 'hidden'
where id = '7a8a2dde-0e2b-51a9-9cf2-c4ac524e9a30'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Overhead Press']::text[]) as a)
where id = '504c156f-9d51-55ff-84c7-305344dc493c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '504c156f-9d51-55ff-84c7-305344dc493c',
  status = 'hidden'
where id = '8febe5ad-d903-51bd-a1af-b706f55615d4'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['dumbbell standing zottman preacher curl', 'Zottman Preacher Curl']::text[]) as a)
where id = '0efe2dfa-718b-5ae5-a1d2-8e662305fc33'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '0efe2dfa-718b-5ae5-a1d2-8e662305fc33',
  status = 'hidden'
where id = '72ab7f45-9906-54df-b58d-1a5e8c4f7c29'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  merged_into = '0efe2dfa-718b-5ae5-a1d2-8e662305fc33',
  status = 'hidden'
where id = '233a77d2-9499-5740-ac72-2d0e3e2d896c'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Tate Press']::text[]) as a)
where id = '4c3807ce-06ba-5654-81d3-435e447973ad'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '4c3807ce-06ba-5654-81d3-435e447973ad',
  status = 'hidden'
where id = '3790f80f-f677-5be4-997f-294cfa969535'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Zottman Curl']::text[]) as a)
where id = 'fc6936e8-a258-506d-b868-c103a7cd2890'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'fc6936e8-a258-506d-b868-c103a7cd2890',
  status = 'hidden'
where id = 'cdc917f4-0382-59c7-9e9e-caf973e44a54'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Spider Curl']::text[]) as a)
where id = 'ee073d57-19c9-5bc9-801a-0e6220fbb3d9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'ee073d57-19c9-5bc9-801a-0e6220fbb3d9',
  status = 'hidden'
where id = '651edd05-a449-5959-96b4-c9bc9af3f9c8'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Floor dips']::text[]) as a)
where id = '750927c7-be7a-5d28-a95c-8e0d5abc56eb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '750927c7-be7a-5d28-a95c-8e0d5abc56eb',
  status = 'hidden'
where id = '9b39561f-236d-5c14-9125-aabd59cdd234'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Glute Kickback (Machine)']::text[]) as a)
where id = 'd1abbc76-3d81-51f2-ba85-cedcfedad6fd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'd1abbc76-3d81-51f2-ba85-cedcfedad6fd',
  status = 'hidden'
where id = '74f4be80-0a65-5649-839d-991f680180e5'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Hip Circles']::text[]) as a)
where id = '3c2a017c-fee5-5b6d-8232-e245929c0c38'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '3c2a017c-fee5-5b6d-8232-e245929c0c38',
  status = 'hidden'
where id = '0532362f-705b-518b-8799-87914cee706f'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Pistol Squat']::text[]) as a)
where id = '45583e46-2231-53be-b974-c48ae51715ff'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '45583e46-2231-53be-b974-c48ae51715ff',
  status = 'hidden'
where id = '397894af-23e0-53f9-9019-ac9213af66e4'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Leg Curl']::text[]) as a)
where id = 'cb9a0ceb-7a35-5aaf-9da6-77a6e6279d1f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'cb9a0ceb-7a35-5aaf-9da6-77a6e6279d1f',
  status = 'hidden'
where id = '0a1a52f5-850a-575a-832b-dd75e043dada'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Leg Raises, Standing']::text[]) as a)
where id = '99ec3376-c05e-5d3e-896a-5c26c53b2477'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '99ec3376-c05e-5d3e-896a-5c26c53b2477',
  status = 'hidden'
where id = '5c607349-88ca-5b7a-acaf-b0693e94f796'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Leverage Machine Iso Row']::text[]) as a)
where id = 'ca8b739a-2157-5b29-96c6-761d1135a38f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'ca8b739a-2157-5b29-96c6-761d1135a38f',
  status = 'hidden'
where id = 'bbec23be-c1b3-5688-acaf-3a90021c6b12'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Lying Leg Curls']::text[]) as a)
where id = 'cf5dffc6-c57f-5410-be23-bb2592d4a480'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'cf5dffc6-c57f-5410-be23-bb2592d4a480',
  status = 'hidden'
where id = 'fe654b87-6ad0-54a0-9808-5156f21469f2'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Seated Hip Adduction']::text[]) as a)
where id = '6c6000da-8122-582e-b27e-f00be1849237'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '6c6000da-8122-582e-b27e-f00be1849237',
  status = 'hidden'
where id = 'e4db62bc-cdc8-51b8-98b8-927cc67e3fa5'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Seated Leg Curl']::text[]) as a)
where id = '6edece82-84f9-56b4-b4ca-972921c360cd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '6edece82-84f9-56b4-b4ca-972921c360cd',
  status = 'hidden'
where id = 'cce80820-5bb3-5f07-87bc-c3f1aae31d97'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['T-Bar row']::text[]) as a)
where id = '59042edd-ae1b-5421-9754-6b7e160f0f88'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '59042edd-ae1b-5421-9754-6b7e160f0f88',
  status = 'hidden'
where id = '28188412-bc43-58f6-9154-4681c67c5747'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['On Your Side Quad Stretch']::text[]) as a)
where id = '14a466c8-e6c6-5adc-a51e-072b101446eb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '14a466c8-e6c6-5adc-a51e-072b101446eb',
  status = 'hidden'
where id = '3d6cc69a-fbaf-5225-a817-7df35bd251c4'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Side Plank']::text[]) as a)
where id = '6b867bc6-c83f-5b44-91bb-1e2ad6ee9037'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '6b867bc6-c83f-5b44-91bb-1e2ad6ee9037',
  status = 'hidden'
where id = '7ced3680-233c-584e-8c10-bd8dd8260465'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Side stretch']::text[]) as a)
where id = 'fd7d4a8c-7fdb-5baf-85fe-947cdff9d4b7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'fd7d4a8c-7fdb-5baf-85fe-947cdff9d4b7',
  status = 'hidden'
where id = '3613a31a-62f7-5706-b353-87b2e76a16bf'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Tricep Side Stretch']::text[]) as a)
where id = '2027fe14-d2d8-515f-8b25-afba9c351308'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '2027fe14-d2d8-515f-8b25-afba9c351308',
  status = 'hidden'
where id = '4a4d6d25-b37c-5839-be75-85a99508371d'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Split squats left']::text[]) as a)
where id = '479a12a9-3c4b-536f-8036-398bbbb3e9a5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '479a12a9-3c4b-536f-8036-398bbbb3e9a5',
  status = 'hidden'
where id = '1617b704-460c-5de8-b649-34cc569dab84'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Split squats right']::text[]) as a)
where id = '20d8c434-8a29-52b8-8ea6-71b0d93a8736'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '20d8c434-8a29-52b8-8ea6-71b0d93a8736',
  status = 'hidden'
where id = '2d0ad59a-716a-5d5c-893d-f528c2717e0c'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Side Standing Long Jump']::text[]) as a)
where id = 'b16106bd-62fc-5b3c-b974-fb69f2da74e3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'b16106bd-62fc-5b3c-b974-fb69f2da74e3',
  status = 'hidden'
where id = 'c36580a7-766f-588e-ad6b-72b1afe2d42f'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Stiff-legged Deadlifts']::text[]) as a)
where id = '1f3669cd-5fa8-5d1c-a63a-7d5576a98ee0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '1f3669cd-5fa8-5d1c-a63a-7d5576a98ee0',
  status = 'hidden'
where id = '32d06c10-3e67-5ede-a996-5906ff878dd6'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['Soleus / Achilles Stretch']::text[]) as a)
where id = '4b7faf07-a6b2-5cd7-992f-a378973277d7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = '4b7faf07-a6b2-5cd7-992f-a378973277d7',
  status = 'hidden'
where id = '95e0d9ee-f1e2-5512-be25-10e35a944500'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

update public.exercises
set
  aliases = (select array_agg(distinct a) from unnest(coalesce(aliases, '{}'::text[]) || ARRAY['wheel rollout']::text[]) as a)
where id = 'bda98858-dc4f-5e20-a2ef-7a63b53b1abd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  merged_into = 'bda98858-dc4f-5e20-a2ef-7a63b53b1abd',
  status = 'hidden'
where id = 'd7692cb5-e52c-5e52-942d-5b96abe3c77c'
  and source in ('exercisedb', 'wger', 'public_domain')
  and merged_into is null;

notify pgrst, 'reload schema';
