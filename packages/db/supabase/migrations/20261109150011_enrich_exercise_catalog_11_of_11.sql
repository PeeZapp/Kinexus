-- Enrich incomplete catalogue metadata (rules-only gap fill).
-- Shard 11/11 (63 rows).
-- Only fills body_part/equipment/target_muscle when empty or body_part=other;
-- only sets category/is_compound when null. Never overwrites good data.
-- Touches source in (exercisedb, wger, public_domain) only.
-- Idempotent: safe to re-run.

update public.exercises as e
set
  body_part = case
    when v.body_part is not null and coalesce(e.body_part, '') in ('', 'other') then v.body_part
    else e.body_part
  end,
  equipment = case
    when v.equipment is not null and coalesce(e.equipment, '') = '' then v.equipment
    else e.equipment
  end,
  target_muscle = case
    when v.target_muscle is not null and coalesce(e.target_muscle, '') = '' then v.target_muscle
    else e.target_muscle
  end,
  category = case
    when v.category is not null and e.category is null then v.category
    else e.category
  end,
  is_compound = case
    when v.is_compound is not null and e.is_compound is null then v.is_compound
    else e.is_compound
  end
from (values
  ('a8b061e5-fe01-57c3-8279-9d3c03d23270'::uuid, null::text, null::text, null::text, 'Core'::text, false::boolean),
  ('34b40a65-90a5-5339-9dd6-90e4c45fa2c9'::uuid, null::text, null::text, null::text, 'Shoulders'::text, false::boolean),
  ('1470e9a6-46c5-5479-9a29-6d87896d3547'::uuid, null::text, null::text, null::text, 'Core'::text, false::boolean),
  ('2d204af9-1f28-509e-998c-b887a5ccf87b'::uuid, null::text, null::text, null::text, 'Back'::text, null::boolean),
  ('a0b90f9d-9f76-529d-8d9b-5387bff1bac8'::uuid, null::text, null::text, null::text, 'Legs'::text, true::boolean),
  ('5eba1e6c-9f2a-5715-add7-b9cc5296e98e'::uuid, null::text, null::text, null::text, 'Shoulders'::text, null::boolean),
  ('35c9add6-5302-5b2e-be9a-7a4db649311e'::uuid, null::text, null::text, null::text, 'Legs'::text, true::boolean),
  ('125f178c-7bab-532a-9e31-713f2c298980'::uuid, null::text, null::text, null::text, 'Chest'::text, null::boolean),
  ('b2e5a999-6b59-5716-aaac-790a9da89f9e'::uuid, null::text, null::text, null::text, 'Back'::text, null::boolean),
  ('aad67d55-d9cf-597c-8927-35a6b3d77efe'::uuid, 'neck'::text, 'resistance band'::text, 'neck'::text, 'Chest'::text, null::boolean),
  ('f0e6ce20-28e3-586e-ac63-c77a7551e3c1'::uuid, null::text, null::text, null::text, 'Back'::text, true::boolean),
  ('7fa12b51-c8d6-58ae-b03f-d657b42b4310'::uuid, null::text, null::text, null::text, 'Core'::text, true::boolean),
  ('3af3a2e2-9ae4-5901-b746-366691afaaa7'::uuid, null::text, null::text, null::text, 'Back'::text, true::boolean),
  ('6858b00b-4501-565d-8144-fe2f3543830f'::uuid, 'chest'::text, 'bodyweight'::text, 'pectorals'::text, 'Chest'::text, null::boolean),
  ('29378f33-54d9-5546-901f-f6e909e7390b'::uuid, null::text, null::text, null::text, 'Shoulders'::text, null::boolean),
  ('0f9f07cc-184d-5fab-b84d-2822cabedb54'::uuid, null::text, null::text, null::text, 'Core'::text, false::boolean),
  ('44436e64-8e49-5217-991d-6dd516425e20'::uuid, null::text, null::text, null::text, 'Core'::text, false::boolean),
  ('1d38c3d0-5b54-58e6-a231-5cb06b2461d0'::uuid, null::text, null::text, null::text, 'Biceps'::text, false::boolean),
  ('27e6fbbb-4bde-5786-a812-b362f703913f'::uuid, null::text, null::text, null::text, 'Core'::text, false::boolean),
  ('faffa60d-6407-52ef-ae23-10a3a0a89e42'::uuid, null::text, null::text, null::text, 'Core'::text, false::boolean),
  ('e5285928-25de-5b87-8150-f11ddbad2d39'::uuid, null::text, null::text, null::text, 'Legs'::text, true::boolean),
  ('024a115a-74a8-5b49-9e33-4597b2081102'::uuid, null::text, null::text, null::text, 'Core'::text, false::boolean),
  ('5844776e-bab8-52f8-a3ba-99ed6cd05806'::uuid, null::text, null::text, null::text, 'Legs'::text, true::boolean),
  ('3f923e27-bd53-53d9-8e34-8964d9717bb6'::uuid, null::text, null::text, null::text, 'Biceps'::text, false::boolean),
  ('7a86db5d-fbdb-5e48-bf85-7587ed8017eb'::uuid, 'legs'::text, 'barbell'::text, 'quadriceps'::text, 'Legs'::text, null::boolean),
  ('3281e78d-a0c2-5c41-b809-7ab7e979861e'::uuid, null::text, null::text, null::text, 'Triceps'::text, true::boolean),
  ('4bd1fe1e-c995-51d0-89ac-c96267046e68'::uuid, null::text, null::text, null::text, 'Mobility'::text, true::boolean),
  ('ccdea0e8-9c01-50b9-a976-7acf5cb99ac9'::uuid, null::text, null::text, null::text, 'Chest'::text, true::boolean),
  ('19ef6d55-c6b9-5c45-a365-61a9540dd059'::uuid, null::text, null::text, null::text, 'Chest'::text, true::boolean),
  ('499f35e7-0a5e-58c5-859f-136b845e0035'::uuid, null::text, null::text, null::text, 'Triceps'::text, true::boolean),
  ('1ba4f4a6-2794-580c-9ef8-70d42af6177c'::uuid, null::text, null::text, null::text, 'Triceps'::text, null::boolean),
  ('d7692cb5-e52c-5e52-942d-5b96abe3c77c'::uuid, null::text, null::text, null::text, 'Core'::text, false::boolean),
  ('cec79c45-7dc9-5bc1-b243-749fd2dcf6a0'::uuid, null::text, null::text, null::text, 'Cardio'::text, false::boolean),
  ('bc8604d5-17af-595a-a403-5b7efc76bea7'::uuid, null::text, null::text, null::text, 'Chest'::text, null::boolean),
  ('9ee0fcea-3b3e-5c8f-b30b-a43809138342'::uuid, null::text, null::text, null::text, 'Legs'::text, true::boolean),
  ('5696b60f-99ea-5023-9a5c-9ead97a60d07'::uuid, null::text, null::text, null::text, 'Glutes'::text, null::boolean),
  ('7e381394-79e9-531f-bace-238dab413e71'::uuid, null::text, null::text, null::text, 'Chest'::text, true::boolean),
  ('38128ca5-0591-5204-a7e8-c198e53f4944'::uuid, null::text, null::text, null::text, 'Chest'::text, true::boolean),
  ('6ee97462-894c-5434-848d-cead71008993'::uuid, null::text, null::text, null::text, 'Chest'::text, true::boolean),
  ('f3c83a83-f7dc-5420-922a-35dcf8f9e296'::uuid, null::text, null::text, null::text, 'Back'::text, true::boolean),
  ('b74a7eee-7815-52a7-9233-8b9bd2e3be8e'::uuid, null::text, null::text, null::text, 'Back'::text, true::boolean),
  ('1e621d57-9fcd-5ad1-80e3-dde82c8dff38'::uuid, 'back'::text, 'cable'::text, 'latissimus dorsi'::text, 'Back'::text, true::boolean),
  ('a0b2b786-6dde-50e1-a430-89f244d1edfe'::uuid, null::text, null::text, null::text, 'Back'::text, true::boolean),
  ('74e95ce7-24e8-5bae-a3a8-90a780f2a2d7'::uuid, null::text, null::text, null::text, 'Back'::text, true::boolean),
  ('fa09ee1c-3156-5a20-9207-d7d8b721de10'::uuid, 'back'::text, 'cable'::text, 'latissimus dorsi'::text, 'Back'::text, true::boolean),
  ('3940d360-1e02-56f3-a989-172d4c101cf3'::uuid, null::text, null::text, null::text, 'Legs'::text, null::boolean),
  ('5f56f412-fc7b-599a-9d8d-2c5268c0ed24'::uuid, null::text, null::text, null::text, 'Glutes'::text, null::boolean),
  ('454b8c71-6354-512c-b0ea-131dec8b031b'::uuid, 'back'::text, 'bodyweight'::text, 'latissimus dorsi'::text, 'Back'::text, null::boolean),
  ('25f43748-e005-5cec-bdf5-11ad01cc12e3'::uuid, null::text, null::text, null::text, 'Mobility'::text, false::boolean),
  ('5e0d182c-54b1-5cce-823b-b2c55083fbcf'::uuid, null::text, null::text, null::text, 'Mobility'::text, false::boolean),
  ('7595e30e-e5dd-51aa-8cd6-4eac5ce89c4b'::uuid, 'biceps'::text, 'dumbbell'::text, 'biceps'::text, 'Biceps'::text, false::boolean),
  ('bc8b4b08-2c16-51f8-a440-6cee9d2bdf7a'::uuid, null::text, null::text, null::text, 'Mobility'::text, false::boolean),
  ('247b2dbd-80fe-5601-aa7d-9e97cc3e7006'::uuid, null::text, null::text, null::text, 'Shoulders'::text, null::boolean),
  ('b7c41110-2849-508a-a2f6-353581d48dcc'::uuid, null::text, null::text, null::text, 'Mobility'::text, false::boolean),
  ('8b978b38-7979-5718-8817-74fc0cfaf7d8'::uuid, null::text, 'bodyweight'::text, null::text, 'Mobility'::text, false::boolean),
  ('b13c1f42-b991-5f93-b4bd-d8f2f9978de5'::uuid, null::text, null::text, null::text, 'Legs'::text, null::boolean),
  ('df456391-691b-54ef-b4d3-9d6a174758b4'::uuid, 'shoulders'::text, null::text, 'deltoids'::text, 'Shoulders'::text, null::boolean),
  ('8cb66e6c-3a94-5f39-be83-4de016f42318'::uuid, 'legs'::text, null::text, 'hamstrings'::text, 'Legs'::text, null::boolean),
  ('19d75bc7-1d45-5ad3-93b8-c85d9a82eaab'::uuid, null::text, null::text, null::text, 'Mobility'::text, false::boolean),
  ('46cc126c-182c-51ee-ada4-9f0bc6773991'::uuid, null::text, null::text, null::text, 'Legs'::text, null::boolean),
  ('c6a163f5-e188-5710-948f-326ee56c0d8c'::uuid, 'cardio'::text, null::text, 'cardiovascular system'::text, 'Cardio'::text, false::boolean),
  ('cdc917f4-0382-59c7-9e9e-caf973e44a54'::uuid, null::text, null::text, null::text, 'Biceps'::text, false::boolean),
  ('233a77d2-9499-5740-ac72-2d0e3e2d896c'::uuid, null::text, null::text, null::text, 'Biceps'::text, false::boolean)
) as v(id, body_part, equipment, target_muscle, category, is_compound)
where e.id = v.id
  and e.source in ('exercisedb', 'wger', 'public_domain');

notify pgrst, 'reload schema';
