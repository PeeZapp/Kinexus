-- Enrich incomplete catalogue metadata (rules-only gap fill).
-- Only fills body_part/equipment/target_muscle when empty or body_part=other;
-- only sets category/is_compound when null. Never overwrites good data.
-- Touches source in (exercisedb, wger, public_domain) only.

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4f01ac66-32db-5fc3-afd5-442c652d48f0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2fa1689f-ac2e-5d68-84ca-85bc83eb47f4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'affd7a2f-47b3-5feb-a0e0-abb85c07bfae'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c51f7e00-5822-5fa3-9826-823482497762'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '838bb10d-3653-57ee-9384-1f9c35ba6558'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '210e9a8d-262f-5c86-a9db-7c197f7655ed'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Plyometrics' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7ab99d32-8da8-5fb0-bbcd-67444d649c43'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'df2da108-6125-52a0-8973-76b6fa2e5d6c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '912f02be-ef1e-53a0-b7a1-eb1bd2af8ace'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c4ab770e-e9f7-531e-a224-c244d9b0c8a4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '610f0637-fed9-5b0f-a804-0c9042a2d664'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '97d132db-98b4-5acd-89d1-04554ba0a09c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '522c04b0-0d1e-5ea5-a840-5b91bd84531d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0b913ca0-f523-5fe9-9cd5-ebfc3fb588c3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '744aac1e-743d-5328-b91b-d9694c74f873'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'eb823d51-ea1d-5c11-a30e-3d0b53f07952'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4a1035cf-81e5-570a-8e5d-91d305d2ebeb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8dfd5154-a820-5ee8-a018-881afd0d9a83'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abductors' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'ac27293d-8f97-5950-b0d0-2c7607bb4df6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = 'a914e32f-f690-5e96-8eb7-e1f3ab7c22b0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '3734156c-267b-5764-9da1-e02ce6f449c5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'adductors' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '984e392b-4ae1-5b62-88e3-03829e512a34'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'e9db5d38-da1f-531a-a7a2-09d0bd38ea92'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cdffe203-de29-5888-a404-c07a73e8769d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e4b2686e-061f-5979-9019-d36da5bdf53b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ae54f1ef-c49a-5a66-a4bd-51f322883031'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '1a197835-fe12-5219-81bf-ea88f0d4372d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5f0695a0-710a-5601-9e78-e9ac6ac5ef4b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '78f519dd-da5f-53f0-aa15-15a819f92f7b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '75f88b7e-b57b-5459-8dd5-6c647811f71c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7942a915-3507-523b-9b1c-bb3c0acb43c9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Plyometrics' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd128550a-6699-5dc6-a819-401e434f0d44'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '98272871-747c-5b00-b9af-b726f748c511'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end
where id = '46fd88dd-06d9-547e-a5b8-59ee7426f839'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a1796bf0-ae49-5df8-a20f-d9b1c9b6d499'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '869c4790-a851-5887-a23a-6d7fabc76d84'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'aaad9e85-2189-552c-a6b8-698cb523aad3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '97944d2f-86d9-5646-bb6b-23a845a1d90a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f54293f7-45f9-5ef4-8aa5-c8c7e40b4302'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6bf78394-7e1d-5455-9d41-7877dbb39fc3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1718262d-2c6c-526b-9f5e-25faff7e61aa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0ea2a22e-3b41-5ef0-8488-3e0f84024dc6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = '75fcf013-d2ac-5ee4-b0c5-e69a0c247c86'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '4fea8f0c-b6db-52dd-8410-1dd17ae9404d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '95c03acb-a2a0-5360-a2c1-812478cd1d19'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c5332b18-d619-51f2-9542-dbf57d51f089'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end
where id = '16bdf045-ad84-5d96-9b7b-348ce084a998'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = '17c4005b-8079-582f-bf81-fd563a8b93fc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c65ca05e-6bd9-583d-884d-485d7f4ca216'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'c1e852b1-bdc5-53a6-9f60-c2b2c777fa79'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '25b5c423-59c5-5616-8e56-cb0bd1e6f82e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = 'fc8aaede-c576-5aae-97c0-a03f51dcd5f8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'f8a8b58a-6c09-5734-971c-94444f453f6d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cc83964b-c0f0-588a-b23c-c188c521a0ea'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '832819ea-7cb8-58b4-a51d-032de463e414'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '45eda12b-c8ab-509f-8e26-cd4f970e2dd3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c7d4d2c9-15a8-5888-a378-afa210cd20e2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4300327b-1aa4-5846-98db-8297d4685490'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'a6c58497-06c6-545f-9f4e-73db621ed19d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3ba59447-ac89-547c-a539-baebcdf5f529'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = '2cf50f0e-a01e-51ff-a57c-aeffd563331e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '04518e9c-364e-570d-bb29-e123a943810b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5f31c45a-6859-558d-b3a3-5bc12a3cfb66'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5b996aa2-bdcd-5835-a88d-d459be25ef48'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bc2ba4ea-d754-5cef-9e8d-99f9b54217ff'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fdc8f5ab-8a16-5370-8d77-41928383d6a7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '936372c5-d03b-5dea-a3d5-fa7a81fc0fc1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '795838d7-00f2-5c49-b625-c52c78731b4c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e9bf7cc2-c5fb-5d51-b871-67ec17123c94'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '08128a29-b54b-5d9f-9f7e-72b2f7775150'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '66847353-8db1-5b7c-8e2d-57467b94a462'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c831b0f1-7a2a-5cfb-b3b0-67224f1cb424'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '03d3f9a8-ca50-5e0f-b845-b4ebfbed25d4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '565c3f10-598a-55f5-b4f7-fd76839728ab'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '31e58669-4805-5488-9a09-5e6e383f9949'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c238fca9-fec3-5a75-9a86-9ade1c5df5cd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '32c7cf95-1193-5d26-8ebd-f4099b03eb5d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e1a53532-45a6-5823-a494-ef316a5811cf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'aa7f798d-15b2-5dff-aae5-d9d44bdf65b5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0e19ccbe-d541-5cf1-b2b9-ccb8aecbbc50'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f6d01cb3-e4e6-502c-a9dc-d6ba00059302'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'a6ee574e-5f6e-57cb-ac2d-4e8158e613bc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '2917874b-3ada-5f31-9c7b-121ecee16d52'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'd79ca39b-0310-52fe-96a4-db98ca912eba'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ab9dc7d3-2259-5bd3-86b4-67da55673078'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = '10ff0929-d1fe-5461-9764-9353d3055446'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1a4d882e-42bd-5781-9833-2bf007e348f0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '5fb3929f-cf16-5c57-8951-20dec5a89585'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '16c2672f-9196-5101-999a-a96cd14ee955'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2062a2cb-0eb4-5209-a97f-65d490665159'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '84c1be97-40a5-509a-8c8a-83522326690d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '8c0ee0bc-3bc7-5d90-a266-2d2bf41abbeb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b05b80fe-fa83-526d-a316-2646fbb8e37e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c07b703d-aff8-5f9b-ba97-ae0f61bbcb84'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '265322da-5b2f-5913-b68a-c6392ec1683e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '4289c972-fb22-5c4b-b1fe-d7cff2177852'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'a963e119-ccb5-5837-8c92-614d5a65e220'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = '8558e43f-10c3-5e07-914d-56caa26af445'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '95574d22-ef12-5f11-9af9-7fa7bf965c4c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'c1366820-cd59-5dc7-9716-d2ac0fcd2b02'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end
where id = '3dbc7c5c-8ec7-51c2-9100-ca8816a82cb4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7c3d5215-3b75-5ea2-96ea-24a40001b152'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'medicine ball' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'a20c19b1-aa4c-5b5c-a8e9-281da89d00d7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd5aa6643-4bd0-53ac-96c8-32463bed7475'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '975d9b1f-d046-5635-9a2d-e9fa248b18fe'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f3b8cb6f-a57b-5a50-ab93-6fae039c0453'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'dcf60f84-3408-57bc-abe3-ee046a36a473'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ae84d83e-1220-5f1f-b639-e535bdbe7dda'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5d9dcc2f-6a90-539a-8084-4dbd2c11a22a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '69186557-a975-5900-8515-c65f48148039'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '46f00c83-46c2-52ba-b0e9-359038dce291'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '5cc1a3d2-9ea9-5c3d-84ed-1b336800c87a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5ddfb708-2a12-5aea-b72a-bf1ecb9c9d78'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0f029f10-d5fe-54a3-b273-7e0373caddf4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'db25cfa9-2a59-5c80-9161-28e86c25b889'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '90d227b1-dbf7-5218-beee-88d9b143249e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f2943c06-f54b-5936-9087-4361a2002792'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '3d6d49e0-5ec6-5e77-a2a7-f07eb35ff294'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3f272d9a-41b1-5fc6-bf0a-4ae2e2d1899c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'c36f1522-a990-55e9-af4a-c825b77c43c8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '42627221-6e9c-5d88-950d-927abfa18cad'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'b1278e14-b876-5ebd-8369-27d457357b12'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '892ceadf-0d53-5cd7-baf9-b56abbb942d9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a23596d5-40bc-50d1-8827-9da3b2c9c572'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '50fcfc3d-989c-5490-8856-40589348ce9b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '425ad53d-bbfe-5e89-b5a7-ef2ba74d0341'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '63171775-228f-501e-863b-162139a0cbbf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '66949c79-c5bb-5d52-ae8f-1a7338ff2e1b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f3e117d5-fdf9-556f-82e2-90b5e7a26957'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4232864b-a8e9-5870-ba91-580a55e42e42'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1390925a-af1b-5d38-b11b-54cead7b19b8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8e5a9b40-7c86-5193-bd22-ad01248fc5ec'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a67ca96a-0a76-5936-9db4-e79533f1f5f4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e48353a7-d3ce-57c3-8106-905449b61a9c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c7c5bcc8-bd8a-5c09-a7bc-2f4d4dd2ed96'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9f853a0d-05a3-5555-8a40-5b0d36f6ef1a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a7ab3b9f-2e25-5d1d-8457-a587e1b77bae'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0b3a2d8a-c062-5488-82fb-63e09a41e202'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '3bb8a78c-62bb-58c3-b0ca-7b661eff8a9d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'fac00ee9-5ebe-569a-8a15-160aa2579fe3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5024a5dd-7179-518f-b74c-6021e187772b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '04c1f79b-aa40-5e69-a1f8-e2b2ff7e5acc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5032849c-bf95-5c96-8dab-f2eca2cd288c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5a08caed-334b-5092-8c1c-6b665b3af34d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '11e74fb0-a5d8-5d7b-9cf3-9a2b60c557e7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8b9eca79-b3c1-590f-8d86-2f1baf280ca3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2cf3ca05-9f33-5722-b228-23b40c3a21f1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ea66076f-62b1-5f7e-8f9d-0887f5c34d9d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9438fb9e-d7fc-5bc8-a06a-e1c69e105db8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b6e6c246-3946-55be-8391-9cb35a8b0cf3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0c7a6201-fcb3-5b62-9e39-aa8d5effa8d1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3e28ec0f-5546-5f2e-a3b8-b42b41d477e5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b2da46ca-967a-52c1-a8e8-a09f0755eff6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '86b54804-4aac-56e6-915f-cecdd205edc2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = '8f3d9043-8fcb-5e6d-94fe-823eab938fbf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '335f7b3e-5475-5fca-a364-521f004c75da'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1547d3b6-caee-5bc1-aa76-dddb982b9d5f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '13779d7f-cc3f-562a-87cf-7449fcd236c6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '780bf700-b56c-5c1b-9e6c-2001171491e4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c8bd6fc0-4f7a-56b8-adb7-21a85f16a2c6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'f71aa287-a260-5042-b007-44df1a7a00d8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '95f18179-f7cb-572f-9098-66f83cdf340e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b8d83128-2840-514f-a48b-523b59130e6c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a94cc8a3-87e4-5b29-a325-7fa1cb353031'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '53649720-f1a9-5b6a-a578-0d953d1941e9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '07fffa48-5439-5145-81d0-47e34c66780a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0edbd884-c266-546d-9256-a8f7bad68f15'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e60f1fe9-d4e7-5853-aa9a-bb88aaefc8ac'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e549c345-6d3c-50cd-80f5-66a6b974d97f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '05c0434f-0a0a-56e3-9b50-a783f68d9dde'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '98fbfe0c-cfa7-53bc-b29e-218ed50ccec8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cb487f00-d7ea-5d6d-b41b-74ee3816209b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a8f374d9-a3c1-5fca-8a28-e7f8176747a7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0aab2464-8b79-5dac-8af1-0fb459d136b9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4a8bf858-d063-5702-ad8d-b292bc0e1ae8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end
where id = 'fcd1a074-942a-5961-b9ba-b32e96058f8e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'cb9ec713-6bb3-52b7-af7b-20a3ddc0a071'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'b20ba172-beaa-59fc-a7ae-1b83b8e75dbd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4dcf3e45-6ed6-5ff1-ae2f-5980e0b1d010'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2fdd7af4-98a0-5ac1-8cef-262f961a2feb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '357d887f-c7be-586e-ab3b-5ab7b7ae915b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f4ef0a55-6ed1-5105-91d2-30a3227bd0e8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a49eb6d6-e883-56a0-9a22-09539e44f03f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b4fa295c-4b6e-5534-81fd-43f530a8b0b1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'f99e9409-32cd-53d5-b13a-2f41b5a9594b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3c4ba83e-5057-54fc-a8ea-2ce49cbadee3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e3d103c6-a2ec-5f13-a3f8-914bb8550cd4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Full Body' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c1de5757-9fde-5aab-bc9b-135a3f2ad1c2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '73603d23-4b07-545a-827f-01b22610e94f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '78a9d915-c6d6-5bd7-b3f6-4185f4074c9b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '96378706-2286-5e5e-b651-05cdc3d662bc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end
where id = '108747d9-2c5a-5b1b-9b03-e7a33f3f83e5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3992483f-ca0a-581e-bbe2-780caa7bd6ab'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '08eb15ec-8421-5d24-a562-fcd5a61af14c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '203510f9-1c81-55ca-8912-dbfcaabe9b6f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '48c2c99a-7a18-54c4-af0c-d92c1eeb172a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '050dd001-38a6-5f76-be4e-f24389c88229'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2755910b-6ca4-531f-92ec-08f3fa8d0425'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'ac56cd64-8146-5a27-a0f0-910ee0993e02'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '95268358-5e43-56e6-a164-f7517eaaf8de'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ca5448df-50cb-5b12-84c6-c854b66429fd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '90b1b182-0950-55ba-be33-f752e47c997d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'aaee95ea-6000-5346-8f23-83dd8e88b8fc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e183b89d-decc-54d8-8726-4b8bc2c3f99e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c5bba853-01ca-591a-9d00-15c3528a6275'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'df94632f-c8ea-53bb-9f17-50c057a7b187'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1f880d13-ddbe-5d9f-9820-561db12c2dd1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = 'ba9c21f2-ea30-5a4d-8241-af561cf4a2ca'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0f6c2ed5-920e-5b47-9063-7f1aa615dba3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'ca0f2de1-e130-5084-8df3-d7e84a79cd7b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd15e33a9-ffbc-5c9c-937a-dd4f106f2676'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '31469a19-40a9-5940-8e57-008873fd2108'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b283794f-27e4-576d-b8e7-dcf3aa5d4909'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '46af8ef9-72d4-52fd-b9c3-ed5d5335ea7e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'afa43c84-79ac-5609-a34e-038503339da3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'bb09b391-9a52-5e0b-a160-855a0c455665'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '670e8132-78d1-5a5b-a638-f0e660092673'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f4618c11-4455-5b07-920b-05bf572fc3ec'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'dd0b7936-3a25-5e98-b9cb-369ce1a03e75'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '911ea90d-c3f5-5be2-acb8-49efb0be1526'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '031fd1a5-eec7-51c1-ab2a-00c62fa59ce4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4da71c3f-3f08-5ee9-b5ed-bfdeba867498'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f9e008b9-9fbd-55bc-91b0-bcd8988aa4d8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c639261e-b598-5983-a222-45f39fccf739'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b8c00c87-2859-5002-862f-1eb5979e46bf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '762d8d4b-60af-51aa-86e6-49092778bf58'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'd41d0139-5860-5481-9064-c7ac54a4ca3b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ca344c6a-fe60-57c6-ae2b-d15fc261bee2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1ddc4d34-9bca-57c3-b5c4-7e2169fe731d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1688d884-1ed8-5cfd-aef7-e068e6f4fa3b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'aebbec7c-34f3-5791-9cb8-ea72e765759b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'a5fc161f-6246-5b67-b149-181605118a8f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '906c018b-5478-5901-a3e5-136ba91cc165'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ebd36c4b-eb4c-50a4-9d7f-78ef1fc4c93c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd81c2ba9-d651-5628-a59d-21cb73f2877b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f754d2e0-e100-5324-9e97-0572f952b491'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a493274a-a3ac-50b1-938f-100394bbd956'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0a404a64-d7e0-5e5b-a1a7-3c2820c127d2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '641c255a-55bf-5461-8f15-ac3708bff9e9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '149ceed5-7e88-5274-b4d7-4f5fd1053051'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '7f17888d-6556-5ff2-8cc3-913385ca525b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '596a69bf-645e-5dc6-8f87-a1f6fa2b6bb1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e1e3948e-4353-5377-a7a0-058428a649de'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8f832542-b104-53a1-b0b7-c9dded025ee8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '3438c1a6-8072-5ce2-849b-8a843736fa72'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9fb0373e-85f3-5d3b-bd92-8f16d08d772f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '53b980fd-ee88-5e80-89bd-2e806442a604'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '409791ae-9cc6-57dd-81b5-dc5addb83e5e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9144cd96-703f-55f5-affd-55fec01f7289'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '517c0e90-ff93-5bad-b8e3-d300ddca331d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'efb032a5-00dd-5ea9-90d9-247b57549931'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '64862f79-b275-5071-974b-14a9b99e42b1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bfa2867e-b425-5069-8415-cd8109a9ef82'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'aeac0108-e84c-54c9-9959-612e46e1e220'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8d5fe277-709c-51f1-928b-e6d93a1617c7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ee0b29ef-5236-557e-9fc5-fa6245cf2317'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '864c555c-0cd0-5fa0-9747-5a6d4f99d901'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '73514b23-c867-5cba-b080-250b572c0c15'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = '6385547d-3ded-57a1-93a2-86420a631705'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '52d978a7-e988-5844-818a-e6c58944f448'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'bd5c853e-952c-5474-88e1-f668f43e060b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '71e4bc77-3368-5e99-bea4-01ba7ee8efb1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '01931fd9-999f-5ab8-9d5e-6e8eecd47102'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1a37bd71-e1d7-5093-8f39-af4744726173'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7a697090-769a-5c20-87ff-accaeca0ac4e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b04fecd2-334e-5fe3-854d-831378318d44'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9f5d4bd9-b358-54cf-97e0-2e0ea2914da0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4a858a97-9aed-51be-a1bc-60974f41355a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd5daa0fd-3a07-57fd-8ace-c4e165b05af2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd5afc51c-5a07-5121-9b59-aeb2ccdac955'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '5c4d3f2d-f000-55fe-95e7-b933fc1b142b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '952af376-d68a-52df-98c6-2a71c0753204'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7a01d5fd-a66e-56c5-94d3-d3bb20cb6b53'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4a16b633-2554-5982-a7ff-ed5648e11afe'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '91c415f6-2e36-5c2c-9a11-d926543ae29c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a417862c-4d90-51d7-93ce-4f9efb9d77f6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '71201c56-8d3d-598f-bacd-e987217431d7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bd55758d-f542-5b09-bb4a-254d6073fec5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0312631a-eee4-5d08-be8c-ba5fd9c3beee'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5dec3423-56d6-5f97-8a7a-1e4f36663a33'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '62126767-b2d0-5233-9358-f3754ea14617'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2b8bd981-2b46-506a-b277-0c39c11f28b3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '12c991c4-1eae-5057-baea-9f49459746f2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd0dc25b5-4ec7-52be-aaee-cd4165ec0417'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '45705a25-75a7-56ab-850a-153d0ede8895'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '67f33161-4be7-525e-9e50-2e5a43c9b7a8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7285c0e1-c9dd-54d5-85f6-287d7acac90c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '759ee837-a944-5c75-bf9f-ed0ed94c69e9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = 'b2dd8613-7b44-5637-9a2f-74eebe530a3a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c79cde73-65c6-5b74-87ca-c4481a124d80'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '13c25a53-e05b-5c1e-8511-0d66e87b3835'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '285eb5e2-0e48-5c6c-a704-4ad8219047b5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '46bbdce5-0c11-56b0-a964-398d4c95d6f2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e23f5721-f80a-5a92-988c-ef6706c74014'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cebf2c80-de32-5a84-9005-956c92dc3227'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '402e7dfd-cc13-50ad-aee3-47cdd562e378'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ff9b196b-d661-5b31-a7a6-4b2d8b1f78c8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'add38bb0-d3a0-50ad-bb58-276fad17fae0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '88b1208b-ef36-5941-91ee-70fca8a242a2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c0dc19cf-5f36-59ee-95f8-ab022acb528c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '106a1d85-e588-500b-bd71-72997ba65916'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3fb5d028-3468-5c62-a345-2f2574257e14'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'bbd7c787-a1a4-5a56-96e3-65b7ffe97c0b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f3e69cda-2fca-53bc-a19c-3d999eb3f25e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bc7e4e4c-569d-5b48-90e8-225da707315d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '68557611-907a-5a92-a61c-3b3a3c9a5635'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '767af0d6-35da-5928-965c-90020558609d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b592f85f-7dea-56e9-94c7-36a50fedd298'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0bda2374-9f24-5cd7-9309-906dacff8009'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5ba7a315-c78b-548a-9a00-804fa9478b45'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'e63aa294-094c-5383-8a2b-1d83e512507b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'bf41cc92-f401-5f0c-9ab6-117b56588eb3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'dceae648-4b51-5bf5-8325-a6a8b9ccdc70'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'aae7d4b4-bb14-5a13-9f78-4eb8c7256bd6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4c1934ec-a0dd-511b-b339-d834b6f02055'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Full Body' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0b1c2516-2cfc-5ffd-891b-1dc1d4f2e419'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'leverage machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '55ec05f0-6b91-5235-98ed-0884be45688b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c4a63b8c-b90d-527e-a455-07363533ae41'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6751f105-88c9-5b57-86aa-b4f8a35f4edf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2fa0f898-7326-5749-83db-5e0af23004f8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '500ea322-f172-5511-9636-4067a917e23d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0537a86b-6b87-502f-9f2e-0b340f55cc04'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5ecccf12-4c51-5e5d-afa4-f6247e0ab5eb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cc300a12-f746-5579-9014-52d07a2832ea'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'aa2b0ccc-7c43-5a4a-abe3-5b9c276c7646'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = '14e3ffde-e08b-5e4a-b7eb-db75e8cde498'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '225cc409-6e9d-5a03-87c8-14354637c1a5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd9545f6d-f427-5ee2-aeec-c54767b0a5b0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'faaa9cb9-3b32-5079-9c57-4609096f5f10'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end
where id = '47906144-09ca-52fa-b21d-51f79aa7449d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'd7b5798b-0361-5506-9185-8739f1a816cb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'calves' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '464cf796-c5e9-5020-9c36-172dc516fad8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '06a3b0ae-fd4f-52f5-94c4-aa4e14016b86'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6e28a851-5885-55d6-945a-d36ff92a5741'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0d511bbc-3215-550c-8b20-a35b27cb7510'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'bca1bfe3-02f5-5a67-9697-eb5a69458c41'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2b1a49ad-b1a4-5435-a9e4-dc33eeb7b95e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '60bed6c1-1157-5228-9cb5-5d164ececc59'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'cb83c8d1-03de-53d7-9c17-6901c06c74ad'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '256303e8-8cfd-5fab-820b-a85e80fba707'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '47fb0a19-e19c-59db-b53b-f3bf83c6c5cf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '89f5183a-92e5-5f0d-8991-cad08edc148c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2481e3cb-ed2a-571d-aa13-9fa719b64f82'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2a9c00ac-19c5-586d-84f7-3d347c7c8d99'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '57a1b5b7-b98b-55a5-8fac-ec2b008c5085'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '77ae0ca6-172b-5601-9858-cf1a7a40ae30'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'cb1da55b-d062-50a6-880a-e46be1f61666'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '169c5858-677e-57df-a6c6-1eaba5a651a4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '53634cc7-f105-5526-8e19-89d70bd6f688'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4ea6eab8-5b12-5264-b9df-08acac3b73a4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '63187daa-9006-5d24-96cc-87a6edddfb36'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '61b91436-475e-5dd0-b166-082c1c114dfe'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4eac5341-ab7c-56d4-9697-c47d0dd5e510'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'df2f32f7-9f57-5cbf-b97b-ce1d61540b2d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = '9d5ac9f7-c4d8-5bbf-aac4-cea612ea739c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '5847df9e-3442-5bd8-8c23-5fe1bbcf84d2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b82aeea3-8760-599b-a4fd-d757bf5c9d25'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0d1ecc3d-52a2-54c4-af83-0aa7f3b432f1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2f004d98-be1a-5140-8852-5059577dd920'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd371a3c4-9abe-585e-8d19-7755b48a1cbf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a4b63940-2a33-5a96-a1c5-9a65e8f4fba6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'bbd94fa0-13c1-558a-9aa6-c10b5a0808f7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd9865fad-db47-5c78-a402-48a591139b9b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '30c699df-7013-570a-8328-b0792af36f87'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2a9809a4-df55-5315-9f82-e5ba29f1d869'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9f721b3d-5086-5c26-8729-5c7b8252935b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'eb2ad69d-3b55-5ff4-8ab6-689bb6a77d1a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2d908ca9-144c-5f13-9c80-478e3c7527cf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a3e40d26-e0cc-5327-8189-255946f164f2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end
where id = '4141fdfd-1585-5f74-a0a3-49ebc674f2ad'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end
where id = '4fbf1810-baef-5312-8206-ce39f49e5396'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cdd479f0-3b36-5f60-afb6-931bd732871c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ecb60e58-c258-5c21-bff7-d223fb427a5c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '82e701f5-af45-5833-8135-323c6f933e86'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6564a2c6-a41e-5baa-9a90-be763a773964'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9253a4f2-439f-58f4-9811-c69757486257'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '7ac77bd0-5acd-5b79-b0b9-280baa7fbed8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '0479816f-b015-500b-aa62-c234e6504c0e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end
where id = '2a300ad6-afbc-503e-8ac3-4aab176cb5fb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end
where id = '67d65d1b-337e-5b6f-8044-c00a64a77bae'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7c6cce3d-49c1-5bec-947c-89f8fd5fc19f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5d94f3be-1582-55a0-9f4e-6fc5bcff3f38'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1f87cbd1-b087-53bc-94b7-6f5ec2af00e1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '8cd9a86d-9721-51cf-9cb1-0498a2709d5c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '12ee3f37-7577-58b9-a86e-508720c64882'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '48acd468-53fb-5c66-8cf4-7f3ee023f03d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'c4413d65-1152-57bb-998a-319b77b8e865'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd634e5c7-30a3-5d71-b45c-d12f480bbeca'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '249e580f-b4fd-5131-ac5b-ccbd10cb95f2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fdcc03e0-273f-5126-ba2d-6c85925e2bd2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b2a4d04c-bf6f-5572-851a-36a8de169071'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e3a3a6f6-be6c-5aac-a266-7ebbe50f3222'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1cc0053a-73d7-56ae-babc-f9046efef10f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4e1df226-a846-53fb-b936-b3acae9b9855'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '79504782-298b-55a1-9e29-4b94c1e529d7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '93d6cf71-89e9-5a7d-9efd-452d4826b26f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5f0ce40c-1cb5-5d0c-bc94-8f38dacb2043'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e359344d-02e7-5d30-8b7f-4671655854fc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bd40a3b1-124c-5bb7-9518-a9357fa3382b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f544177a-82ea-5bda-8ddc-24f5b98f7e22'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e7bbba81-9ad2-579c-aecd-01535b541c9b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'faf6c0cc-100a-5a2b-9fda-0f6c8530ce79'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'dc5170cc-7e43-5bba-92f3-e0ed69fe7b69'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd0795c03-fd69-577e-8da8-fe870fc2e633'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'adb71f3d-e31c-51f5-a5a0-f386646136b4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4951346d-c9ad-579e-88a6-49507e73c8e5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'de666862-0194-56f5-bd00-fcf7bd1fc751'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b16493f9-a160-59a2-977f-ff086b4eb317'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'c12675ba-649b-5e4f-be21-a6315b812c99'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '464bbcb0-45c6-5a2d-af4f-bd472f35d13b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = 'e8b54655-af89-5787-a2ac-07b4566a2ff4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a0e7672c-9226-5d5b-966c-428d98dbc159'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '15acb68a-ff69-5922-b0f4-e3b870092eff'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '05279f3f-e3d1-5717-ae6a-f9dc553c9db6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a15ed9ad-cee1-57fd-aaa0-a8477260ffc6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7edef72d-e4ab-5b07-a5a2-055bf45b4ff5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1efc3267-c931-5179-a28b-b6ae0063b131'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '272c8334-129e-596d-ab45-d0553f58f508'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end
where id = '61649a98-1666-59d4-a64e-ec695ee7ef7c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '1db0862f-7258-5d15-80a4-452c1520bd7e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '24ed5b78-71f4-56cb-9a69-6c2c26926a48'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '87c149ca-ff68-58a5-b6eb-9ef95e9e85d9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '381b881b-b6fd-5b19-961c-491e57548ee6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '22e78a56-cc7a-5524-b536-797fbb8dd98c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '68565dec-7b65-5e68-be95-58f05993f024'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Plyometrics' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f4c2d2b7-0078-576c-8e27-d62b45c16a09'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Plyometrics' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'adbc1f42-6029-55b2-8ef5-2a0b90a964d8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '23564ad4-69ae-54e7-85a6-94f58478c12d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'fcc34e79-f8ed-5f2b-8a4b-d4947269b3e6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '639cd2d8-ca51-507d-83c7-b7dd5a1f9a8e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '6ea940bf-5f86-5185-94f3-5b8519dbe922'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '1b768af6-f87f-5903-b770-7bcb748fe987'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '6eff96d0-da40-5a56-8327-cbaceb70f985'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '67cc9d3c-763e-5274-b48b-1863c593c0e7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'lower back' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = '4cbddca7-0080-5d67-98f9-76b10f9ae44d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '145cdb95-3bd2-5c8b-8673-ea3f4700afe4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1d84883f-1736-57d2-b83b-aa83c00e6a78'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e5d3ed0f-820c-5151-9698-667d160e7412'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e371f7ec-eef6-5376-a165-81d130279349'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0d656c82-8b43-5c96-8fc5-21c11689586c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a912dba3-cbcf-5104-bea3-2f31e9153653'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'fce55add-7e75-5251-ade9-436b49614dff'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f5876427-e415-5e72-8c19-f189030dfbd4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6515fecc-0352-5bda-8a90-a6369415ce69'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '68bc90a2-743a-5a18-a9fd-31dd9d31afee'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '074a9cde-f208-5df6-a0de-7cb68566b00a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'fb3714d6-5eb0-52a4-9113-15a4da80bb1b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '3c92a0f9-545c-5852-b7f7-3030176f55ae'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a6fe8abc-92e7-5230-a37d-f7a91f21d63e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd975da21-fd29-5cbb-9cd6-4ff59d25666d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9bfb002b-d4d4-542e-aed2-62df668a8d63'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0ea2327d-930b-54c4-859c-a5459dca3fa8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e3deb7dc-df8f-5d58-b822-eddb29c7af41'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c72ec414-513e-5f44-bebd-ce2c48cb8742'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ea192c2f-6402-549d-b9d9-99049dd9257d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8d85f52d-3b03-51fa-92e7-7cec57e1fb28'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7a518e3e-8463-5d63-9ba5-eca70313bb84'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8a2afd6a-ac40-5dec-9319-e8f03445eba2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8823050d-5fc3-56e3-b4ff-5e5d3f82fbfd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7a0fd70b-1294-51e9-ba21-2c022bce3bce'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e89f61c6-ae07-5efb-8b1a-c4cab9da2107'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9b62d0a0-081a-57e1-981c-98201d693d2c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '749066bd-a5cb-543b-b2fe-9f05f66ce3bb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9fc90476-e659-58eb-a014-66cdba5eecdb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '163fb61f-3f5d-5b83-b425-2f524da7ee8c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8a5be1e5-c204-52a4-af06-3993881dcba3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3d01ab36-eff5-5796-bbce-ef05bdd4505f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6fb6f450-ac1a-5b41-a836-a23e43862a97'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end
where id = 'e2d73ba7-0125-5bed-b259-98c81ec7ba5d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '299e88e9-9029-5b57-be48-5cb43e06100d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2d968f2f-092f-5dda-8f3c-31431c24163a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'e6ffa0aa-c2cb-515b-aba8-4392f0d52771'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9f405442-dc19-5a21-9ef2-ae7fe2731b20'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f8171b28-ead6-585c-ae05-86ef55b44274'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0d528adb-cfd0-5fbf-b9a2-f2ac55d7c72d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0fb74d4a-64e7-54c6-9987-a4745a9acd08'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a76f60fc-db50-5322-976d-4ebeb3c769b4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2859a704-4533-51cd-9121-39517d5715d8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '3061099d-693c-5619-9bbc-306b7c3fadc3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '2fee2985-4e04-5243-946b-92071aeb4e70'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd0d8e576-36b7-59c5-aab4-812eb5c3e672'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '02d03ad9-9bf7-5c59-8f54-daf9fa44ec29'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5d11ad8f-4db9-55c8-98bf-7bcde3aca98c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '30e2e84c-7849-5d79-b5bb-b50140285422'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4deb12c2-007b-5bd3-820e-f2bf31ae717b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b8a8eefe-4bb1-5225-9435-10907af2fde1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1d140f90-06db-514c-89e2-c422bcaa3715'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3b1550a1-db52-5381-85b4-4a70363b28dd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'aee960ee-a63c-56d4-b283-d55fea6101ae'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '16a9187a-e209-58b8-904d-9210033e07bf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ee710255-a330-5aec-bfba-36c5227d3413'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a76f87a1-ec0f-5487-bb57-367f58a1f9db'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '84f080bf-17b0-5c9c-98bd-d5da90923248'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '00f00580-fb6e-5aa0-975d-31d1551ee7ca'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c8f5605d-c01c-5524-8b9b-c2d7695f788d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '24fb6542-4084-533b-a945-bd5587e2d9b3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '66e556bb-a964-5867-88d7-cb9528028c51'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c3ff23dd-a57f-58a8-a3cd-8c61d658d632'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5315990f-33e9-5554-a0ee-28272171688a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'aef9af25-89ff-5ff1-b88f-520be5d605b1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a76da646-5260-58a8-b677-3a8115a15a1d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '65a9573c-b8d2-5e02-b0fa-55a38fa0089d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7b1e21ab-aecd-5281-b4e7-1ea43672753c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '698472d8-3117-5372-8186-6cb9ba8eaf93'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'aa099e7e-f37d-5c47-b978-d068c1887fb5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6d8273ec-3ad3-5cb5-a3de-92cbf8618660'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a5acec78-dbd1-59f6-bca2-7b3b733d8637'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '101f5b76-fa7c-59cd-ad50-98ceecef877b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '363576ef-7304-56f4-836b-d06b1d26a164'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c0520d05-47db-53f6-a9ca-54607b904cb0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '89417742-da76-585a-86f3-2b6765507e19'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '731646f8-9046-577f-a917-be77becfe0c9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ca24b85e-a4bf-5c82-b443-c390f395ea74'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5ef37014-0e5c-5097-93ee-198e0d76b982'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '69d01b07-6254-5829-84c4-a7ea3c6978b5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8f982a42-15ce-57ee-8e13-4cd20c1540c6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = 'eea30fba-b4f4-5882-97b7-cd85807aa741'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '17b0a0f2-b4de-5af7-8c60-60fe090fadcb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'shoulders' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ec9fb5e2-18dc-5dad-8796-6b7bcd48bfb2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '76a5bc15-a73a-5b85-bd5f-7c7f2b98506f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '23a94d36-45b6-5654-bac4-6bf2f21d63f5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7d37fcb7-0b58-5b2a-bf1c-df200a7fb21c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c2482f1f-ffc2-51a8-aa1d-bfcbec925485'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f447b12e-c4f5-5638-8d3b-65884afd0543'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '105cce52-904e-5020-87b0-a3807a9553d9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9a1f434e-f2e7-5c03-9846-9e822e1c445e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '358e5ca0-977c-57e5-a6de-f2deb3aa6439'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7b6782a0-8f43-5899-b89c-6fbdb4ce6d54'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8acec98b-e73e-5bdf-8b6c-c922a69dad10'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c86f84be-d26a-5299-9333-c3060b6eda54'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '57ded9c0-746b-557c-ae6d-8ff5617a1524'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b82e8a0a-b359-5d09-9b03-4e46d53328e4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9816368a-37cf-5204-879f-8d8b8b1c1bc1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f9872244-3a2d-5fbf-9d94-9d90a84864ec'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '78b070f4-f88f-5151-96a0-edd213e4df51'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd5daa802-fd31-50c7-a893-9bd6a5e4b74d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '3651d5bf-cd4d-545e-a7a0-705b0ebaf4ff'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '52770621-083d-535b-8bb1-96825b42b93c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c9a418f9-0550-521a-a833-2d147d289659'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1071bee6-caa8-505f-9edd-2e50ba002e75'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7178f2e9-998a-53ba-b96c-67529238a777'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '559660e6-a1c4-595d-be98-936d7a8dfd9f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a5dbc5d6-fd3e-5bb8-b164-27c895335cac'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e1cea2dd-6718-596f-ae1d-2d9a5038f716'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8f805907-bc98-5582-a8d1-0bff568e4e11'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '52df07a5-5745-5a6e-af58-d46edce1a10c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = 'ec185629-e033-5844-8b00-d73bef513ca3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0ac838d2-63ca-5614-8d87-cd4b55298c77'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd20931ff-9bc6-5fb3-9c88-079e1d4ad2ee'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a0004791-4013-5d7d-81ee-b85167856075'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0e841c15-deb7-58ae-aa1c-a3e14b58896d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4a728bd4-2f6d-56ef-9c5d-238e89672d97'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '64d90dff-a913-5922-91f2-3bffab5a79b9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'c089d7fd-c35e-5052-a8dc-4e13cae2a7f9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '04de30c7-e54c-590c-8590-ec5daee75bd2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1e0c5e78-6fc1-59ad-824f-5087fb1883c3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'af808df8-dd0a-59c8-bb3f-e1c16ddeecee'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b75aeb0e-12f7-55df-8d2e-2717de7191b1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'be568852-76e1-5c5e-853a-928667f428c3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '59e19729-4407-5dc2-98b8-d9f42898cac2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f4b7656b-25fc-53d0-914d-9fa6b1a98a94'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '036d7089-180c-5e97-96ff-b3f9fcc99537'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e77f86fd-2771-5003-b6f7-159791d556fe'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f9d788fd-7af9-54da-b6a2-cd89f12ec9f2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '101d1b0d-997a-5211-a696-b90c6715f742'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e785c056-20e8-5641-982b-a318bb164082'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd17b50e8-f3ac-591f-aa9c-6c8b176e2199'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c9523518-f2e4-5e37-a172-bfb6cb6255bd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fb623a41-bd36-5fb1-914d-0e3156054113'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '858ae862-cc0f-5248-b430-c72ee2f34720'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a5ee3b71-a613-59d2-a8b5-392a1e21ee6b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f009460a-6b52-5d99-90f4-1b2d6807b198'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6839d01d-7151-56ea-b17c-03c751df0e9a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a8d7fdfb-bae5-588c-b82d-f9c46e8c4967'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'db99e03d-b8aa-5817-9543-5771c7dc8e07'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cf638754-0eca-5230-848a-91058869f44a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '378756f8-be38-5f87-b963-24c104a224b2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd77cbff1-8e1e-5492-8ae7-55dac803264c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8e075465-a128-54ff-af8c-056b79cf3ce7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '995a83f4-7c0d-5a3b-a658-f4b74de82e0e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'da0e0646-fa25-5381-9085-aac10547fb9c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b71a7807-17e0-5948-b0dd-f0e88da7747f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b6cce0c4-973e-5667-9134-71ba8192e903'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '16e63cbb-7b1c-564f-abe6-2b8630b8f7c1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e7599913-bd84-5965-83fd-5d803a19009c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b4c8e037-9e56-5c6d-84ad-cea49ac687f1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = 'ec9acc77-a6a0-506d-a6cf-76e528d6c299'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b129d69f-86e4-5597-8696-6fa09c1be8cd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f87c0fa6-693c-5098-aecd-51922474be8b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd503d06d-054f-5b68-8e61-827e4764f92f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '24ea3647-f6c3-5987-9f0c-a799532f9f5d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8303c34c-9604-5fea-8125-4030a0af087f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3c4c4c2c-f02f-5b6c-a307-9d14bdc2e7e1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '77be9bee-8647-5ce6-9b58-a3b74a2aa7d6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c25b04df-7e11-517c-812d-c4bb427630ad'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b5d354e5-0de2-5644-b954-83422a4ba3f1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c190e01e-8212-58ec-a445-a5841b59846f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b5a6438f-069d-5e6d-956c-291c243f2f65'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'fe7d4280-94f5-511c-88d1-da38ddcd65c9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5122c760-e35c-5244-9295-005914b522fa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3d939b22-a570-5dab-965f-a425b3c8e65e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'aae75233-14a4-5f18-86fc-d20bac0a0b1d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f10958bd-c2cc-501b-b996-4bda3d334398'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6b99ecb6-1052-569d-8085-5b4657059a90'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1394b9b6-ba7c-5ef8-9b61-76a53533ef1c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'eeeaa43b-88d8-58ae-931f-25031279fc0f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ff48d977-d1cf-54ae-bc5b-bf599bd3dda6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2fa2729c-8231-5ad1-9afc-4a5379601fa4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '270eb36e-6673-5029-8eae-5e7916da7590'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b94accd3-cd23-536d-957c-d8a890df682a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '49930c3c-b0d5-5105-9503-b3d92055a502'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '25ba4ba2-f657-5d82-83d7-17289b434446'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '7fba7ee5-dfdf-550f-86f3-cb7829f8b017'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2e95f93e-591c-568f-ad62-08392004b43e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '79c0b96b-0428-5bbe-8ac1-1026274bb153'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a6de8b25-d6b0-5eef-b0d3-5c090c96a09d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '209d9056-6872-5661-bf6c-25ddaf020d2f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6a2985bf-5d67-5fda-b2b5-387c1f4b7e27'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'calves' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'af22d714-f177-519a-9b66-54b7455643b5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0ebd60ff-97e9-5573-ac06-7789fcefb13a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'calves' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b1b6c5e5-c75f-5d58-be1a-c0d153c6ba42'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'calves' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '87be7237-5a0e-56bf-8550-6dfe2cc0db4e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'calves' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '34a8ce63-2aa1-5066-84b1-fb5636715d54'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'calves' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c4048fd9-bb9a-5593-819b-a7eb7a5cfeee'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f9b157a7-2bbd-5268-a22b-de0443a47d95'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '38335d2c-1d73-5061-8fc3-de8bbfb39aac'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd2b41f27-0801-51e7-8b36-e1145b23205a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ab33d81e-628a-5f18-8c3b-8d211d10335b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'foam roll' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'calves' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '350ea77b-8768-5230-b521-27f61ebb32b5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  category = case when category is null then 'Legs' else category end
where id = '86c7541b-c25c-5aa9-b055-bca95a7b57bb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '90af9e99-1d9b-521e-b69a-6d42cf80ef53'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '53eabb9c-6264-58ef-9a2a-715e504c31e0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '918b13de-8810-57e4-b648-8aa599c8e2da'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = 'fa485bbb-2336-51af-8088-20d17f6d7605'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '626bed24-f1df-57be-90a1-4d0f52820a2d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e28e9c7b-b20b-5ff9-96c8-15dcdd454833'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '75bd4442-2748-5106-95a2-9773149c8234'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c56d5ccb-0c20-5780-8ba1-58b5239e72f7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'dec66eef-0519-5b43-af32-3ebab56069c7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd5c82cfd-6e13-5e20-9f21-695e23ac2132'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end
where id = '2dded1d6-3e43-58db-9637-db43cbe054ab'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c303e75c-e5d5-5415-82b8-4895da5a0f2f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ecd05b5d-5ac0-5e81-85b3-1bc8d07ee0fc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '442f4562-4b86-5358-b3ec-18c3a8a17aaf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a2d5f5e6-ceeb-5ef5-8ddc-5d166a86e04c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c7f38529-9c93-5465-81e1-2f405987a7bb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'de93153e-44a9-55a7-9224-347892268f60'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5ee85fbe-560c-5dce-9b0a-0b8acef57e17'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7d75b203-6acb-5e85-831d-6a587a8730c4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'leverage machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ef26fd54-a641-5e40-896f-37c7067e1767'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '95c500a9-34f7-56af-beea-d4e8b88c2e7c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '8a58fbc1-4c53-5e89-9d7e-f666aed25316'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '2378306d-d9d5-50a8-8edf-6761a6363436'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2847a82d-b3c7-5da8-acb5-2130e3627c30'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f82bc8f1-3e44-5891-a599-7e5e92fc8aed'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'b3a5f7de-25af-5911-9e44-e2ec930a0699'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b9432e9f-9cd1-5211-b83a-ca20fe59aadd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = 'e4da8dc7-d14c-5b0d-a7f1-527b1cadce86'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '569aebd0-4df4-503f-9c12-75cf2427fa34'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7e7bf010-60e0-58e0-994b-e6c1eee3a92f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9a910910-871e-502b-a4af-61db4bc95294'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'b684bb25-c8a6-52b9-b098-ae764adaf5d3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b750e440-93c7-52c7-9e01-daabeaacd795'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '0ea62cf6-44e0-555f-ad01-c48eb72bdfc0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a929e35a-ff93-573e-8282-1f61b8f46929'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'b3d89aca-f5ed-576a-a590-9c804843a192'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'c1c1b7e3-745e-5e23-99d3-80b3ab744b66'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '04a2971f-28f6-535a-a356-5dee84d26f52'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Full Body' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'faab5b19-8d85-5339-9084-8ba047e9f05f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Full Body' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '36a90d50-d886-50ed-bc88-335c054dc797'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Full Body' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'bc857f92-f1e4-5158-b5f5-01b637715328'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '47f56164-6a09-511b-a206-3838c49354fa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2e624c39-a923-58f0-abf6-17476e425641'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '564a1f31-5847-5447-8d73-9fbcc2ec3bbb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a79afdd4-3c49-5714-aa57-a465b998ba03'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4e25d2e8-894a-5379-9c06-558297fcbefd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '57e09a61-a691-55e2-a8f9-7e87ca7b91fd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'neck' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'neck' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '813dfa47-db83-57cc-ab31-ab9c8c7c2fe0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd8110691-a7ce-521e-91c9-0ad05390475d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'eb8eb61c-f738-5992-861e-f639fbf12199'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '115d989b-3c0b-50c2-85c3-d8a784c8fb7e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c5410560-22b4-5bc2-9858-8bdc6e71918b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e1165d16-0923-5223-8fa9-8a1f399caa50'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '587cb96b-3c60-57e9-bc2e-5585345b7d68'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '20bb7b0e-2d95-51fa-a789-fdebbadff35d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '78ee02f6-626c-590e-9f76-606f5bdbea17'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9ff26bf9-cfe4-5f9c-b687-1d837c9ddfb7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a68093dd-a187-5d0e-839b-40fb12ef15f1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'be53f6aa-6862-522b-9a59-c5e651ebb01b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'df4bdc15-8704-58ea-9d81-cfa2c52c2fd8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end
where id = 'f9585bfd-7738-5fd0-971b-30ef81de6256'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '406b91c9-e7c4-5212-a613-4eeca5ad506d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'adductors' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '902e408c-5d13-5cd3-a6e7-d128bb37d2c0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2426a610-5da9-5789-8e4d-fd85f5b00ea2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '386f7c34-e11d-5cc0-b5d2-9cbc2d0344c6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'neck' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'neck' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'fa65a755-a301-5b4a-a391-aae5fe250afa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1ea3868f-5e22-53ae-9ab0-8e4f682f6053'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fcc5d186-c6c6-5abd-9bce-a04b4ec2c931'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '79d21e12-9157-5a8d-b799-6b1109e20b5c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '8b6da513-1f8f-5904-a174-e238161ab372'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '863c76e4-f151-5ea0-8c03-0a61cb5d21d9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '453dacf9-568a-52a4-a9d6-d219160e415c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'eff749f5-9569-5272-a2ce-b914eded06b0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '47f6e191-f90e-54e3-abd9-7c71ee78a09a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '223fbc32-7de0-536b-adeb-df3f21a3636c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '59b592c1-76e6-52ed-a675-cc9d14264d47'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd281e682-0200-5213-902f-4c239f9eb375'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'af97b3c6-0206-5815-bab1-a6947d5a203c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1c8aa4a3-e5da-5ea1-a25d-bcd950984391'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a8e0ea0f-9015-5aef-90e2-8a970958961b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7fb6794b-806c-5979-adf4-b7c1ea47f996'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '00c7c28c-aa16-5ad5-a318-53181b6dce34'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end
where id = '2226685c-e2da-5aed-bdec-b31a815c3d57'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'f1fa42d7-1714-521d-8704-db76c836cac4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3bdaea69-174a-541a-8bda-bc07fd59cc2d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8423b46c-3836-5a83-9605-69559bf256d6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2f204a4a-d9d5-5437-a38e-605726b8dbb5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'kettlebell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '10f30f34-7930-5729-9b95-3e04873fe0ba'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8d2612b1-15e3-5792-8442-55a07a4d2f9f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd659d2fb-3fc1-5c6b-8211-4a3362708a69'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '22c8ff0f-3c2b-542b-9eb4-57a97e60e576'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c683c0c9-bf08-5032-a6be-8bdb87d4a15f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ae882ace-07f2-5e67-9acc-510513bdf8d1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b7dc7af6-bb19-5089-a9ac-c0e74a4e4348'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'b82e8214-bfdf-5a95-bce8-00d6209352a4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '35f6e3ce-60dd-527f-aa7c-7a47534ba836'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '144027bb-0c29-540e-9b09-1ffa7d6bd998'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '531922ef-6fc5-554f-87bd-716da93698e2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2c728e6e-97d5-509e-b0e0-e57dafa42f97'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '2bd86f8c-9e48-5e56-8da7-daa8ace1e6fb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '357965cb-6d1f-5e32-b0d5-1d097c8792ff'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '72da23f3-2ab9-5e21-889e-35f44ca9e58d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '82030109-2972-5206-8101-41841e6920ac'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f991f213-5eb9-57f0-af03-2bcec53a2870'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '05e1296f-b279-5bbf-96ce-b8b99a7dfe06'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '53db830c-1615-5e62-a5c6-2f74240e9755'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5214ae00-8250-5559-bd4b-0f8be3a46909'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '85b3a0e5-a9a0-513e-850b-59733581e61d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '36d5f50f-f90e-5233-b0a5-04c19b0884ab'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bb5321bc-4800-5c2f-bad9-70a4680f698b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '7aa7baef-762a-52ac-8df5-17a59c2fd8b5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c2fd1575-d7ee-5657-9728-bab366614e7b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'adc983e6-9184-51f8-af83-997cc9bcfeb0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '663e0b8e-6210-5c07-bea4-ad5b9293ab81'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'abc14dcb-1f3b-58c2-8dce-f744c0f095cb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ffd5d629-e95a-5d8a-8c84-df438ad8a96a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '66f8cc22-0b1e-5e5f-ab1b-b7ced642b52e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '12892935-2e5d-53f1-9fd5-87472550ec5f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'c651a074-160d-50c5-9a03-8e18023e0fa4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '651c17ac-7474-5297-b086-38b531771268'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end
where id = '8a9e1fa0-979d-5783-af55-797913a4f7a0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '48eae10f-e502-5a72-ab84-eb332ab3a23a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = 'a8012f5f-e291-569b-a02d-4e332ff82e38'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end
where id = 'e49aaf76-792d-5839-8e46-c482ee775d6a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a2c2e63e-2909-5184-b821-01880bf8c5e5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a84cb879-dfe1-559a-90d9-e4b571b64600'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'kettlebell' else equipment end,
  category = case when category is null then 'Full Body' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f419e03b-b772-5349-8937-26726ae4decb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'kettlebell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '592bd1aa-31ce-5e70-ac6a-27ac0528dd24'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'b06db3ce-a1af-5f11-823b-5023d388a101'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'calves' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '97f0d31e-e1b0-5351-816f-7f06ae26c150'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7a3bed65-463b-58c3-8ee5-860a04e3ad4f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '50dd65e5-2ce0-5323-a236-4f5c9808bef4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b83610d0-c89f-55d6-9981-d3cb62684983'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8eacbd94-37ea-58e0-aa8f-901d6a3f4c3c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '80510995-9cdf-5f03-8ff3-d5b62776c35b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3200e8d2-fa20-53ff-bf2a-0dda384f5d24'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '7f199687-cd5b-5a57-9148-5fba87139c49'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '119a4c0e-a68e-5f24-a6cc-3ef9745e52d5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6a08db30-99b5-5598-9d5b-c14f526aa8a0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9f609477-d310-55f9-b53d-0f9815e85183'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '32da7fb2-cb7a-5981-98b7-920ba48eafa3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b92dcdb6-ba23-55cb-957a-7d72460f819c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8e379da6-fdd1-510b-b729-74a1adb4911e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '59725feb-3ec5-55c7-9c4e-3d2b1f238522'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1adde5ee-4fe2-507c-bd78-1e45a1d4d1bd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7bae930d-5847-5715-8c16-2b0cbe5ee702'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '33487e67-72ee-5a55-9d62-bbd1f38fd5c0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e8235772-4703-5191-8544-8d9df4b43664'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '6cf43c44-ff68-5a22-b6ab-fc59615e5dff'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9b8729bb-1eab-5d54-8ad6-91d62a89c9ba'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd2f1e4ed-0522-5887-a922-e3d0e83fbb13'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9c3f7dca-6f4c-58f8-9158-15aad92bff9b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '66698024-32aa-56d8-8abf-623e3a749c20'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e248b7ef-9875-5076-8071-3bf22fef815a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '212a6576-86c7-5141-b029-ecb6e9ada5c4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '76577e0d-38d5-5e9e-a196-83acdc19b992'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9b74f0f0-fa6a-52ec-b6e9-90292a6e1348'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a91d5e56-deed-5a92-8771-e9c33c077052'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e2625152-0bdf-5975-b7c7-1af94b95070f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '53162484-3b5d-58d8-9f3a-8bb13c582c7c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7708b3a9-833a-5ec2-902d-db097f32ba0f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8473be13-335b-5f1e-a29c-37f6643f3dc8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2e0cee44-bef5-51de-8e27-c200c209b592'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '647e774a-44c0-5b30-beb9-a615a24e00f6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1f051976-9ed7-5736-b45e-9e6400a953fc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Plyometrics' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5c31000f-8ad5-5e40-94b5-d982a11f8ac0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd1c8401c-f5c5-575c-abc6-40406cfa9592'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '67920a4d-c342-5dfa-844d-aab23b98f537'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '04e7f97c-d5e7-5d37-badc-f824b29b0ee2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a39c771d-fb44-55f6-aed1-55c693c6d652'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e9392876-6852-5e86-80c2-dfceba65daea'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4b5441c9-ed4e-5117-a563-967a428619d4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e15c8c1d-8219-54fc-8e70-efc7ba8b7ae3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'body only' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'd972793a-8089-5c29-a697-268c86a3a2f1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ef2cbd63-b181-5ff6-82b1-31fa6994ec26'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '30a8faa4-36c2-5fc0-a42f-c46bcd452c49'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f6411681-811d-5fae-bbd4-db1c984c68a8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ada8a36b-14ad-5867-b69e-a05f597cd6d1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e12c83ca-fa9f-5640-9e6f-ab97b8c057ae'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e4f1414a-0fe1-56fe-bd86-a4fa00854975'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '43b5d702-1899-5b3b-b0c7-a6d2067824b1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8c85cbbd-b75f-5eed-8809-5fc90a86d794'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '536cab4e-072c-5170-b26b-f8cbd108dde8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '67ed32cc-4439-567e-83fb-2b884dca9ee2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8793ba65-c41e-58e6-bf49-d8dab50764bb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '00c48470-e3bc-5088-bfba-a94fe8761d3e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end
where id = 'a9215469-efdc-50b0-b80f-8824336ef646'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end
where id = 'a0e7ea32-5a6d-56f9-b6ae-42c52898f564'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end
where id = 'd6789433-36d4-5d48-b595-341c9ca25099'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end
where id = '8dc20aff-4a9f-5d7d-aea8-9c305cc68cb2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c1d8ac0c-bb03-58fc-879f-fa0508f93298'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '392b237d-c03e-563f-8899-bd0a3c5166ac'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '39359fe9-fb0e-532c-83d5-3bdadfe24a64'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '23604955-6901-52f4-930a-f48fb2de6c45'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6d72a1ca-fa6b-563e-ae49-e33fc2c1e47c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'bd72e8df-a7a1-57ed-90cc-3e8669823ffe'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '75512abc-fadb-5694-9788-052fc0bee424'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e0da9477-efad-5d0b-85af-530e100b637d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd835946b-88b0-5820-b2a4-762e750cfa90'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '83a4426f-2e54-50a2-aca3-8ed339f1564e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1c3d339e-1619-59db-a436-ea45bd7fea82'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '516ac751-ddc7-5e79-8103-ddf016bb2257'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end
where id = '1cc28537-b0ae-5273-9821-c106e2276ee8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end
where id = '6360ee3b-d977-5ea7-9c9c-f05fcee31067'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '96201720-08eb-57d9-8bad-abeb5a5adab1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e66a30eb-c7c7-5e39-a210-bd62e8b402c5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '38682338-636e-5bc1-93c9-db3308f13501'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '02782bb7-78a9-5fe8-abd8-eb58386b6e41'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3ba30a8b-5ca7-502d-9382-ee070d09c531'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '09b19c69-f03e-5d4f-ac27-0d8aa0f9ee47'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'abd3f15c-33c8-5927-a45f-aa0504397090'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '720ee927-9bb8-584c-b671-7d28da25af5f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fdf15339-511e-5d7a-a046-a335a4f06fa6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '08281adf-e9f3-58d6-b480-063d41126d9b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8c9c761f-ee2d-5349-9f4b-1503effc81a9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f97bcae2-252a-55f9-ad14-9f6f73b0eae2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0b88617f-259c-5487-b4e3-eb81e76d7a01'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2efa15c3-6f2e-5460-aa1f-919856d87067'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c842f94c-bd97-5c8c-a48e-a8624cb4baab'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fd39e04c-be28-5639-8f71-fca1552ce20e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '30e2f189-0d46-5f80-a308-7bb200f6ed6c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b0467bbe-1aec-578d-8d8d-4e3b69bab8a6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1bfff072-0e7b-5768-bcd1-fe4c1941bb39'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '433884aa-39a7-5f24-803d-086e3ba8b219'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c455757c-bfc2-5156-b3b8-e5ca60c5a661'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1d97c474-ffcb-5a4b-933b-fefeebc47572'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5cce9c51-4bef-55db-8809-d2d344be2658'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2a244b9d-42df-5bb5-a5f0-179fbca36256'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b9fc1b79-2b66-52d3-9f7d-41f659dec8e7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9e274f5d-b92b-5689-be22-74ce3412fe63'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd062e64f-d24c-5f77-87af-d00f5598ea25'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9bbc2333-8dec-5fd4-8528-79dc617f0259'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4f8a9013-dd6f-5484-a5b1-b14111af510a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c3c7c9a4-1bd7-5b12-b5a6-4799e91103cd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '17868110-754f-57f4-9c1c-ca08b7f58ecc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c4515e4b-a558-5db6-8098-d95fba90acfe'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'caaf7545-d142-5bbf-a540-9f05e0f0433c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '065e917f-32b2-5248-9de2-36f9c7c0d3bd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = 'baf34ae6-ea2c-54b0-87bc-05e545217097'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f76cd49b-5ed0-55d5-966a-722c98a2c3ac'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9d3a75a5-75b3-5830-9984-40ce120c0051'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9f4dd434-dee7-5444-9840-96e24e2512aa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2a254537-f526-5a5e-a6ba-4c11d3bad08d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2ec28a18-3b84-5c1f-9a54-e721a7b9f216'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'd34994a8-e8c4-5abe-bce2-d339629357a4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '44ef30ca-e341-51ca-b835-ba3f435c5e44'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '3e92ceed-3e82-5912-9cf0-510240484e64'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '552a53b2-cdf7-564c-966b-c839663c09ac'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4fcb3ace-5541-5f8a-9064-9ce9e7eb7143'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'faf06dd9-656e-54cd-a150-ba45f3a6c0b7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = 'd334f7ec-e8e1-5dd4-98d8-9b95ba1094dc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'db71ffec-abb4-5c5f-b7c3-9512fcb4771b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e0a01371-9864-5d4b-aa93-ff639efc5233'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '994b8c20-cfd0-5546-a083-a0891fba0c22'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6f8a4a0e-77cd-5853-9ba8-30d05f9eb983'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e587ae6b-c3e0-5aba-bb73-cbfe1367b411'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4ff7095e-a076-5cb6-b8a6-2c56d457b985'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '2e4bb768-621e-5898-8b55-b4fd04c75e13'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'eee3a18f-59f2-5e6a-9038-5242049e9c82'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '080e7fdb-7fbd-5cfe-8532-d9edf7f405b2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '474700b7-fcde-5b76-82a0-8ed5ac13d7ee'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '358af5fd-53c2-5828-83bb-99e7a64c47b2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f509895b-877c-5598-881d-b4ea65d6de66'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '67bffe87-dde6-5b50-ac6e-b07ca7ae163d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd5f27180-0162-501a-a091-1afcef7cff7f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6f1f2099-6d87-5827-ad7d-a3feaea5496b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0de80fa1-c670-5ab2-b449-daeb615dd297'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '42c86881-3409-5d97-a753-f3c69a2d7e8c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'calves' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cd0851ce-b6d7-510b-aa48-be78c3ea80a9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd2a3ca79-f92e-5134-ad9e-70ade06eed74'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3f4c1677-dc5c-5e29-b6d1-8a7e48f01451'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c3155b2c-6b54-528e-95a9-3fb6fe56115c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '391f9321-6d49-5fbd-850e-b16cc90eab57'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e6e75c70-55f7-5ecb-b26b-1c0fcde9a00a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'db016b87-8ad3-5128-9737-6f8536044d48'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c12dda61-bc3d-564a-b794-12a49ee06f3d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7568f4b3-5dd2-5ef8-99d6-414e0f3566af'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Plyometrics' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '72ca1278-d5a9-55ab-a09f-3c4636631995'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '78f500f6-2cdf-56c8-829f-c1ad57f76c86'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '366b59f3-41e2-5b72-a955-ba2a7e2ae58d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'aa2153fc-1f4a-5bd0-8633-1c23139b9840'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'afb4dfab-9f08-57d5-8a2e-d13800fce266'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6dd22b1e-e833-5232-971b-ec1c53821319'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6828c550-9a77-5a39-b031-ffe6997b936f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f7a2895b-b0df-5e29-9fd0-6191e6933b39'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'a9c8cd49-3af9-5fe2-b8fe-24be42056de3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f5e60442-4c54-55f6-9772-856750060695'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '2872b78b-009f-59c0-96b2-f0d9fd9be70d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ef64a809-8b34-5727-b237-a22b702a2b18'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'a96858ec-bbb3-50b2-9360-8c3b3ae01397'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '06089152-9c0f-5208-81e7-35480bd76173'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4ea4c9f5-b045-50f5-a298-93c77120fb02'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd4faac76-2756-566b-b097-c95a10537ce4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a0fdf54e-3d51-5c50-a028-d3e7c34b49a3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fc4f4c8e-1a59-5455-9d61-dc1d5c16aee3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e7864f66-bc36-5f70-8956-71261c4ab14c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2b5e9cdc-012c-5d00-abd7-bbd2b86bac39'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '45e7037f-da9c-5f26-8a16-7ba93afb19f5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ad2d1cdd-0ae0-56ff-ad6c-29d77ca9ab20'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4a70c3c2-4a5c-535b-84e2-4917f6bbdb24'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f84e2a3e-0dfb-54c0-a84b-bb37b33880c3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '551476a5-1389-5f73-82c4-c8e68576fe7a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4f9362da-114f-5fcc-a9f4-8f994acb970d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4fd6281a-1461-57d1-a9d5-24b33e7ccedc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0999d016-3f8c-59dc-91e0-fcb6270f5a00'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'dd37ef6d-1ea8-52fe-aa31-38f77a6b0a6e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0e5b6fad-2b8f-5b1c-beb2-0bc07a66f74c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7eda25cb-efec-5d39-8588-80cbd5e0d907'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5737cda2-900e-5460-a504-1e311618ce8c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '6e5def9c-d549-5c9e-bf7d-a6a85263ce27'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '38161cc9-f8c6-5103-9082-c4eb973adf7c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e9a620f0-4427-5d25-8b76-89c200ba3528'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5de1e3f4-363d-5e86-b254-483ed045d72f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1ee4ef9a-952d-5de0-8dc3-77cad18e8c45'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c5c6861f-cb39-52d6-8547-6e9184820baa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '92bc7894-5329-52c3-b454-d7d069c1e3a2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '11d8efb1-2355-5216-a4b6-3fe8dca7e7dc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e1f8c691-d522-5096-9da0-46cd949bff44'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'dc5f79ea-3816-56cb-b79a-090dbc16857d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c8ae3f7d-30be-5c50-b032-da8472313160'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '24b53638-e283-5825-9913-951eef54d747'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'fc54d1ef-8297-59d0-8ad9-ab1298172940'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9719008c-3326-533a-88ea-c91a2fb70fea'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ef1525dc-255f-5f94-9e72-64501ca15112'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '59c77afa-001a-55f8-985e-9725781c6fa2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'da34a1b1-5bef-5b84-9d80-bb351206ce0d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '80a5a091-fa68-5dbc-8e7a-79188cd73cea'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd94b56f1-0954-5d68-93bd-7e43a7b118c5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '783b31ef-6f26-5bdd-b185-4c6bdc3ec949'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bfc9d829-8583-5ddf-be81-2fbb0b8386ca'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2d1bde87-8c9e-56d8-88df-d5ebe08e05f7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7403f5a8-9036-5a37-b0ea-a28c5830a794'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'eb56aa24-d94c-5aa7-ac7a-ef0a34e399ca'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0cd9493a-0178-5c37-919e-16518efc962d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8762983d-bc01-5007-95ab-c58b41850266'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd8f42575-3ff9-51e6-9db6-cbec85a7f7e6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '179bbc2e-9cb0-5e05-add7-e0488daa72a6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '60da576e-6914-52a9-87d8-f55637e2a584'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fe4f4652-097f-53c5-96b5-fa61d78e1896'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8aa19a32-c03b-5fe1-8b42-bce7d4717d7d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '00f1d4b9-0f69-569b-9e88-5e086cbcc9f0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '12915692-ce53-56c3-a435-45f5fbf1a083'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = '9a2c1823-11a4-59a5-b082-aad660ee1d69'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '240ad0a5-76c1-5be8-ad96-e78c51186e5a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a72ba2f9-f7a4-54e9-8a06-d01525434895'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '308ecab0-e0d2-51a7-bb02-4b89c0a5de26'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c537c159-42b1-5f34-93f3-ad409aa57d64'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0146962f-07ed-5712-b09a-c7ec452220d9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '72081d46-af8b-5063-a96f-35d519032608'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5756c636-e1d4-530b-9d37-fb0422c3b465'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '561b7a5b-731f-56d5-b75f-35555b984777'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b7b41c27-eeeb-5f01-ad9c-db8b92224d6a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '885d4ee2-2ff6-511d-92a0-4aeae47e8f6d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ae988155-1c25-5950-84a1-d7fb4990fb37'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4510f07b-f710-5279-bddf-dd7d46d58d4a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '056b7c78-c4b3-5a67-a10f-1fbd30e2959f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '26cb84c5-7d8a-5fb5-a423-924682821a52'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6194795c-07e2-572a-8620-95b8f26ce525'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '602e022c-0e03-53be-b91e-810808e25fd7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1f2f160d-d525-5f92-971d-76a33d741bb0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b02dc347-fad4-5e58-b55e-d3a8a8f0f3d5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '65b43683-1840-501b-bbc4-48e52271a992'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '83306426-efa3-59bf-b89b-de631e19315d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3b85a982-873b-5257-bf63-424971fd82d1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f5d6add9-ca66-51a9-876b-b7054649be14'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '40bb578c-f2f6-5fb9-af0a-a2c9408dc7fd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1351aace-01c1-5f6f-83dc-77623c1cb301'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0a9cd146-f5e5-5858-9698-7d7cbc8d6736'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '47843ed9-4c9f-5775-8d33-4f590891f330'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ea56c7c4-6e64-5f15-b1c9-71c27883d0e0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'fb09aea1-49a1-5b89-b63c-3d206669ae21'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '71543a18-83c5-5e41-b666-1f8bf9892c01'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7a26b00d-f1e0-506b-a565-4b3e40431c3c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'aec1251a-0705-5ffd-89af-f4f046206dcb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4a5325b0-6385-5311-a969-20774198367a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f557788b-44f7-5ac6-8651-9ddf530eb4c3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fda68966-7144-57a6-9e61-83a52234b47f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5ec82b4e-5ec0-5d72-a0c3-392a473ba46d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '86928ff4-3310-5991-94f4-69ed2055a87c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'cebe13e9-10b0-5bf2-8de7-f63476ad2433'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '19db58a2-9ec3-5754-afee-4a74bded5860'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ca8979f1-fd0b-575e-8cd4-9b7b9cbb35a9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f132633d-f2b0-563b-b9c2-8cc9e001c01a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7fc242f3-d3bc-5ed4-be69-a117ef523701'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '810d6d2e-4934-5444-8061-099e72ce0921'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '88dd9c3c-6cd2-5e47-9dea-2cc2be84ccf5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4154321d-7a08-5655-bb00-48e5d29d6d8a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '74a0283f-faeb-5e5f-859b-ebc113faa836'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8ebea453-389f-5d2f-a01d-6980bf3434c4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a3cb0465-037f-57a8-bfad-f5d344954508'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '820c4040-890a-530e-84cd-f95414d7c48a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5eda2396-bb5f-5b60-ba87-6c9d4db88dab'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '66671bee-903a-58de-8ca0-4cf58925058c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e699a7b2-7000-5e53-b0ce-1ede3586b05c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '811caef3-c61b-54bc-88b7-e0e74242ce32'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = 'f30936a7-a5d3-5eb6-a6bd-bc61347f1fc7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bdba1e10-97e5-5858-bbf4-e85968445249'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0249592e-6e31-514f-8f0f-9c34a8d1474a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '04eb9a48-0cce-50bf-921b-5124645a1bdf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ddf6bdbb-24fb-5995-88ed-97003e52cff6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'db5e6bc0-a144-5e48-8203-b044d04f016d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7e9a169a-21ed-57da-86e1-6e685b5c1443'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0efafe2f-4c47-5313-b327-4f2f194d48ac'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '42977cd1-5636-5f76-a285-d87cbad8f601'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '31fdbc18-3898-5dfc-9f8a-ed46e6737a4e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '504c156f-9d51-55ff-84c7-305344dc493c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e903ae07-16bd-5528-a429-4ba4c566dab4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3d2a0da8-042b-5869-a436-21387dbc9160'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7702c9c9-a215-593a-ab3c-6b54be6e5e40'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '632d071d-f819-5bb0-8334-bee6f3665dc8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c575dd5c-ef7d-5f07-aa2c-d85e0f59d1b1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f6728380-aefe-52eb-aa71-44f00a0a57a1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f041b1f3-72c4-5b67-bd54-e6e4f521e83e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '594befa9-d0d8-550a-86cc-040c58a897a9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '72ab7f45-9906-54df-b58d-1a5e8c4f7c29'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5f099789-54a4-590e-bebc-90fd259ef568'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'd05890f3-b6f5-5160-80ca-8f3a5aabc777'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '02703287-69f5-58c8-b024-3299b6c8a814'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0f6e68d1-efd6-5023-8be4-de74b516007c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '62d5db02-1b6b-529b-bfc8-00d45e7921fb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '04da57ac-ce3a-54bc-afcb-5ca015858eda'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '1f9a2583-2cfa-592c-9019-d28535cba753'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5d9d073e-47f8-5c42-8f67-0b61b5729633'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e58d241b-09b9-51f1-b415-f0843426ad44'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0251282d-fda5-5f36-8723-ed79f147847d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7e716135-6cf8-5571-8aa2-72108b396d47'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4c3807ce-06ba-5654-81d3-435e447973ad'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Full Body' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ccb11f8f-cffd-5aad-92f3-ef32627970ad'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c490d28f-0f51-5085-a530-236dd814981d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'leverage machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a13ca989-759f-50e4-8407-2fabc2b36738'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ab925d6b-1a58-5260-a8db-da9b641376d2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0537e508-11b1-52ad-b0a7-34f2a6a5774f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ed94939e-cb64-57b1-977d-01961e6882e9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b10bc5ef-881d-5c16-ad32-c31325a50a14'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7fed51ff-7aa5-5900-912b-c6ca4aec7b16'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '6b74b9dd-2531-5726-932a-a961a7592d85'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '218161b0-14e3-5355-85b9-8be6178cac98'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'af77bf7d-b833-54b3-8235-ac7447c376b2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end
where id = 'c825979a-21de-5645-9758-9e25fa26c732'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fc6936e8-a258-506d-b868-c103a7cd2890'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0efe2dfa-718b-5ae5-a1d2-8e662305fc33'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end
where id = '4282c16a-c787-5f1e-a652-0030cb6932a0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '86a0896e-14a3-5210-91d8-ea1bd72744de'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '771e67eb-8da5-505d-ab5e-0e1c02782bb2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'af09a4d3-05d7-5cfe-ad76-a55312f2a130'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7449bce9-720f-5aa7-bfa2-4a93c1eddea9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'kettlebell' else equipment end
where id = '7fac79da-1765-5d57-b8d3-c5ed89f94f46'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fcd36b25-0a40-5697-8178-05b04bd59be3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd6d91e1e-522b-5d5c-8535-81442fb370f4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '0cf7a31d-698d-54d5-8dcb-3b3c65d6b56f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = '84041ab7-3555-5a9d-9c20-5a37ed455e4b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '6170936d-4341-50f4-b813-e017cc0aea2b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e4753c17-9e72-5ebb-9929-87bd5a3802b8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'fa5a5af4-eee9-59b8-a020-44aa91866da6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd1931d85-39e3-52db-9481-fa5d1902df1e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b0c24d32-c807-5d8b-9137-aa4fb6f69263'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'fb6cd418-7fec-52fb-8c24-5932b2c77fa6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '1e67ddf0-d0c3-5e66-959d-1c830dcf2404'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '34f49301-524c-509b-8af9-4427ccb048ac'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'dd2f25f6-d4d4-5bcd-8b71-3cf3975093d1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'e1718c6e-4643-5405-94ba-e962be3fddfa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7db87221-c58c-5d89-9db2-bbc2d807df87'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6177a055-53f8-564d-b30c-d5057354562e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '0d76a014-23dd-5b38-bbed-901eba37e18d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7fb1a927-3df7-5490-ad70-2278850f343f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '77abb53b-fe3f-59d8-abd1-fc8c2845ca6e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '71f392ad-0914-58f7-90a2-e30825c270d9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'dbad6c98-d7da-5ca5-9ca4-0fc509670f49'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9472c037-b742-52e6-bc1f-5afc2818b1fd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0d6d8801-88a5-5139-b7d9-0a9b92e3ec71'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '5b71a69a-d953-5567-95ee-21e297a9c5e2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f913e944-d8f3-5ab6-8af0-e134c125e96b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '259b4591-338f-58d2-acb9-8a72f6103b70'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2a6e0375-fcfe-5d8a-abd8-5a0a3be4190a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b136b078-11a1-52d0-8ab9-cb160182a5cb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3767580a-9ae3-5977-a348-ba07a2ec8ea6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '71d1c1ae-8dbc-547a-8a33-d3225ff1f6b3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '7c21918c-8c67-5aee-a1d1-462dac9c6a2b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8ed1f366-c639-50e7-8379-02d281d9b92c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '56ce3b62-3d2c-5780-8eaa-4af7a8f6e2d1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a2da3408-5f48-5aba-a914-70db7898abd2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '747f43b0-9f39-58bd-96c3-bef48d3b9102'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'af89812f-1ba4-591e-9cb1-dbf547082e73'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'dd5aa537-212b-5269-815e-efba80f9c908'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end
where id = 'a56bcc3e-3c45-52bf-bd04-080bf0f232bb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'calves' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'b9c934ec-70ad-580a-8f43-58238dca0c69'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '7f031cbb-6dc5-56c2-95f7-c48a6c5651b6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '99f9e59f-54b9-58c8-a7dd-f57aeb7f670c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3e2ec5b5-a3b1-5de2-b37c-8ece8e0f93b1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '193b2c26-d659-5c31-8f2f-60c13e9cdb85'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '831a2bd6-0e9d-5e42-a162-c59fd47a46f7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '145dffde-0f73-50ef-b00d-daf15df73344'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '793d530a-bccb-5345-b300-6120aad249d9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f8e68110-a3bc-54f9-a0e8-b39ba0af7253'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '139cc773-a87e-5f58-94b2-5a1266cf196e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '645b2102-45b9-57ed-af94-c6ffe511b592'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '72cbcce4-15d4-5d02-bd07-fac6dce35620'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1e647399-3d67-5310-9e43-18b490ccc2a7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'da865cbc-aa8c-597f-9e5e-84f33337ce20'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e9d674ff-6409-5110-a951-39c6353c5ceb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '80f50639-5710-5b4a-9705-89d717c52305'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c67e05c6-03b8-5c65-b839-85a7559a864c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '91b968fe-126f-56a7-98da-5ad462c02380'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e8750c42-53df-5e80-8a33-8829ff9158ad'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a3055169-ec5d-52c0-a886-bdf3f1150947'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '6f7e1834-fb88-506a-abf6-b63aa20baf45'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '83396a94-03d5-5a64-bb73-962bcbf5e6fb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '89d92cd0-d0d1-5b87-bc8a-dc5fe84e2d37'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e45752be-3dec-59a5-9809-f56600df7e04'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5fa9b6a4-e2e7-59b0-a21a-505690e0fc3d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7a2e1ec9-87f0-54c8-af12-721159d5c508'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end
where id = '371ee796-b337-51a6-8b0f-908ead8f0d14'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3918c596-fa6e-59d2-bfd9-f4940ec9e923'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = 'fef8213a-5b52-5f51-970d-0db37fbab158'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ee073d57-19c9-5bc9-801a-0e6220fbb3d9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd2cf931e-bd42-59c1-90d7-cba1a13924c7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0ac3036d-53a6-57ff-9d10-58fe6fc55766'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '786f1da2-c370-59f4-83a2-b49f52d7f1a0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = 'de74f8d5-f373-5326-9514-ec5f051e9419'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '04a28654-99f6-511b-bbc2-aa932cedcbe3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '5d2a259a-b80a-5c03-b0fe-cf286ca6b9a2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '37be2950-81b5-5e8f-98c6-dedbd0eedba9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end
where id = '1f63ad71-86dd-5c6a-a234-0d229b24c680'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '0ce0441d-0ccd-556b-bf9d-1c6ff93d9e01'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e0b68eaf-9136-514a-afd2-1b5803dae8f0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3887949c-2174-50d6-ac60-509f9c4e6754'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '83452d8b-4353-57d7-81da-05f25bd8f02f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ae49391a-6890-554e-9d0b-0940951e6e13'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'forearms' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'forearms' else target_muscle end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a6045005-6d17-5bf8-8efc-780d8dc4f413'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end
where id = '1536f4b4-5614-59cc-b8e4-bf3d3756e917'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b3aa1233-00d9-56a6-848c-5512c65d0944'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '275553a4-83f8-5940-9dd5-a081ab6cddc4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end
where id = 'b6e97581-427d-5be0-9ba2-0fa07f77ec52'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end
where id = '9b39561f-236d-5c14-9125-aabd59cdd234'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ec0f6b75-3c9f-5167-9d76-e5026bfe6627'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'fe3a5e20-faef-568e-aa7f-745a103da588'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3e98f811-6917-5845-a167-5563b8ed4b75'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '73d95b92-1cb2-5a3b-ba6d-c6103acd26fc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f28f9510-fdf3-5d7c-beae-be0d73d1d561'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end
where id = '15bde88a-2ca6-5a01-ae5c-96a0406c59e8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '3aecd114-304c-5708-8a0c-ec7df925af85'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '64cfa39b-3612-5792-ba01-6fdbe4e1390e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3ba734d6-4b49-5160-99bc-ea9e45d288fe'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '05c6c65b-45a9-5a20-9191-c3f87ce8326f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'foam roll' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'adductors' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '3b8efe8a-046d-55ce-a3c8-2e33cc27c077'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'foam roll' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd0f1675b-2561-5f33-a28e-2f9a73c2805c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'foam roll' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end
where id = 'b467e8b1-e5cd-5e04-8920-16289fe9f817'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1bb2ca63-ac7b-5039-969c-3a1070cf37a0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'foam roll' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3d6f7b92-153c-5748-8b5f-d9b8e53c99a9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6a0f025d-6129-5dad-a4d8-e7d2d88bb6f6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end
where id = 'ba61574e-db97-5ee5-8486-c3dfe3946d21'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '01a5a9e5-2df8-5b8b-8b10-40ac6d5f85fa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '425b53f0-3024-56e3-8136-490cf3df0ba7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '410aec90-258c-56cb-9716-e0a11a26b940'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'cdb34b46-ece5-5ed6-8f99-2ad22699bf48'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '48664148-dabc-550a-9fa0-8966aaa34e9d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ba757835-1884-5973-bc0f-8b8caa605e0b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9fd3f1db-7734-5b3a-9c72-1f667b3dc334'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '6cf24d19-ca7c-5896-87a0-31c5dd7c1959'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '982a94f7-8220-5b62-8150-060032ef0ec2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e839a926-d14f-5944-99eb-efa224e24c21'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end
where id = '63fd00b4-5ce6-52e6-916c-400bef91d47d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2e229943-4df8-50b6-802c-c9a7d4e3c972'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '9206bbd5-8a98-5210-839b-98accef3429f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '9bd7cf21-c17f-56a8-99b9-fd2e5b698261'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9d53aee4-0b16-5212-a860-fedede384974'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '7646813d-2674-5640-8385-59aca9e3b3a8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'f018224b-6f77-5833-8bb5-6962c1f241f0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '055f6667-27c1-539a-8b61-3f174cf0e515'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '49b125ea-3310-5542-8ac4-f6b9c82a1cea'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = 'c5809a58-7d33-5db3-8966-6403a2fc54f2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3d38cfbc-97c3-54ba-b484-eb375f5e99a9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '70a64211-90da-5a44-804a-eeb5eb35db3f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fbf46ef4-c198-55be-b958-8ba5f3fd633a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '05b2a1cf-523d-5a77-a7ed-6ef705c0d22f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd8b0df01-d4fa-5936-8a1b-cfb26ac3c676'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'e502b926-d6f5-5967-87ec-ba44ed968449'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'd2ad8f03-a1ae-59e3-8aea-6c04b7d9c976'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '905f7319-1683-56e7-bd71-f023a8ddc553'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2d2db445-02fe-5dc7-93c5-511d813e1a38'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '3b6f765d-eace-55d9-8a38-0e38b126e637'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '0a372754-9106-511d-915f-68519144277d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'e2b4e17b-9fc9-548d-9e83-d533af8257d7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'e4278e0c-50f2-5b0d-8f30-5e4bc689f60b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2c4e4982-9534-5da2-a22f-a167282e7d42'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c48ae56c-2b4b-54ea-bd63-9f6d92ba6090'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7386f62c-338f-5128-b836-b74cc5ba448d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'dc836cfc-b1e7-5685-9234-f2994d70ff56'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'c4b25590-1cb9-59cc-bdee-ba633ef19054'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end
where id = '51a73d2e-c9b4-560c-be82-4d3b6609497f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = 'e062f158-a82a-592b-8607-956a5742def4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '41f30d31-51b9-5637-83c0-c316e97bffb6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '064efaa4-76b4-5334-891e-48133de592b6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end
where id = 'cd756faf-86bc-5173-a996-0d26d3539042'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd1abbc76-3d81-51f2-ba85-cedcfedad6fd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'body only' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '74f4be80-0a65-5649-839d-991f680180e5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '38335814-dbf1-5c50-b464-47a972010d66'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'aebdd1c2-a1b5-518d-8721-f0dd24dc486a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4340b077-c8b9-5bcf-a7f6-babdfb4c0c28'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '209b365b-c658-5b64-bb6c-26cf5d68db86'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '8ee3b304-3b22-52fb-90fd-007fb53f06ce'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f64b57c0-6d1b-51c8-964a-a9a19517fc96'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '941b673f-1ca0-59ca-a747-c95ade463409'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1e598313-6e4f-57fe-bd0d-204dd61e74a2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cc9a69cc-8f6e-5af4-906d-267e776f1867'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'c4037eb9-a8bc-5e79-965e-a15cde807040'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '67aa4452-7bc5-5c97-9441-a8a36c68f931'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a6eb7196-e021-5aa9-9724-feb8a97bf2fc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '659d1271-3e64-5462-8f25-4c8367d85b97'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '657d113f-07a8-594d-8681-5c411971b48f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '47ecab3f-b8b5-5f8c-9eac-42db78f1797c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '25717190-9c14-51cc-9601-e75e773373a9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end
where id = '52caac2a-e85c-5e1f-bc67-9051505e7ba6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8d5a95b7-7e72-5ffd-af55-8e0147aa04a3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'dc9b2826-c6b1-5873-b2ee-1c27b34b9e2a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '79056275-b8b1-5013-b109-614e0714324e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '9f6b83a7-9569-5d05-be03-05da33834301'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'foam roll' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '7f904b13-beb6-5d24-930a-dc08af83dcc8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'b6c1bac4-c8ac-5ea4-bcc9-8dad72158a3a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cb3de383-32bc-57ff-b88b-2308c5742d6f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'f1696f70-de5f-5d56-b0b5-d7ba5dcc8f72'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '79a4fdd4-9d2b-519c-a4cb-a7538ff2bf2a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'a65cc66d-e689-5218-ad8c-d3d3ad071c10'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'b57429e4-c369-526e-ae89-7c945953cf34'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = '6b512cc6-c20a-5502-862d-b46a59837987'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '2362f611-0a03-5774-9354-0acecdf49f12'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3103ca63-2963-5f76-94d5-9bc1ccc4056b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4931019e-b50c-510a-be11-cbe6c0473aa6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd2e340bd-3e69-505f-9319-bb02cecb1939'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '76f4670d-8664-56a0-8a9b-621d5e32b11d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'e98f5f7a-7d67-5d2d-821d-425316e06216'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c35efed4-0c2c-59f8-9f21-8b49352b59f2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '08544b3e-b187-5582-9554-0ed3c7405786'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd9ec0aaa-ec46-52c2-a88f-5370e9c17451'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0dda5a17-191a-5967-8d50-f8021abc0510'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c78f07d9-43ee-51b8-ad7d-e49f4b41732f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'eda60d30-f356-5af4-adfb-637ccfb1bdf4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'aa55b0da-8f19-535c-9085-ad6e22acafa3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3851b431-31e3-5ad2-a9b4-e94bf70bfb95'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'f19bcd3d-272e-5032-8f4a-72e00f811f7c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'neck' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'neck' else target_muscle end
where id = 'd83ab4c2-99b6-54e3-8831-054152e38ff3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0a15bf40-3d87-53e5-9d0a-425a38cecbce'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end
where id = '002842c8-b871-561b-b9d9-44e9b1f05a3e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end
where id = '210dbcc8-ab78-55ea-961b-ddacf0a609d9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '60b6b064-4704-5927-aacf-1dff4abde052'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '93442ee1-f629-5ed0-92c8-36d39667b58b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Plyometrics' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b547a541-1442-5991-8f6f-774be915d8d7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '67f0460e-1519-5af3-b5dd-9e2db2107a17'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '909a2114-5b89-5b50-ad88-1b6ac480e97b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'fd0e3f1e-8495-5c6a-9260-d6856a0b71dc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f8e715b0-33ae-590a-a4f4-1211ba085f62'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end
where id = 'd0f8d178-d2dd-5ffa-b404-fb7a13c6066c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4babaa12-0335-5095-a8e3-c204e8669eda'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'smith machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5ac69d42-20f4-5dc0-a95e-daf0679262be'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = '4937f2f1-a8ae-5135-8614-097f3b8275af'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '05e36974-25e9-5ef8-8014-727dde42251e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '37cd5381-1bbf-5ab8-bd15-afd99e99b39b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'body only' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abductors' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '0532362f-705b-518b-8799-87914cee706f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '6f03c9a5-a824-5280-b2c8-92b3bd207fbc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a783a55f-48a8-5db6-952a-0e483be55856'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2b66599c-c1c6-5386-b71a-ac0d891c78eb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'eb6758fc-7966-5b84-90bb-0ff908c1b296'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b1f05646-d981-5c64-bf5e-18273bdc40c2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'kettlebell' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '84a374b1-237d-5b9a-a1f1-e8656084ebaa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bd8afc4e-438c-5081-99db-2c39652563d8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  is_compound = case when is_compound is null then false else is_compound end
where id = '41aa24dc-ae14-5e10-8526-4cf132d69a9f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1d6c5647-a1ed-59db-89c8-e1232eb8ff10'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'adductors' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '78ffed69-f6d6-5059-a637-7115e0a749c4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f743a271-9255-5815-886a-408e020eefc3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5ad23282-6c31-5d85-873e-f1b7ec71c35d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '789e1442-e128-5960-89a5-e7c8b4515ffe'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '1137f8f8-c963-5482-bfcb-b3597171d76d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'c546cb38-caa8-5053-ae6c-2158e57c6d5e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'a9ce97bd-4c9e-5f98-90bc-35bb10b35d09'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1382b548-3e04-5c96-9b3a-380637d1e280'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'stability ball' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end
where id = 'fe04db3f-8118-52c8-9399-1279f1ee4b42'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'e1e04a1a-4e4a-5871-8a88-5c63cb3ccea3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '80b97aee-b9ab-52f9-a10f-2b1e65c01f44'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'other' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'lower back' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = 'b33283a9-53e0-599a-bfd3-72115a613d2d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '810a936a-c0a8-5dab-90bd-781bf3e301b2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a64f3ba8-99c3-5aac-922f-0e4a6a9c2c26'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = '44050b14-8b59-58d0-bffe-6b81464a23ea'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b4798b96-2137-500e-8de0-570ba680bfbd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = 'ec5f7040-b1c4-5baa-b679-937844fcdd1b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '2dcb5e8b-fb54-58f6-9466-45c7205e3493'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5ab46ad2-ce0b-5855-b95e-54d48fa4571a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '066dbf0b-1a83-5342-9077-8aa3d0deb313'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd537e6ca-7ac9-5e3e-936a-09927a8c4895'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f181130d-dcec-5c32-ab5d-42ad7c444775'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2541794c-ce74-5894-a36d-09b680d715f9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a9e503c4-a7d4-54ba-8374-9e0336ca9a29'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'df574530-0dcc-5ebf-9a17-e2c7c31a6c8e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '208ed9be-1a70-5447-bc0a-d551264b87f9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '976f2004-c9f7-5ed9-8996-c7aac2d89dfe'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'd1549e2a-6d41-5076-95c9-0652383275b0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f927a3f3-03b2-53c3-9a24-ebaa3734f680'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '85588a90-779e-5975-bae6-1bc313f39206'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'df2d15c9-1f2e-577c-a1d6-0c0289845991'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f652c54b-ebb3-52a8-9a7b-52ccf9a58ea2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end
where id = '24aba917-c8de-549c-8842-675ff2acdd0b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '166120bf-5534-58bd-ad3d-0b0153eb4585'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '732a4c57-e9a9-5a49-8f15-03cc57221a93'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'cd2fde54-7e30-5b52-839f-d466bab15b58'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'dece0f1a-9dc5-5edd-ae60-183759963c25'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '863c9179-475d-5bdc-97e4-a49711d3b2c2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '4a3f1d8f-8149-5ea4-8525-81c4eb054007'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'a31ccb96-d1a7-57b2-bfd4-a8da4bceefb8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '900f6aa4-e19d-54bb-a0ce-968100730c35'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'd0b9d980-76c1-56b9-9248-6408c37417ba'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e95fe6ee-110c-5432-ad13-4cee7fc9e373'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '9c4f7cfe-d113-5066-a647-9650f140f652'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c919593e-db2f-5f5c-bfdf-199855859b10'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'd3344431-b9d8-5580-b6c4-3ebc0010a3e1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6cff5a4e-6478-5785-84e2-677f8f85cc36'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4208f12d-8935-54f4-ae21-000e8b51ea54'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'afbe09d3-b40f-5ca5-b97d-669044ef96e7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '13ec7e44-47b9-54d0-8abe-74686c9fdae6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6038c804-5ac9-5da4-9047-28e4ad49f752'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f8c36515-5a05-5339-b447-7c2e85187052'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '802d66ea-7089-54ab-9a0f-d162499d119c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8341767d-e4fb-5e2f-b664-60024114cbd7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '88efb4d8-2f79-5e94-9c3e-87c6f1057011'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '791b24e3-b1a4-5bfb-9646-5c81bd859309'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '47a7edf3-d1ca-5501-81c9-94c095b6a894'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '43977c71-2706-53aa-8442-bead2feb231c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f8454441-e1c3-5898-80c2-d6ddfb6e4dae'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ee57693d-5499-5f15-aa5b-9f1a81a77db4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end
where id = 'af193dca-1a34-5edc-b6a3-aafb2ad4caec'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '7a41daad-22e7-5cb2-830e-1abcb1120d90'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'd1b00426-7d59-5a35-945d-16b6102d39b9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'db879b07-4d38-57a5-80bd-4c32a0d19eff'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '5f434a1d-44e6-5fb8-9b33-b102495fbd9e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6ff4b2ce-9b42-5bf6-aae6-dbe9c8455f04'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Plyometrics' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '563a9093-936e-5b67-9b7d-b6ea628d4d34'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'dc909668-72cb-5ae5-9854-b09db2e9adaa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6d7e9735-7b9d-5f94-b7ac-650d6110067a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '07dae34e-b7f8-594f-a3ba-ddaaba824c02'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4d14511d-f54d-52a5-be48-199c35a673ea'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '8a7edef9-1063-5d3e-9714-6d323497f3ff'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '2b8e7355-5b17-5e4d-af32-b4765c67c98f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'fa7c3eca-4811-55cb-85fb-fd727d26a6a9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '90bb2c99-c10d-56b0-810a-85d837bfee8e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '43fbf2d3-6863-55a6-8dd8-15bdb52e7a60'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '16ac378e-266a-5fd3-8a32-ac09b3c9cad7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '60ae635d-3504-525a-b70f-f8767153ed81'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f3ad0a43-8e6d-5cb4-bef3-c0da5c9d7255'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1f551c33-6012-5dc7-b56f-fe576dc6939e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Plyometrics' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '10b04eeb-2e4f-5daa-b482-459dbf106cb6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Plyometrics' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'dd055f1c-e164-51a6-b11a-bc6158afbc21'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '2aa11c57-748a-5a14-9816-58850d78c9dc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end
where id = '27c6ed7a-e77c-5860-931d-a8d3bd39a8bc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = 'ece5d549-b751-5ecc-84f7-671eabd48a40'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f375f380-482f-57da-b60d-c291f6e5cb7b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b593bce5-ac29-5413-b8db-949ab94fbb38'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '556e7a29-87b5-52c6-82e2-cb4a05901816'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8fc5ce78-ee4c-5628-87d4-0d2bebcabd6a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f451cc3b-67d1-57f5-b9e8-e2435be0bb7a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2f1d1297-2266-507a-8ae9-1d13a83bed94'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a9fdd49e-c64e-511b-983b-4d1991e2ffcb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8b1a6a35-e1b8-5833-a3cf-39d0a5988ceb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '56b1972b-9c46-5ae6-b4b0-1f14f4bb2963'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2c259ae7-5191-5da8-9d85-e3af171f8ee7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'kettlebell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'c2673e11-248b-5016-8ac0-0ef13aafaca7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2455224b-bf8a-5ef8-875a-bb5e220922fd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = 'fb82c7ba-f940-587e-b4e0-4103bcfbc208'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'efa310e2-1f74-5d30-9203-42d56f855f88'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1fe2f8b6-3986-58c1-951e-ff726ffeaee4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'c7537040-c706-5a8f-a3ed-290f19c65e23'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '70883e0f-056b-579c-8a47-5e78f70336c7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c1564a6b-ea60-534c-873a-003509492002'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6c0b6718-da67-56f7-8ca3-8133ddbfeb9d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3462f06e-ccb0-5f40-8513-d6859c4ac8e1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '7a9e7839-57d0-5f22-b5c4-57d9461bcc82'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'dc2ae290-69ed-532d-876c-4f5d78938ca9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '156b33e6-e3db-572f-8aff-01f954da3944'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c30d795f-b940-5646-82fb-bdbd4d4ce015'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1119cf42-a1a1-57b4-ab43-5bc9a745af80'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e36f587c-9c8d-554e-9ae4-9c9d06aee525'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '3da8def6-feda-5cec-a58b-7b03e22afa38'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = 'c8157278-4d76-5ad8-b5b9-43575e2e3cca'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '45583e46-2231-53be-b974-c48ae51715ff'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Plyometrics' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2a9112a6-6131-5d7d-b8d8-0dc1b867b793'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '862ec629-20f4-5fbe-bb03-db2aafde0dd4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2eec49c5-6bff-51f7-a7da-feb3cdc4168c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '63aa1aed-adc3-56fb-80c4-2ccf79a6c73d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Full Body' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'cfd09de3-f34d-5318-8bca-0edde1b0cd47'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '08d71b83-7a63-5677-ae7e-50d1e6f7f660'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '31c5fd5e-c7f2-5da7-9902-63aae58b8c03'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'abfc60bb-412e-59a5-a4c8-eb9e27bd8f57'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e9ee2195-d53d-5014-bff8-99f37da5ba55'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5d11620a-3cdb-5e6e-bf59-6a8d97c4c18b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ab914ca0-43fe-52fd-b207-35c9f8bef6d4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '17d21c2d-c1eb-5d0d-8e70-69b4a0a428c3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '332560fd-12f0-56e6-bf22-f54a261e5cf2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '6450dc8d-140b-58eb-9612-238e3929f813'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'kettlebell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'c797ae68-b131-5832-8544-482d40594de0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Full Body' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ec0f5fc6-2537-57f7-a280-e46dff34e7b6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Full Body' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e832c622-6957-5420-a9b3-7c50e3f8128f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Full Body' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2d864439-d931-51c1-8c0d-f9bb8db0fa1e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a1971fcc-6909-52e3-9bdf-5819db966224'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9801ce9a-6110-5101-a7c0-2790add8a701'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6b1a0446-0bd8-541f-8503-6100bd1f08a7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f3c57acb-e275-5e2c-a859-d3483d26af78'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = 'cccf8c53-5c8e-5fab-b63c-30c2cbceede5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2bda4def-641a-5cbd-a35d-d00cb69a489a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'f29b76d0-28b3-58b5-b5b6-0ca5db6c7133'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '94dcaaae-cb4a-51b7-bbbe-aa95cb781f98'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  category = case when category is null then 'Legs' else category end
where id = 'd1d858e2-5f54-588a-b0bf-4dae500bff07'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '2f2b9728-a11a-59f0-85ce-e06ee8c9467c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0ed9f895-b9de-5849-9dc0-6e76f0990511'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '14bca701-6223-54ae-87bc-9840dab82015'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd1ed6541-7032-5283-a626-0fb254cf6678'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'b2d1529b-821a-5518-85b5-12859611a240'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c6f6831a-82b1-5754-8e09-66066c32938d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '52d7a25f-87de-5c17-b9b9-f6e17cd0b858'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7ef5d270-d8c1-5dfe-bb02-83426cbe1b0a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e49bb9cc-9a20-52e3-8fda-2421132b22e4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2111c81d-8682-51f2-a828-79b576492cf1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '8aa0e0b5-518f-5232-8d21-9ed83370ede5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '42c1f674-a31f-5f8d-84d6-f8c76eec28cc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end
where id = 'c872d15d-c950-5cff-b350-347af2311d4a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '071d1648-a0f7-54ca-b55b-706c72283279'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f8f14d1d-e8e8-5ac4-bfb2-2100cf7711a0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'acdf1958-458e-5e94-8ec1-0f8e2f85ddce'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '47cf837f-de87-516e-b4ae-5e8b73f0fdc2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '90eb01c5-d2ff-566e-9e95-4036b45c685d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'lower back' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = '28156472-972e-5225-8599-8f8a76cb23e9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8811ea37-9629-5380-a9ed-7190b1cdbe43'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = '71272a7a-5342-5ba6-9087-97ac55a88600'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'fac3c7a3-b66b-5a92-a405-d2d219fea93f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '87c12d69-39f6-5052-8a79-e6164dccbffc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f13cf8ba-7537-5ccc-9b50-8223c593b2aa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3de2956a-c351-56d9-b578-db0541597bce'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'bc907e04-9378-50f7-926d-5eeb37a4b1f7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b718cbcb-6f25-53f0-87a4-ee79b5efbcff'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = 'd58e4fb3-57b4-5550-adfe-5f72d31ec5d2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6a16c6b7-0ff7-5852-826a-c6ebc0791940'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '3ee9ad7a-b7fb-5149-b34b-9c57f25fc4d9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f16d98d8-f530-5379-babe-0a27e1c19b7d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  category = case when category is null then 'Shoulders' else category end
where id = '5317b946-2e92-5aa5-abaa-7e9ac1f04ed3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2d1ca7c7-5447-5253-b347-727247c9e060'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd87a80b8-479a-5105-9a81-96dd66bc43e6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1c29d166-2a42-5908-b683-0329f49e73e5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '89328553-0230-5146-bf51-38d9f8691979'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '06279dde-6c20-5a1e-a988-6536c98f078e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0044d0c3-31b9-56b8-a41b-919977795383'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd8b8e306-0cca-5292-82d5-d2157a49a716'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Plyometrics' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '869f7e9e-d078-53c2-8bba-8e6115e115fb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '625c998c-df06-586b-8645-37ff416ee5ce'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '604e08f6-7bd8-5548-b0cb-0983e35917de'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '074787f7-00a1-5cfb-81ee-9e8553dfbcaf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fa9d20e8-1a82-5d75-81dd-e668e76096b3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = '15d48bbc-17f8-55cb-b5cc-1b2b60ee0605'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = 'cfa31b38-d3ab-582e-9836-d396eaf265e9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end
where id = '5e7e063c-ea45-52a7-8c03-d030fe85f60b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '98b5a2c6-eaef-5a90-96a2-9790f4593d85'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '8f36a336-d015-512d-b826-951677815be7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '4618152c-37ca-580c-aef3-bbbd6041dc27'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '815965b3-6297-5a3b-9136-42f8acd8cd23'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '2e3e5f84-d632-5021-b971-e5300a2b6811'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '12cf0a9b-b285-5926-8f73-7ab03927cc83'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b85493c5-7fb4-5aa6-bb0b-f014c0202384'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8bd07253-e52a-55b1-8ec8-c3d2ca559930'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0a1a52f5-850a-575a-832b-dd75e043dada'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e39f7c3d-d689-5eda-be99-acc52c332737'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end
where id = '89f719c4-6d52-5285-8b3b-e57b5a58e250'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end
where id = 'd2cd3b5a-52af-52d1-becf-7ff545054540'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '42296fce-7048-51ef-92f2-170c6ad282b2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '637cfd80-b12a-55ba-a1f4-011637f60bb6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '1e1f8c4d-dd9a-5ff2-9be1-e84ded7b63f9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '8ee1f5da-4873-5eef-b899-6fbb7105c166'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ccc7c617-da5c-5c64-a4be-31808f8e799c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd1d695c8-fc8e-5fb9-8202-147c49aba13b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f522301f-3794-5200-bd68-4eb7f3cfd4dc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '4767cc04-512c-5689-a520-c5e2637eadf8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'd0230a17-b907-5905-9369-5910920bb4f0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e6df5dcc-ebc7-56fd-80c6-6c0722e13eef'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '65bcb796-ed81-5282-a49e-ad4d20767628'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '99ec3376-c05e-5d3e-896a-5c26c53b2477'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '801d4060-1468-578d-9bfc-6d6c6d2879c1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5c607349-88ca-5b7a-acaf-b0693e94f796'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ff002b4a-164c-5c11-8bb0-3037e0763283'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f3155fe9-2c48-54ca-bf1b-484082aeff2e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1a5d2395-8465-528e-ad3f-8ebb3d163b14'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c30f08bb-f53d-55c7-b3f1-5c9c8a5f427c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2a3968de-f4c8-5ca8-8b8f-13f4473985c8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end
where id = '0f29bd52-07d6-5147-ad29-e3b225c99fb9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f2e96789-abc7-5f8f-a826-fca7008daca3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '67a0b38f-b2e4-5344-8b4c-4a0cb7a49d1d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a31df8e1-0889-5d30-a48d-091e5822182d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8a652eed-5160-555e-8131-c054a18afd79'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ae52488d-5a00-5780-847b-d220af16711d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ca8b739a-2157-5b29-96c6-761d1135a38f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'chest' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3a51c9db-41b6-5107-adbf-65bc6be80d1c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'lats' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'bbec23be-c1b3-5688-acaf-3a90021c6b12'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '78b917e0-fdcd-5f14-a04c-d68675c8dd84'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8652e3a8-2bfd-55c6-97cc-8693a292698a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e6332a20-2265-52b7-b649-77d2af4cd3c0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3b9b43ff-b035-5003-8bb9-694465afcff2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'c879b59a-06fb-53fd-babf-cf203fc4d332'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'b30ee60d-bea5-57ff-8850-7cf1ba657d79'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '1ff7b7b0-65c0-5d97-9cc3-a8a798dd9bd3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = 'a87ae404-6131-57f7-b470-094d16f2c4c4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '6e3b34ae-8dfb-5f45-9bdc-6aeb6747d9e8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '074bd896-6b83-52b7-a9de-08e65d8ca825'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '96fab38a-1110-5269-9287-ad0181d41495'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd1d5f135-f7fa-5826-9790-dc4199003088'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end
where id = '594e473b-893a-5799-9967-52fad5e26ae6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'a6290d1d-85de-5a91-8268-7aa6e676a7f2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '08fe8fda-7a20-5a4f-b485-49da060d2234'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'f2956377-a67d-5f4e-87d9-ba36aa16a597'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b4b1a19a-f3f6-53d8-afe8-78dce72c2f23'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = 'a933db59-473d-539c-b3e2-f6c92eb6e649'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5b47fa96-a6de-5a9e-a16b-5706031d85d1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5ee4c841-3b73-51a6-a985-f40b16cc2e23'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '50d4ab50-19e6-53e9-9325-498ba2dea60c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '43d94715-a1f3-5e20-950c-068e288350a7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '875b3d88-6f9c-5be5-a3aa-c43ee6f5008e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '50c19236-4694-5cee-ab30-b43b62d78664'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '672b3d4e-a03b-5dcb-b96a-48fdfa5a1dc8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f77805cc-f135-523c-9543-daf4b8872c2e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '87c268b8-ff8e-5c89-b4ac-3c50b66a3c3e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '06cd674a-5bac-5fb5-b26d-33fadde4554f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'dd030690-287d-5f3e-95b2-8f4bde13609b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'aea5365c-8e1f-5e89-802b-f47634c41bd6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2428c268-bdcb-5638-b5af-88e0bf9cbdb1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c304dad7-dcef-5fe8-99f7-eed4813afd31'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '13afd12b-f8fa-5f57-911f-e4b227c85ca2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f8464981-9c93-55e9-9f5e-c29b1857bd75'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a5389fa3-b5a0-5b5a-8cb3-c402181155fa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7f6ff55c-bf28-5597-851a-5fc701429339'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '778cf72e-8e89-546c-8ba1-1b67d2007ed8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end
where id = '43020c37-ee88-5c7c-bcb0-ee1da39aac5e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '84d804ca-3907-54b6-969e-37de3c7a7d00'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e4f87d28-3161-592a-9dca-728d8be359ab'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '222d5311-1bd0-57c6-b211-858b06336297'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0c0bcfd0-f4f9-5531-8f70-61fc82698afd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '9dac475d-3947-59a2-a6b3-fbb78dc7f593'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '9efe3c49-b159-5761-8dbf-11ca01c94464'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f18d0e69-faf0-579d-b689-e11df0ecb3d6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '7238999e-4a95-53c5-a39e-098f6c2407e7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '36565880-6b6b-5a3b-bb53-3858690fa492'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '831295db-9329-530f-9d29-92a99581af9d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1a1e2eac-dcb8-529e-ab52-b688807625a5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end
where id = 'fe654b87-6ad0-54a0-9808-5156f21469f2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7161ffaa-d7c4-52bf-abb6-e51ed7773288'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7615456f-0e6b-5c3b-b1fa-4dd357c66201'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9306cc13-2ff0-54ce-bd34-8571a5687c7d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '935e9c29-fba7-557a-8887-5a837e7f4acc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0569bae1-d6a2-5e9b-961e-ec0f1d6b48f3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '27fe61a5-f9d1-5642-8644-e689baded3e6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '782634ca-9c13-5306-a586-719b39a708b0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'db7e149c-f2bf-5b69-a1bf-395f52c57043'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5cdc994f-5852-500a-8c0a-97671bd603db'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '088fd94b-c7a6-558f-8525-3c518df8faf5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9d1873fd-97f0-5837-9c1a-9383ce9f13dc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'cf452e63-ac92-5003-b72b-c70aad368b42'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '75a83586-a737-5e52-bbab-4ecbcb0d2010'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '88d6ad4a-af9c-5118-b168-fb02513ba80d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5fa9b5b6-244a-5041-8860-dd6dd83d4fe1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'efa452e8-79f2-52ff-b55c-a7a9388bb0e3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3964d1f2-1c4f-51cd-9b02-61d4ccce33ec'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9d42da84-1757-59a2-b41a-b9c8de4251c0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8215faba-59d1-5f61-bbce-32ec21936a69'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b4d8d889-a3b2-5eed-838d-4c109ed01c2e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '82303c9d-bb6e-541d-9927-9dc69b9759f6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '463932ff-5ea0-5dcb-8795-0109500027d3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd972b411-bbe7-55fb-9609-59227792ca5f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7eaa8c0b-2af9-5b3e-9475-cd0b105dfc44'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'bb79201f-8aeb-5937-8447-a560cab9b322'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '27b42e95-9bfd-5673-8366-dcb0f7770ccf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9c0c1671-65c7-5b45-96cf-e48114b1655c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7d0b670a-86a5-5b71-886a-f23a2482bd52'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '18fb3f84-a96e-5a6d-9c19-9d560c5a5ca0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '21f7b5f4-d23d-5919-91d9-bda89c10ef73'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a049dabf-8a72-50bc-b9dc-9fe7613405dd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '04cfc7c5-5539-5e83-806d-d878d2cb00d9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abductors' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '4c70e71a-a861-5a82-89ce-477f7e9e916d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a46b42c0-f49d-5ad2-b56d-690c8e058f80'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ea736df7-0251-5077-a64c-b26fcb11b575'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4a58617c-9fce-5719-ba2a-057af8c2e723'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5c215488-3546-5101-bae1-76bdcedb2f21'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '03049ac6-8243-59be-bf64-72ec846999d1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4a7c40d3-5877-5920-92c9-257cc5947800'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'cc068b8f-b346-5981-9cd4-b29444fd4bf5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c1063014-9552-5cf3-ad76-f9d80ac29807'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fe5118c0-fec4-57ca-b094-f53f351a5435'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cf5dffc6-c57f-5410-be23-bb2592d4a480'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '41ce03f4-75e7-5f39-b9a3-98249885bbeb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e6b2c691-4660-579a-9b0d-8e7a23c86b37'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '95b25c51-396e-503d-a31b-46821a5ac75c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e2ca6fc8-2637-5a13-84b1-2ddb7ecd2cd2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '19c49baf-5ad0-5956-9a1a-c823ecf984b4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'dd70c340-9a28-5bee-a392-25605ce759be'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '7bc82fe6-d269-591b-aa64-059489684491'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f9a3dca7-b248-532b-b854-ab5426931bbc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd2c820a3-98b5-5266-bbe3-3211c9da2bbd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5330dd99-9107-59f6-95d1-711092806a5f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '06dabe12-96ef-5844-be62-c60a1383becd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd1c030e0-5d69-5eb5-856f-17a310a46897'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a1be494f-5893-500f-b099-36999b86a0ce'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '29bea93d-486d-5133-b7ec-b9b0ba1d67aa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd3b5f93b-a351-5810-93f9-50e1ac1f464d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2aff38d3-db7d-592d-8c3e-41486c916c99'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a2dddbbc-3aae-5d7a-b27f-c55366138ed0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'eea7e36a-706a-51f5-8684-24127c3f0941'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '7797001f-7802-5101-8f92-a9a8d797cf2f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'bd77bdb7-65e8-597c-9bc8-dbaaeaecbe1b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '6c6000da-8122-582e-b27e-f00be1849237'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6edece82-84f9-56b4-b4ca-972921c360cd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6befe7e7-7b51-5c7d-a054-b495fcd29e66'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b2a9b3ed-e088-55c3-855a-2bd3fbc4857c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ddb4ef33-a8b1-59c6-9ea7-c4d9e7782318'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e75bb8b9-bffd-52e5-b1a4-7a8fdf33cd76'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c867264e-095a-5db0-8af5-11abe73771df'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8f23a97d-ff92-59a0-a128-fb8cb1e8d5fd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8184516d-3e3a-5109-93f5-26cfe5107f11'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cf188e3d-364a-5020-a4de-38361ad96ced'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'd831b261-b8a2-51c4-84eb-a0d513ce019d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '73288f9e-e1b7-53d3-a290-00cd476c495d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '68d19e9b-7bff-5371-a8c9-1fd0dc86e8a3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '286189a4-0ff5-539f-88c1-86287b8b7633'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6f7a76f6-0788-522b-b73d-1b6d1d57178e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '43b119a1-179a-520b-884b-4452fcf935b3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6643da1e-280c-57ac-a6f3-f039d9cbbb58'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '59042edd-ae1b-5421-9754-6b7e160f0f88'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '57f8b6ad-a77f-5829-9dbd-617efe46fb14'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a51b06cd-a64e-5818-a63c-fcad28ba9d77'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2d216a2d-9bbb-5ec9-9ced-af4c962846f0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '826a3cfa-7f7e-573b-922c-498aa70cb662'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7ca3de8b-b2e3-5d88-8a49-f44797e81e75'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'dab6c91f-f07f-5d9b-9455-b941b1e1ff1a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'medicine ball' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7c62d61c-9a67-5e1b-beb4-345c2d161988'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3b181ccd-738d-50ce-98ce-31cc03af70c9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '6453b390-f740-5ef8-aedc-782b02ea0431'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '5da1768d-2754-5a05-831e-5a591c427ec8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'af868382-122d-5764-96e3-3e00b22743cc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '81fcdf84-83b5-5f21-98d3-06b023474ebc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'df0ea4ea-2c4f-5280-be0f-0cd94576e3f9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = '016ef9ee-b8f1-562a-98b7-b6a94e9a0696'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd6e05001-36e7-5028-8ced-2fc6776a720a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd957516c-10f1-571e-9583-2a1ec8082892'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'e367904e-985d-5662-a2a9-bf6a581e22c7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'fe571bcc-db9e-562e-8a7c-009e616250bf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5f0eae6f-7ff6-5f95-85f9-e40dad657438'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '68d0d778-3cdd-5bb4-8d39-a0e76ce2193f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e3da3d7b-9cc5-508c-a92f-33696b537488'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'dadb181a-ace7-5a78-b066-fd43a6dcd676'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '1d42ba1e-d374-5ce3-b89e-0267f858baa8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '25f96abd-3469-50c1-a175-5cad3a642155'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'b5e33597-799b-595a-a2c8-a1e6c95afa3c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '58eed9b4-5656-5e79-8227-83b401ba2ed2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '9970ddfc-f1f2-5be8-9e40-20b48fb23f56'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '566a8b1d-0ffa-5401-80c4-cf9545d065b4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7cab291b-3664-5024-a0b7-e0d1ac834f88'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '61d2580d-0b55-53e8-b8ab-a8adfa1156bc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '57ecd8fe-af1d-58f3-ad39-2c515b8a7f82'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f4187224-d17a-5a39-b887-924a071b1224'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'ed57d830-610a-59dc-96ad-0a0a11e7fb1a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '146f6bc8-de52-5af3-ada6-d090d80f29ab'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '150fa3a9-7b73-579c-a964-b9bd11161f3d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'c352421d-723a-5a81-b0d5-d8e95dd45b56'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '088511a7-e781-5d21-80c3-39249af731d2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '60f8d03d-091f-5c54-84eb-e519a76d7df6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fa94927f-7546-57f5-8e6c-77af13d52feb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'neck' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'neck' else target_muscle end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fb67e3e3-3632-5b60-8d0b-b25577445b76'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'neck' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'neck' else target_muscle end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3b618d1d-3511-5115-8c6d-783025bcdead'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'neck' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'neck' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '0cc45cde-f567-50c0-8a6b-7eeb36792d3b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c57a35a2-7c50-5b21-8a10-7439bd679bdf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3d7170c0-5ad9-560a-bc5c-840cd8ed416c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f50d280f-8ef4-5340-8149-d1c262a44723'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a441c929-5d25-5a33-b853-5364bbbc390a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0cfd92b2-229e-508e-b2d5-0846b8b61a23'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8467c96a-ff82-5360-a102-2d3fcfd11731'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Plyometrics' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f6383bb1-cea4-5d59-95ab-93dd0358adc0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5026c9b0-8edb-5804-95ee-743810033246'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '504df5c4-4c70-5177-bb66-a764a8d6f0d4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '54ff6ad8-fe25-5fb5-93fb-62f6caca6d6f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cbd25938-83dc-5fd8-87ac-4bd3d1ff5e89'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0bfe52d9-fd65-5dbd-96f8-40335e2143d7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c864d42e-4933-52f1-bf6f-f4f5cf5513c9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'e261cca8-089d-5345-ae16-e41ee1961aac'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3d6cc69a-fbaf-5225-a817-7df35bd251c4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '537c5746-6261-5141-b587-d00af0f68c7b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '30b3fd18-6fea-5fe9-b93e-abe5e6d73387'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd0d9efca-b0fc-55d2-9e15-b5e0fac0a286'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bc90496d-a058-552a-92dc-7d48da68d127'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c61c31e5-8b98-5a8c-ba92-94a7bc154caf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3cf543c9-223a-5331-83f5-b1398c2788cc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd33ae257-26ad-5893-85fe-2719e53a0eed'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '243aa6b5-5f1b-55c2-bd94-d0bca4756093'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9e91245c-8541-5948-bc9e-8e7ef3415568'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end
where id = '81eda247-d665-506f-afb6-9deb6847e327'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '410ffa2a-524d-5c4b-bbaf-0fc5e2e79cd6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '3ae117e9-61e4-5bc3-81eb-67b5389f26b6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'c1aee283-1b36-564b-9dc5-8d6a48c1c41b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '351fabef-76bd-513f-b773-31d458a8956b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '068c7231-3262-5aeb-8247-e0ff161ef8a9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '527f8dd8-a51b-51a5-bf89-756e1453b00d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'feadcdbd-3992-5803-a5f4-01ca5af66666'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '10dbde24-6abb-518d-b698-8acce6dae9d7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '900fb51c-5317-57d9-9186-09961c491619'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9e539e27-e886-5164-94a4-406a63f117df'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '03f6ede4-d3e3-5fb2-8dc1-caf9742983ac'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = 'daf48347-0612-54f4-91c7-c531a9e0442e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c431f55e-030b-5b82-907f-47ee81addc3d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '555d30f0-710c-5df1-b8d9-07a399f1b6ac'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '560712a0-1db4-5fe0-81d4-1875db25faab'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0add820c-fca4-5416-ab41-27148911756b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '307659b8-94bf-5432-9da6-bd9a7f7968dd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a59347ac-d7aa-5401-9b66-ba6aa2f6ccba'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'e61bca88-be6c-5f25-a817-bc5f182392f6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'kettlebell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end
where id = '9f5eea8b-205e-5455-a984-cc3e9e3fadaa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '520208a5-2022-53fb-b2c5-bb1053ff198d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ea52a50b-d65a-50b9-a48e-92f4a9d450ff'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '76418efc-6f03-55af-9ae3-9119d7d9310c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'affb396a-6f6c-5516-93a8-b48c3cade0c9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '6765fff2-6700-52bc-8269-d65719bf8613'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4826affa-8e3b-5f72-9120-88f38f47e479'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9f45c9fc-a0f3-5ec8-926b-f474ebb6a716'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c4740508-fa74-5595-b959-24f87cce70be'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2e2044ad-8d53-58b5-b2b0-dd5008b1d06c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8febe5ad-d903-51bd-a1af-b706f55615d4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'af0f5c87-3d8d-5127-9202-c248d6accde6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2ed19f11-7725-5f98-a06d-c59ec1db335d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e098e9a6-c16d-5ec6-be6c-19d2e0dd4913'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '88cfbfaf-c908-5b44-8ef7-2477ca3ce44b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '32cf4216-f04a-5e3f-a1c4-21d0f7b3af4f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'fd7e7b4a-f6db-5188-a74c-d19fa42f9983'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1ae08284-38a9-5d23-b274-e181868c77fc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '98e03cca-d2a6-5417-b4f2-f547373c6abf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3aa2f71f-ef03-5d99-8d4e-5d1dfbbc20ce'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '13e8afc1-065c-5efc-89c2-a7a4a2a374fc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6e500d55-ba91-5cf6-8fdb-0909fc1bdaed'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ffb7f41d-f340-5a43-b69b-19fc940ca453'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3468ae5c-c390-5e62-a0cc-910e0e90243f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end
where id = '7890b37a-192c-531f-b919-e8a19385fce1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '5ddf5bcb-f37b-5aa0-b6e8-dd5ba676cddf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'c4f9e00b-d4e4-5073-806d-4f74a9937c0f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '17f3773b-c819-5eca-97ec-4696a3b29fa6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7d93ac5c-3d18-51e6-a447-e1ec48c9d855'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fb697f6f-168d-5a0d-8b5b-a290d95c1a89'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '4565ff3b-574e-5800-8cbe-c1e62e250a2e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = '02b8edc3-efed-5c21-b3f8-7e481597a045'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end
where id = '1634dac1-3808-5304-802c-e2c3b0cd10ff'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'be14de17-e01b-55fa-a748-2600009bc590'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a496dcbf-81e0-5acc-a959-4db9db2b31e1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'forearms' else body_part end
where id = '839f6a7a-c9bb-547b-9347-71a9161f06f4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '10607fc7-85bd-5b01-85b5-7d0599d84772'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'ea6e69f6-d1b3-5beb-bb7e-97909b91ef11'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2cac2539-8ff5-5b7e-a141-38c3a325be35'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'd6bf4dda-b4e1-50ea-a68b-665b7a747695'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '3f5a5076-3cec-540c-9314-c2edae6c915b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e347b983-acb9-549a-b92f-04c64748af14'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '4c43d4a2-3d69-52a4-8d97-f439e384a7b2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd0061ed5-4fe4-5df0-9305-43916d10b1b6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '91a8c551-01fb-5cd9-bae9-04079a6fa83e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'kettlebell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '397894af-23e0-53f9-9019-ac9213af66e4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '32c8843b-1ba2-5b21-be89-aa7a27dae2c8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5559f5f6-0d1d-52bc-a9c3-5daca2a16997'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6b867bc6-c83f-5b44-91bb-1e2ad6ee9037'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '62fb80c3-6a4f-5915-986f-94a75e246cd7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c585d6d1-deba-5f33-bd16-9dab3bcd93fa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '512bb387-3f8f-5a8b-9e7d-8b4f5417dfa9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0edc80e8-350e-53f6-bb72-e606e24da751'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2a06c645-229b-521f-8556-bea3cb45ce10'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bf769ca0-5672-5660-8922-48be15d2f18b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2c2473ff-fc50-5296-8db3-4d69fa3fcd77'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'cb4f035c-32ab-51fb-99a4-978823cb647b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '0bb7a1d5-2051-5495-a9ce-0b3172620549'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '393097a5-e6d1-5d6d-91c0-3152353390ce'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Plyometrics' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '64660e94-2f5b-5c21-8f7b-847cbafc87b9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end
where id = '83b4cf4f-32e2-5320-b641-b7fb8c8380e9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '349005aa-398a-5138-a2c2-77ff278a3e6d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8fb0bf19-b500-585f-aa33-b198934ee466'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b13ba2ae-86f6-512a-b7a3-5adf67bf97b7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'cd377a4f-941c-5212-928d-6e9694e9194e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '751286b2-371e-5269-bda0-fc8cc2a93302'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd3f3d0bf-8058-5e7f-8dd9-ebb34c28a983'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'f5100018-c0ea-59d5-8d22-f2591b7aef8f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '8a83f7e7-c082-540b-a00f-1aaae8627a19'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '02843960-a782-5e13-9fa4-b576b9284926'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '90870ad5-250e-5811-81a5-f9a19647a758'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'fc0c58be-113f-55d9-b3fd-d68b00831b3c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'c3931a8e-7c25-5341-92e3-c2769e05b4a1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '00acfddf-9f11-59fd-aa04-1da4ca878202'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f6d642ea-a04a-5a7a-a381-e269ba12106a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6cd4d175-6dae-535f-8f4f-2623c0260037'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c68eb8ee-dcc3-568c-92cc-06d4bdc4ab8c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ae733ece-b792-58ad-aa04-5916ea42db65'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e53d8737-f3e9-5d3b-a5fa-b5b709b7b1be'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e216f2e6-6a78-5801-b7b6-176253966a73'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '75268476-61ba-5f32-a841-a089da92e387'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5ad0b748-0d47-51f8-81a3-804492228dfa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '19495190-a632-53fe-a7e7-0029b79e23c9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'af761024-cbed-5c05-976c-f6ebb503ce1c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '9467947b-cf4b-55cf-9796-3ae184c1ee7b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5c71fd25-0eb1-5791-b3ae-a2649d7e08be'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end
where id = '0ea8a61d-e8a4-53bc-b4da-51e43e017345'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cc149830-e12c-5f6c-9dfb-d2483ad218c5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c130c5e3-174d-5bbc-ad1d-68ba149f8598'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'bd1631ba-c581-55f4-ac66-0cdf62cb4a28'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6a9763e8-f8f2-54ce-a5e7-c051404899cf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end
where id = 'dc278677-aac2-52f6-abf5-116fcb28c2a3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '17468fe2-d5d6-5479-b038-3787ee552f89'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '86937480-c8f4-52f1-9785-4c92d63af748'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'eb577041-a8cb-5ef3-aec1-dcb0bec092ee'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6de10430-4e4f-5ca8-abd6-624661814a2d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e4517430-a5ba-5de8-88b0-b4a4fe03c1eb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3b9b071f-051e-5470-b153-45ba77a74633'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '7a11d42e-89c1-5527-bb11-93002471a8f7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '4038857b-0c5d-5a8a-89f6-515cbb390dfd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '1ee75b1d-b088-5a1a-a318-0f788a8e8719'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '1334a796-8550-58d6-9a7d-039a900b9ced'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '0a8a7b52-5988-51aa-9a4d-a39a134d2d81'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'f74e9a62-0649-59c9-832f-f9145901366a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '7b9168f1-428d-55dd-84b1-0d792a6ab085'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '039602d1-3a80-5365-87e2-8ead0cba88a6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '769d4ee1-31e5-5f0c-8ea1-d374e8c207b3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '3fca807f-88ab-5f52-8597-deca6ae91650'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7582a32a-31d6-5eb0-9ad4-85f2184b7f1d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '1b2a2ea1-3c00-5f6c-82d8-386cf3515779'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '924c42d6-f0e0-5efb-953e-0d6ce6bcda6f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '928b46e3-7047-5f1d-804b-256768c34a5f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '9d006bb6-5180-576e-8388-c42d73020bfb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '5cb43f5f-df9d-5b77-b814-77651a9004ab'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '1348a206-5f4e-5b42-bd0d-1b7e32a88db6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'bf8c31eb-f85f-56f6-83f8-a0b63a77204c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '14a466c8-e6c6-5adc-a51e-072b101446eb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '47bf7bfc-ad68-54c6-8e8f-2cb21b4c345d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c188f41c-7dcd-53d3-9b46-27b16e2d2f59'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'dc71e275-5b52-562e-adde-24aa59b35c05'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abductors' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '1a79aa8e-d2c3-5dbe-a1f2-373d5623cec8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '56585449-b7b0-51bc-9557-64db1427e14a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd11d1f42-0d31-5a48-829a-b0cfb7be3ce4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '55e7d2db-2bc3-53e9-aa50-967393b1e842'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9c0e0991-2395-5c84-9d27-676aec647cb4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'ebabc79c-4f49-51cf-b266-7ac82d4464e8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '51143c3d-0d70-5640-8888-1b1de64d28bd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'smith machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '57aa8332-c766-5924-baf0-65ad90f93f52'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = 'f91c3db1-effc-578b-9fef-5cac2f2419b0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '781afef4-8bcd-5f57-bb6d-dd2e2193992d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = 'e95c0c75-66fc-5cc6-96a5-8d1de593639b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0d94d875-bcaf-5650-aeab-6619ae5d75f3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8451c7e7-c92b-50ee-9893-3a8122baafa2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e81ed486-00a9-5f2d-8434-a9513a7439b1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '691ba7d5-e831-5977-9e97-33ccb129ce35'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'b585cb00-e0c6-5792-a9a4-875f8e403ac2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c9cbf9ac-d7a8-56de-8697-a66d86d877f2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '4a6ea29e-208b-573f-a424-3eb7f0852a45'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4d3472e9-72f7-5663-b39c-77b000ed8e9a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cf968632-332c-5654-8104-534d520bfebd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '916e4e09-3d94-5373-b6e8-926dcaaeee63'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cf961ee0-d204-50f4-b3a3-ac91e5fb56d4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'eddd546f-d9cb-5076-ab55-f965785e9239'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = '54a867b9-8620-540b-8a55-3b4b3b8aee4f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '70c3b188-7124-5ea0-9192-2e46723ad0cb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c1c42b63-2e73-5bef-b63c-5c26e19e7a4b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '4d23b1b8-f6b5-5eac-8e48-11ad46ca923d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4abf8d16-5bcb-585b-9338-8b52d895a7ea'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3ca9db24-1394-5a00-895b-e0acff5fe5c5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5dd9be85-f7c1-5e44-bf7b-a6af8a4b504c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c93fca5e-c7bd-5e75-ac85-4884fe629b3d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7a4bc1e9-fb09-5ea1-b7b8-8f715372ca4a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '17a1538e-2f9f-5a5b-96ca-e338360bf11c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '820f1e23-854b-571a-a90c-51266be7b1ca'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '47255c56-41a6-5a6d-8410-2b9aaef82add'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a9395709-a119-563f-99d3-a3e8dcf574cd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd1b3e150-84e7-5bbf-89c6-7505a6986503'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'EZ bar' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end
where id = '371e6daa-dab6-59aa-8b7d-35e884e5721b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1fff7881-4cbd-5c3d-ae94-c922d5764d65'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'db594e2c-a49d-5bdc-b95d-677571b4147c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c7e7083b-5196-5bff-bc3f-a18be4eb5547'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '969c8895-9562-5b35-9f89-86fa7016e3ab'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '83d8248f-950a-58c5-b17b-1e5ffd5d91db'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '710e5bce-daec-570e-8437-c42f9bef3f97'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f9bcf80b-f321-579a-ab7c-18a095bd9427'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '82d207e3-6354-51a7-82c0-7f9d5e6b00be'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '8a40384c-2790-57b1-b4f9-f66451dad184'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'f92b7fe6-2c31-52c5-8ec3-cd56a94dcf8e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '85c3873f-e0e8-5857-9b86-9e9a34b0a2b3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e3918ecd-8086-58e7-bf88-20589cf3d4b8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c8d3eb85-ebf5-51bf-b327-4927e4fa9bfe'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '517caa75-19a4-570c-a5e1-1927cbc9fa30'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end
where id = 'b0732129-a209-5834-9703-03dd9202027c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1a250e70-af16-58e9-8842-af0a74e3439b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '367a4e6f-0d4f-58e6-80f4-1af7ed3b5c04'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e853e812-a3df-525d-a2a6-5637390e55e4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '46cf5a0e-47d1-5b61-ae62-4f5c4fb957a4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c38467b0-e296-56c2-8433-1e4d62d90486'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a50ed464-2767-5bb7-b638-44095a811be7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '35013b1c-c9ea-5d0c-98f2-6e6f6b0cf0a3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '93b3eaf1-03ea-581a-8b93-39af9048cb20'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '69d549a7-4e16-58ba-b8b9-098100333dd7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f6aee7c9-8b27-542b-b2ac-ddc91bb6112e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f2af1b02-ff59-5dde-b2e9-d50d52a62a74'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = 'c144eeb8-f9f8-583b-86dc-8200153c0282'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'e99af593-53cc-5590-bc51-5ed20d44d3ee'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '98cb67ee-67b6-5312-b6aa-4423a6645375'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'dfbcc2af-68c7-57be-ad0b-85f754140a8e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b22d2f12-9bf0-5351-9704-169c8f40874b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'eac48f7e-5ed2-5713-8438-847ef5aaf4c9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '088b9b7b-96a6-5df1-af35-2796b3bfb7b1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fd7d4a8c-7fdb-5baf-85fe-947cdff9d4b7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd0b6d543-0bca-5fc7-98de-930350477e83'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ea5637f0-6696-5d57-90f4-1ec2318f8a6e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '68b3ef5a-13e1-5083-9391-d8468ca598a5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6839798e-1852-5f7b-9bfc-4447aec83082'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '3a125710-7708-5cdf-9c71-c38894af94fc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f7bb162c-e29c-5a93-87ab-63b0f66eca51'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '539564e0-f6be-52f2-91cc-4186071190d8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '3498c0da-6fd4-5abb-856f-d5609099478b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f339918b-c38a-543c-a621-b5c3f267258b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd17dff9e-2b67-52ea-8e44-f9e03baeaeaf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'e21b45eb-2d38-5405-bca1-b0b7a9d3e591'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '284d5244-5831-5e42-b6ce-8d5f0e810ce2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '7ea99273-07b5-51ae-8391-a58926600699'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8c22550e-7dce-54f3-869f-7dc52312155b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '55f99b98-08ff-5462-b6ba-99f9c8a32634'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end
where id = 'ed7e4c02-2379-53c9-ae5d-6f7e1bf20b9e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b8ce45df-f24b-5793-875b-c396570a1c70'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ad70e228-91e0-53cb-99b3-a96503e53178'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '885a47b8-3693-56ee-925e-5cafc1295a03'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd3576fad-9c36-5c99-bfa9-5624f4f1b356'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '22d3853e-d27c-5c0f-86e0-65c923c24fdc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f29e0f20-2bcd-5673-9744-7acae2e308d8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1178ce52-b57f-529e-bf5e-da49ccf4efba'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '080b471f-baae-5010-a012-ae184f70d5dd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7414da95-4a69-5696-863f-613e5cb98934'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '51c30c3e-1269-543e-8fc6-b4c7e611937e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2f585103-4fdd-5b1f-9988-44f5ed26e52d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5074a26d-6482-57c3-887d-af69786b3fca'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '92f4ad34-ae5f-546a-809a-c63466285dcb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '59d2f61a-c326-5a77-9cd6-44f241581154'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f93a8fab-a890-589a-947a-e6613c3c064a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '353e5f1b-628c-55e2-ba58-36d15a0a042d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '329fbe79-5535-5d59-b431-441d54b8d67a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '71ea7bc4-5468-5239-b187-2e57c3195f4c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'e1e9b784-cceb-5d34-808c-3ad35651c999'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = '9a0ac10b-654b-597c-81bf-7ca0568f2baa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = '11792913-21d6-5ff9-90a0-617f71cdd4e9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '8a399c2d-aa35-5f2e-97c2-62ef6bed012f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '61c7a686-64fe-5e18-a218-3fa643a8c486'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'baf4457a-6525-5561-a5f5-87463e8cecdc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '20fc4dc9-c57a-5deb-87b0-a77d51257468'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4023abae-f79f-53b2-a901-b8c5fcde1e75'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '29e01cae-43e4-5e53-a022-8ba197e349ba'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = 'e98fecc9-4724-5581-9346-56b1806ef161'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '0b1960cd-1cef-5156-9aa4-44c3a3785cdb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'lower back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f0a5658c-2241-52a7-a5a3-e9b3fa1c00ce'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'acbd54a1-064b-5ea3-8e2d-61a94116202e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '822674a9-c0ca-53a6-a057-9ebaa118c321'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2e1fc184-3c1c-5eaa-acfe-f098350a0412'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c84164ab-d602-5582-b5db-87f2620b23da'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '92b063cf-921d-58db-8262-7cc66189ff53'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1fe70f94-eeb7-52af-a96f-e1d3c0db0bc0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7a8a2dde-0e2b-51a9-9cf2-c4ac524e9a30'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '00169b00-b1d3-5dbd-b9b9-5cf77317e900'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '05ed58cd-6f9e-56a2-a1cf-777afd6c2bf8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9b7972a9-5845-5053-a863-f1ce5a6ce8ca'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '980813a3-ee0e-521d-a94c-3bd45b9f4406'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '495a355c-31e7-564e-bd79-29685cfcdb8f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '38d5edd6-0aee-5d3c-8cc3-c9dc9f976f3d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f978fe5f-7906-52dc-972a-4c43bf514727'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0ee91048-05f3-5826-a6ef-313600788a87'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2cbfc125-ef09-5ef9-a56d-7788cb579768'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end
where id = '215ed785-6204-51a4-872f-6c142f8ff8ff'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '695639dd-28a0-55aa-b21e-67390719c983'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b31cfbb0-1ec2-55fd-8105-7666ce407fb0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7261f103-8722-5c5f-ac5f-bee1f763d165'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '212f0a7f-6db3-52d0-a4be-37891c170211'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '74b7a18f-87be-5443-8c8a-68b47a2fe7bd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6be69ca2-5efb-5f28-bc0d-ae083b246f9c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '1b0875b7-7ef9-52fb-9a92-3e30eaf1ca45'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'ca0b1356-10da-54b5-9c5e-aa05641efec3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '196e3d19-8ea9-5d61-89db-8df07d918b75'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '739178f4-e45a-5bb0-a834-037270d68cc8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abductors' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '53897f52-2a69-5b08-8c62-72fe7d2165b8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'leverage machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'adductors' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'e4db62bc-cdc8-51b8-98b8-927cc67e3fa5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7aec7eb7-32b2-5f72-869e-595133479454'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cce80820-5bb3-5f07-87bc-c3f1aae31d97'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '39d2aebf-33af-5986-acfa-3219d6187168'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'b200839f-fca5-55d5-9ebf-41949f1a2157'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd5e6b034-b126-5ca9-aa2f-9a10c5fb75bf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'fd6f0189-919b-5eef-a3e5-0b3384e4f1dd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '32874e45-12d7-5338-b454-783359f0ec0a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cce668c6-cb31-51ff-9f9b-158d2bb5cdec'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e166d809-cfee-59eb-906e-40b8834613fe'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f6d8dcb9-041b-5adc-8f7b-423a39b8ee2d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cf43ce24-aeda-5059-81b9-2046330d4c59'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'de3a7027-1801-556c-9189-b3d1691480f0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '014c6a0d-03c4-5eed-af2c-d4e85919f3e7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'b041f40a-2191-51c8-b1e0-32030b9bc255'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '20da77fc-efed-5890-af99-a6862a2a08a1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c0d34da4-5487-5a05-9243-70f7ce9f1de7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0a2d45b9-021a-5492-a7f1-0ddd1d84836c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bf9ef722-c10b-5eb1-82e7-5368eae6228c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '853c2cac-df34-5bdd-b9e3-d7cb5cbdb3ca'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e8db1b2a-0fde-52c0-b749-51cc35c82820'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5648db5d-96c1-55bf-b907-a766b71fef0f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1a958f0d-ef5d-5695-ace3-09babc60d629'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '4a3177cc-9908-5c8d-9e05-239c8b1cdfad'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'acab7189-2eb4-5102-9d9d-ca8e0bb2ad08'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fadecd33-ed66-5e1b-a9b8-bde2368bb99f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '79e3edcf-e232-5db4-a96b-c33dbc58de08'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8f568dbe-3a64-5948-a1c8-c7b0a0b0b43c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ac9732b9-c894-57fd-b044-da39426f3105'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bdc763e9-5d0b-57c6-9238-f0b87b7bbf3a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c71c55de-443d-5fee-9dcb-3d76f25c81b8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '33f081c1-e42e-5e78-a0b5-c3574b30c391'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '7389bccf-42ad-58aa-a055-c88ecd3eabe1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = '7b02e73b-79ab-5678-ab93-24330de20ad0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = '18c601e4-0922-5a92-a36c-d173778e86f4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = '916b733c-6d9c-51b3-8dca-1d610642ad95'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'a63c1996-41b2-5435-ac0e-08e2927fe5be'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0b3c82e9-efda-5466-8c11-b59c6d4bbb93'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = '85101330-8c8d-5a56-8a08-2d4899ae33e9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6f27a625-5ec8-5e68-93f2-e068efb4a8bb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2bb8ea3c-c8b9-59de-b4de-d9aaf5964f4a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ad1791db-ae5e-5d67-bfb3-8c3f56929fcb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '340ac014-6863-53bf-a3a2-08451537d71c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8df001f5-e07a-501a-8c10-cbae4bd860ed'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4d68d59b-4620-5fd5-ba55-067bfd6cee62'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'afe33503-d721-5c45-a443-d697929761ae'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '9cb7cc98-fde7-5787-aa60-e2b7f9e1c108'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '873d1c9b-88cd-5d80-b0e0-5a7e042783ed'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '74a1747d-dd27-5a8a-9cb5-b8f076fbeb7b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = '02ffcb2e-b8a7-5d8e-831d-4bd8b0741f84'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c4cf99c0-efde-5258-80ce-1bc88673522f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = '46ce7a83-100c-58c5-8757-258dc45ff864'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = '9f2d018f-502c-5e26-baa9-8fa9a368fdd7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = 'e23744dd-186d-5b2a-83f2-0ed4ff362020'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '24da7414-0285-5001-8207-d53c03689735'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end
where id = '2575d50a-e90c-5533-8f56-8aae67b65deb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = 'e744e941-e142-5556-8baa-4b5f5017d980'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'a2d86796-34f1-583a-a3d9-4c7810eb0bdf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3dd3f6f7-791c-5bbf-95ea-a06cf95755b6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end
where id = 'f1f8f71d-9059-5e0e-9e8b-b4143227a7bc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '355f0c53-ae10-5797-8710-21af6656b019'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '466b98ce-5d7b-53ad-ad6d-3b246adfae39'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '12ad44e5-8f2e-56ec-80f4-aae0e3335e76'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ee924264-979c-543f-8103-61480e84bdf5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9d304301-5d5d-5c3d-af79-ccf7eeaa1e6e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd021a05f-cfcc-5c2d-b7eb-788fa5d5b3d6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '436bbc7d-ca42-581a-afd4-def35a6e8fd2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'shoulders' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f128b1dd-7805-5ac2-972a-ff652d46e20e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0a400d8d-5642-5629-8d6b-4c308a85abf5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '07f810d7-3e0f-57b4-ab4a-3adf99017a7b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '46174972-04ba-57b3-be66-69e3b0d01867'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abductors' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '191186ed-3e3a-5009-9488-4f34f1ceae6c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7ced3680-233c-584e-8c10-bd8dd8260465'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0c010bfc-3962-537d-b9b3-2f8c8d573105'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3323b257-1953-5558-b613-a7e7fc10ec59'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '38774ec3-2a8f-56ff-b01c-94d089486004'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '30867c87-4e01-522c-b902-234c2be02436'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '0c1adf1b-1458-5605-ad05-8f7d312c0ad0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '479a12a9-3c4b-536f-8036-398bbbb3e9a5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '20d8c434-8a29-52b8-8ea6-71b0d93a8736'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'c36580a7-766f-588e-ad6b-72b1afe2d42f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3e6b7c52-c861-54b6-9d8a-1a008010293c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3613a31a-62f7-5706-b353-87b2e76a16bf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'eba05d7c-5d6b-5a54-bdf4-3fe46c43c459'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '32f63940-126d-51dc-95e4-38e408337a84'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b6a88a8d-d3d2-5d63-b790-52b5a285b4ac'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '48597b70-5515-53c1-9070-10f8a8fb5448'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '61b19a7c-879d-5039-ad01-f29497eb5558'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '4de9babd-44e0-5952-86b0-d3a8d81892c0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0d155026-c329-52c8-8939-acc5a698f42d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '634b9392-718f-523e-867f-89dbba5362e6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '6f8f4c12-9ca3-530f-965c-320aec1b0932'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2faa2eae-10f7-5db6-afbe-a1940b6805cd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4e39fa54-52e9-5119-b313-9d895c7f56f4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '1cc050df-b0a5-5daf-94ca-e300740a90e6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'kettlebell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '69faf21b-2880-5d95-b5e6-f9d0a308ce46'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f5425d7b-70c1-59ce-a2ca-8b56514247bb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'adc513c5-0968-5fac-b235-f587370b5093'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '9ac53c8f-f4f6-5f44-a49b-c79bd9b0e7b1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '64181504-3181-5815-a560-7cf635a5478e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = 'f9d90315-9c9b-5609-8254-87d9fbe909dd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8e523bb3-cecd-5290-a960-f32ebe5f6580'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '2af32d79-653d-5fc4-a7e3-1be87d3b1380'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1d50afbe-11f8-513b-a99c-ad0f228c678c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '339400ae-b5e1-52af-9541-0c9471ef21d9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5ae688b3-4116-5621-a10d-5ccc0eb6f744'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1b125548-cae8-59fe-95d5-41a6b8c5bda0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '6cf00a3a-1ba2-5725-b25b-679e89335327'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2f110b23-3ee1-51dc-a1c7-8888984046fb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '1397d839-7f07-594f-93e0-7aeb572cc715'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6195fd4e-8a6d-5111-908c-1acb7ae99f3b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f2ab1c2e-444f-5e52-b597-8be9034bdd48'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '278ab164-235a-5b6b-b97d-795626dadb3e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6d43f19c-6699-55fd-82ea-5c94649d8499'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0e56dedd-670d-58f3-a542-3ed0046d8bd9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7fa997a9-e35f-5589-87cd-8292aadb8f92'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '9cb38238-992a-5eef-8c8c-26081e93a1d6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4ed143e1-9722-5519-8fa6-7b09f79aa7cc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '348dd950-3c62-5816-8203-c0113fbd10be'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1f5bd3b1-9b2b-5bde-8228-d6c51e9e0958'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6dcf9dda-00f2-59ea-a9f8-449bc4ab4e8a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'kettlebell' else equipment end
where id = '7e2f02f7-78b9-58ac-981f-4cdbccc87665'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'bosu ball' else equipment end
where id = '6e18ccda-ce78-5c8d-a534-f6608f5db9b4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b4fd3b8d-c001-506c-a54b-25d096b39607'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b4632beb-6971-555f-8696-eadc87a5d654'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bf3a656a-4f77-50ce-9936-0cf135dee22d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'dbaa109b-795d-53e9-a8f3-6f839fa84d3e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '9bc13033-d125-5ed3-9c24-9aa692519b4e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'c4464d48-f964-5bad-ae22-1a36eea6f941'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd17ed436-608c-523f-847b-c4b3219ca484'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'kettlebell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '845e09c7-b90f-50f9-80b4-6cc79e36fb7f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '23949fad-1fcd-56ea-a7ce-2335b1b24245'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '7aaa7536-f050-5ca2-ab2c-0855727cd97d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd3d4d9f6-7e15-5163-8742-965a33a6ccc0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '032dded8-d32e-5ca3-a6c0-817977855cac'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '88ba91b4-1ece-57bb-99e7-1c27263919a1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'd2844c1d-6003-5460-868c-10455aba1f56'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0041d4e3-a8f4-5643-89d7-1efb61a8ec34'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '05a9b91a-1454-59ac-bda8-51f49e8f48ad'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e94a0d7c-17e6-5da8-b7e6-e3cb978bf2f6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'calves' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'acc11c72-27a6-5c53-81df-0fe226d3ee30'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c301d33d-c22d-52bd-bb21-1e9a67c904c1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'b4487dbf-5572-519f-91f5-4331d6637da5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'ffbf67f3-3d6c-5e3c-b6df-bcfa1d96a715'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = '37a11365-01e6-562e-adff-30459781d2c1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end
where id = '916d6acc-d8c2-5a30-bfe7-850a089e2bc7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '59f2b9e9-2859-58ea-b09e-c97cd536d1c9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'a55d4ac4-48c9-5af2-97a7-58d3e6dafe6b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end
where id = '1cc3d9f7-e38c-5de2-8c5c-8e936b1b51ce'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end
where id = 'b46eb9bd-ec56-589a-b6b4-29c8c93c4610'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = '5b5f64d2-f8c1-595a-85b6-90eddf699038'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6df801ea-d586-5898-92af-147015e76fa7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4f8fa08a-411d-5a20-a7b1-ceb55554d9fd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'dca47e20-75e6-5080-b602-10d2a7ddc79f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f4bb6671-90cc-50e3-b82b-9443f66fbfc5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1c1b7c30-5a3e-5773-899a-fd7adc3a55ad'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd9f8b9b2-780e-55b7-bcf5-b4ebd16aa525'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'be3c1e7b-6cb3-5581-84c5-9d69adfc0527'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '6fa0be50-7038-52e6-b65e-f395586aaea0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c90dea4a-ef8e-527c-89d9-fa87f8d2ebd4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '04a1b292-1d13-5830-8923-98187eb7feb7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '62aba000-f3fc-5054-a7a2-8a5a7dcca3c7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c57f4a50-3089-5212-9cfe-3c6e6dcfdf60'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'bf90c5aa-55e5-5a1e-b0f4-2fefa43dd52d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c1019acc-b4aa-51e7-8d4d-559978e48fd7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '1e34734a-1c84-5857-88e1-5d29f2c85859'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6dc11164-bbb2-5bd6-ab64-f1cd9166c526'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '77ebdb68-ebc0-581d-818f-263648b02e1f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '98387a74-a62f-50ac-bc7c-aaaa80e9c0c6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0989ce57-4048-58e0-997d-88ed6a9506bf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'f60d1ba3-5788-51b4-9314-8df6e3ce4311'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b5231b71-5ac4-52f4-bf36-c905e1773d59'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'kettlebell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6d959879-fa80-5b69-9de5-26db5f74478e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '17c35505-d192-5dc8-b221-c1c31d6b6ef8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a6e69dc2-a646-5478-8332-7537fa048252'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e1bd291c-d68a-55e4-95c7-bde698c55f4a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'eb7ab66f-3534-54e2-9f94-cfbcab10e4de'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '8974b6d1-2c88-5e07-ac11-65d9ca90555c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '25051f41-04b4-5861-badd-bd57545be56d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6aeb1fb6-8152-5d9c-ac6e-59bb304d2b4b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7337196d-1ee6-5bcb-8270-9ee6bab427ee'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '16704ba4-ada1-5250-b387-98ffa28044eb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '76345f30-1be8-5409-8ede-963e801135b1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'fcacda65-a9e7-51ba-9108-e8aaa4b4372b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'aa02bda5-9f9c-5f81-8396-e3bbddddba33'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c1428bd3-a6a1-5a9b-bd0f-326c179ffaa1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a23692f6-45b8-577a-a1c3-ae9a454587dc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9aa98e54-8e76-59bb-bcfb-ac42aa7c1c9b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '64392c5b-c1bb-5495-a422-2c0a0b12e374'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '09761bd6-35a4-5f44-9b62-daace1aec13c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'bac2f617-6eb2-5184-80b7-1f7f32e33c7f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd265d87d-2893-5f39-b118-01493d4dff62'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7cfc9dfe-3d51-57b8-8fb8-b2e43b94ecdf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '41a73b9b-cf30-5545-86d2-883d614fee86'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '748a3049-60b5-5eff-8ad9-a8035ce20dcc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4f2d914d-d066-5cae-95bc-babfe6960d6d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'faf22a10-509b-5d65-9afb-30a83ba92477'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a91172c3-af18-5e12-998b-8b89787be317'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '01e8a58d-9914-5931-a8f8-0dc86da6a848'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'cd2473be-46e5-5c5d-9ea8-f709d0bb8d22'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'fe9b4571-acf2-5abc-a443-326473c57c86'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '17f0e0cb-a5d5-5733-b1bb-fd8f3f719973'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'smith machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8ddd3627-8b3c-5177-88a9-dca4e2c0365f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3456901f-184e-5bad-a11a-f24834b81573'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1f3669cd-5fa8-5d1c-a63a-7d5576a98ee0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e0418e99-5ace-5418-bdb3-34f76bef6700'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'smith machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a3206286-6fbc-5c8e-8c60-219a3ae191ef'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f41767ee-cb4e-5ab8-a962-0f924f077854'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '38d20cf6-252a-545e-ba82-62d7461816b8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '089e6894-dacb-529b-ad5d-529394a68f7a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'eac960b1-83cb-56ce-8c30-4a38d9f10c62'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'de7260cf-7380-5aa0-a6af-329b554d4ae4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '962a86d2-2038-5d37-96b9-a79e51ba8874'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3d20df17-55e3-5b35-82cb-dae971d8ee50'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'db9b44ba-c045-5cf9-a524-d743a539d37f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd0755648-49be-5b76-b5b6-8807313c2b5a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b1bba82c-78e9-5254-966d-67eed8fd6d06'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ecb78ef1-9a54-5991-8914-fe3adb4c621c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b79f6379-0c1e-527c-9ba6-f0b003bad245'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '92d5519f-e3e6-5f25-ab10-7dff171204ff'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6af56416-f56c-5f7e-99e3-1a53a3616c49'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b5df0e0f-2907-587d-9265-9aefdf16a12d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c3e3c099-3fb3-5a62-b5a4-d201f6fcdf9c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9d733bde-29f0-5129-b30b-5521bd25a0c9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '39ae345d-400d-5e74-949d-bfdf704534c8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'abb2b00a-a23e-5a41-bb4e-e6ba9711e198'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '15b0099b-0159-5283-a860-790663eeb4a0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c5f1ad42-09e7-5bec-ab64-fabf8858427a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2e763def-0e56-511b-9b8b-d5122f5883c3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7e0b6385-3d5d-5f50-bbd9-55b3f809d2cd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end
where id = '461d9953-3710-54b2-8e54-e5ea6a18fe6c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '867c5b8c-a0a7-55f6-9667-25c78e416112'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7f7836ce-f67a-52fa-b540-521b56e68e4b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'dee4e783-b952-51f4-8999-3a5f434d53b8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'def6ac4a-e93f-5712-bd98-b3a433c29470'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ea045234-617f-5289-b757-0264927c3850'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '055331fe-7bf8-5df2-92a2-e48e0921b550'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '09421361-e0f1-5137-9f57-54a9e7a6c9af'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3c7da99d-f233-5a20-918e-983a921a3a06'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '95e0d9ee-f1e2-5512-be25-10e35a944500'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '29eef3ad-a867-5461-b96c-983200e96663'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ea82cdb2-27bd-5ea3-b94b-3633ee613f16'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3c363710-216c-5115-b39c-d56ba627e273'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'db03da92-44c7-58f2-b50a-dc46ad7b7e20'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '44ae896a-ea07-5954-9512-55f2ed77af50'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b33ee0d9-bab9-5fd3-8128-36f27d33be21'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '0b837442-c0b2-555d-9e96-71a2bd855f7a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'e3bda88f-c4fb-5697-99b6-806cde456198'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '48794344-1b72-5f2e-8b50-05efc232660c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '651edd05-a449-5959-96b4-c9bc9af3f9c8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c21d2189-7472-589c-8f9c-d67d05c91601'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '910fad9e-1e0f-5e36-9d12-b5eae149522e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '96acf879-33fb-531c-959d-52619205782d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '674bbbf1-1bdc-51f3-ba41-1d4603db0224'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e9e5784c-c011-5ba5-8d9c-16bd814e4b2f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = 'a17486ac-d005-57a5-8a85-e9e9064d017e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '1912b723-22f0-59ac-b4a1-65ca4421be0d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '40f2158c-b4c4-5b07-b0ad-ad4a6e2686f0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7661d492-a6d9-50fb-840e-0d09366bf959'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '991ff515-111c-5afa-bea4-86bdca036bb1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '1617b704-460c-5de8-b649-34cc569dab84'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '2d0ad59a-716a-5d5c-893d-f528c2717e0c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd61714d5-f956-5716-815b-604f6783cb50'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'd36536d8-9932-539e-a96b-b44945608fa1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0ee49aab-88b9-5a12-902a-a38f1f430706'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b52cc15e-9e02-50cb-bb69-8eba156e9be3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8a7727cc-2eba-5646-ad63-b5ff0481c740'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '66ee7e44-e390-5798-b4d0-1dd38261207e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'de6c7ca7-0cb5-5b3b-b135-c42a2b140cad'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '253a448e-bc1b-5697-a3c7-820664725b07'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7f1ed5a0-d347-560a-874f-f25b7458e6eb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'bcc45c3a-fe94-56ec-bd53-916694b6a565'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c3cfde1f-d130-5cae-a75f-4afbb42df1e7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'fc6f4f3e-e7aa-5c9b-b246-477b48be7451'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '8ce763f9-59ad-5b6b-860a-f7d5b4cc256d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '68ce61fa-9e38-5a22-b991-d3ec2e266054'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8cfcd7b9-a7c4-52d2-9b7f-15e3409c5883'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'd59a7272-4cb0-5c54-bd65-8ca59a907581'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '85d70627-7661-55f8-85b6-d5ea7f080462'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'adductors' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '94a7a381-ed2a-57b5-a8b8-f661f84765af'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b95c600f-a700-568e-a8c0-676527fd53e1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '9f570f4b-b983-55eb-9519-c347d8d0e953'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '28f70049-1412-5b8b-9c0c-ff9599903bcf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ccecf2db-8fa8-5701-96f6-4ba7bb786a2f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'eb1ff677-3df9-575a-9e87-0b17e147d385'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8dbc6955-4d65-5bc9-a5b8-47c3e6deeebd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a9555678-a095-5710-a7b4-b474ccb158e8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '859d60af-165a-5c89-9b62-53f36b3bd0e4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '19ccc74b-7677-5572-89b6-288d5bddbfb7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6a9e386a-1248-5eb5-b8b3-23e09b36274e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9a6a08dd-1b34-563e-b501-fcf569ee73cc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'eddb16a1-e31e-5876-92f9-157d186f1ea9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bc6a0be0-bdbd-5a18-9b80-b3e02eb27c67'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6c0feeb2-413f-59a6-b9c9-1bd832f4c56e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f875de0d-10a9-5b4d-9457-0c0bb69d78db'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '1adc24fc-19ea-5c73-8919-76d5ee90312b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6c4fbba8-f193-50bb-a65d-4388b12e224f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '24507419-ad71-5a90-adc6-03c3b86b1b95'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e37648e0-47cd-5afd-974e-be4ec1a1d04e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0328d194-d2ea-5adc-8fdb-3c2711691d4b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd2780303-6659-515e-8e1b-8c4f64ae2018'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '11cf86c8-7d98-5582-b4fb-1aac8ac1bd6e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2677c2ed-4ef4-5fd0-ab3a-e41dbde2f383'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'fe1ddd36-8e70-524a-a076-816f871de2b8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b03c52f9-c831-58ec-b543-657fcd97e0dc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '502c5232-5837-5b28-97de-41e29af26e48'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '3c2a017c-fee5-5b6d-8232-e245929c0c38'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3ea026ff-a28e-5408-b914-01174c862423'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cf349f85-041c-5bee-ab7f-1b6938a5cc8e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '678006da-7d35-5fb3-8b34-dacf0cfb3233'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '156c6614-7272-5c88-bb14-f6edf060803d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cb9a0ceb-7a35-5aaf-9da6-77a6e6279d1f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'b16106bd-62fc-5b3c-b974-fb69f2da74e3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1e298a20-f4f6-5bbf-94cc-90dcc4a8d103'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd05ba786-11b3-54f3-8e71-324ca7200ff6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '8cbb4412-6591-5b67-9ec9-1e46dd33473d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a672fe28-f837-5d0f-b2aa-d7095192a43c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd26596fb-d922-5f9a-a3b3-bf996bfc5992'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '0dfec93a-c28d-5f90-9669-6eb346a76b9d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '81cc32b4-d642-574e-b6da-0b6fff423385'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '68cecfa9-2928-550a-81e8-40dec059aebb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'f7e62e9b-7be6-51a1-9a59-d182df53bebb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a775ab97-2779-5485-9c82-3819fbb417c8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'forearms' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'forearms' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = '9e349e29-3368-5683-9e36-9d6d794ceed0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'fe843fd2-3e6a-5def-a666-359c2fc6b626'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a340cd1c-3179-57c5-87ad-8b3549ec7526'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4b7faf07-a6b2-5cd7-992f-a378973277d7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3d9acd4c-0514-5b21-88c4-e2e44cc2ce65'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'd0574c8c-b676-5f17-bbc2-f678f4eebfeb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'cbd4184d-1892-52ae-a493-c823bb585c96'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '6d963fb6-295a-5280-92e6-61153584fd8d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9e12f26b-6483-5ffa-8ad1-d22f42d81cb0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bda98858-dc4f-5e20-a2ef-7a63b53b1abd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '8a4b313b-8cd5-5824-a1b2-6da5149ca749'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bd4d39c0-9323-5958-95fd-5cc73645fecf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3699309e-1b3f-5998-93f5-6bae478196f0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '38906fe6-bbd4-5a23-b074-44be75769de5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5dec6799-8d1e-5153-8bc1-8e5271f339be'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd30e747a-0b4c-5a7e-a835-a6bd46fc52f7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Plyometrics' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '242945b7-52b7-5b19-9340-92ad0ec019bc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'eeca2844-7a5e-5e5b-8e21-39b0bfb3edc3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '9347dd73-3324-5c04-b50a-980158502fd1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'caf546f1-f7c4-54bb-adaf-87226e650b27'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b264f98c-a136-5f1a-810b-677e3b981b8c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '32d06c10-3e67-5ede-a996-5906ff878dd6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3944c3e1-ed4d-52e6-9526-5b681fd3a00a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8b406bc4-1ee3-5943-8acd-8a34d39a6286'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '074ad50a-9768-557f-96ae-3c270dae2938'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '450741ca-cc38-5331-ae50-a1648a0a9562'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f44972b7-0951-5985-9af9-1b332450406c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end
where id = '827349d2-f9b0-5570-be88-540d7487fc72'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'dc686d6b-33b7-5ddd-a696-bc8f62d795b0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f2b3d9db-5e78-52c8-8adf-ea4e1d6e4359'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end
where id = '87f865ac-b10e-516f-b45f-bb37fe458d21'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end
where id = 'b5048575-8585-52f8-aaec-5cb8336a6945'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1c2796da-a86b-5e2a-8e17-31ff934d70cf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '37e4966c-87a1-5810-b447-b39779ccd913'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '4f114534-e4dd-5c60-999c-2efc52d8dbe5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'edd64d29-5ecb-573f-832f-708441093d59'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end
where id = '5dab3a53-0bb4-567e-acdb-1cde2c5cc56a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'fd97f6d0-35e0-53c1-9090-8a61f40c2f33'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ed027f0e-28c5-56cf-818d-b12942877c93'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6ef9d0ca-a7b5-547c-905f-3573448587e1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'f90d6928-d76d-5073-9b8e-b1a5c5036327'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'b60673d9-e11f-56df-92be-7a16b655c370'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '90bac63c-e20c-5cbf-aa50-0ca37c640441'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '815e1c4e-05d3-5877-950f-e59b988e1e69'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abductors' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '46e93725-fe50-59fb-9af7-be39b721c648'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ec38c8a0-d2d4-501e-9b97-45949b69e3b2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b503063f-8c4b-5043-99a2-b2d5d305f9d5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ea61ab60-6dcc-5fc5-becd-464d5064b5b9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '50716786-8387-531f-b5c3-249cd512fb8e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1e2b6dc7-4269-5907-86a2-cba35079dc69'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'eddeff8b-a96a-521c-9dda-4d48972adee3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ff767a08-bf8f-59e1-a7ff-81436dcde4af'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '61a96270-e0cf-5998-8870-391973d72896'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '01928051-e5e0-53ee-89f9-7ac0fb8f8f50'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '6bce434a-7b35-515f-b34f-79cc664361e2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '34ee57d7-975b-525c-a059-4fa36a13c6de'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'aebf84be-5ed1-5530-8ccb-3cb7124b273a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4e0975e7-68f5-5ee3-aa9d-fd7f9ee2bbf4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '058e5ccf-514a-571c-b273-d4190eeea7dd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '8b6664cb-017e-5ff5-9d3a-fd3f632658e3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '32499ff3-90cf-57e1-9326-8960edfd9b16'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'leverage machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '28188412-bc43-58f6-9154-4681c67c5747'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'aedd4b66-9068-5b71-9a54-4bf3588e38ef'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3790f80f-f677-5be4-997f-294cfa969535'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '21b2e30f-41bc-5588-951f-5f3b196051fa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '3b3f212a-fbe6-5b1f-aca1-4c9a14a3cc65'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'd7567ad8-c6b4-52e3-84b5-836429cb2a84'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'fe146301-dbbe-52de-9081-ec61efcc75de'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Full Body' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '85118763-edca-5c4a-a01d-c133f665e83e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'e83cfdfc-8732-5476-b272-0dd52115cfb4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd679d605-e9b6-5686-adb6-3bdbe2d4162d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = '3075015e-4686-5aa6-a8b7-45fac32263b9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '96d2a80f-542d-5994-b487-7fd8740bd302'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b311ee8c-a090-5542-9943-aa100b29c923'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1daf37b1-8b28-5863-95d2-9a6a546df8fb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'lower back' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = '647d4a8b-63ab-53e3-bb7d-0d3f37a91b84'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'b15e936a-237f-5338-ba1b-d87a3f6e6693'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2c1c3340-90a4-5f62-8540-1489073bac69'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'trap bar' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3e236b25-d770-50a5-b2a9-47db41d4b4a3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f6c16f23-e1e6-532c-a8c0-b91feb86226c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a43daf1c-80de-52a7-bff6-4b3b15538530'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '32f996a7-31ea-5ed3-b4d4-3dfc25acff46'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b1155d7e-752e-549b-bc6f-3e61499c4bd2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'f3844b76-7ea9-5139-81fc-9146e22b795d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end
where id = 'b2ca4e24-b025-5a5b-848d-662769a1305c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4a4d6d25-b37c-5839-be75-85a99508371d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f61b0966-d3f6-53b5-aab6-8d2d12f84775'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9c416c9b-09f9-560f-801b-6cea91529a8c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c44ae914-0485-59b9-90ac-1a5383a3e054'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end
where id = 'f51a0bc6-a5c2-53f1-81a9-cfb861c329aa'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = '750927c7-be7a-5d28-a95c-8e0d5abc56eb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = '24da83be-43a3-5292-bc80-c6410421f632'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'b1529d4f-b948-500a-8aec-d14ac6f6f9c6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '620a3038-7be2-5f0c-9dd0-e0d2340f05b8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c3738e8c-14af-539e-9cc6-12a5f58e8a40'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6c7d5b8f-25f8-5a18-9648-ba89ec581270'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '258d29ad-577e-5fbb-ad97-ca4a6c82ad79'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '37d3c829-29f2-5731-a6f9-34009f440ab3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c4963c6f-e523-55a8-a099-b96a48ed1529'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b39ee234-4c30-5e86-a299-8db761ca12be'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '32809e4f-4b2a-53cf-9e73-154548c29e42'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '781ec2b5-aae3-529d-a253-e2359015e445'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '2027fe14-d2d8-515f-8b25-afba9c351308'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bf17a8de-bb85-5e47-8125-60889cd45d17'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8ff4b7f2-138d-58ac-a618-d79fc1374b27'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end
where id = '8c3de41b-6c7f-55d7-8534-54f432cd6dad'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end
where id = 'ed563b67-5770-55d2-b293-9d46f14a388f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7f47dfb6-5681-5b54-a637-b7af5ccc09e3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '114655c5-0371-5abe-af38-73dda0abf64a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a6d9b252-21f9-5c23-8a3c-5a6d04082edd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end
where id = '356aa4ce-178a-599f-aa9d-8f11171fdc5c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = 'c12753ab-8fab-5be7-9133-839c427750d9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '4282641a-49ad-5230-a01e-9aa1117af51f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'triceps' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'triceps' else target_muscle end,
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '212dc942-5a89-5a23-93a3-8e7ca20972bd'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c7c549d1-f11b-56dd-b83f-fa017e5181c1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '9dc65b1e-4f1b-5d15-b028-4e5ad3628269'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'kettlebell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Full Body' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9c35ae2d-568e-5942-b89d-3b517a99278f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'c49df906-1a99-509d-a390-614c05d19025'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'eada33fc-a92b-51d7-8ceb-1aedcc3b7124'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7e9842ff-da63-5145-8bd6-c8fec8b425d3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '119f2e65-a0d0-5af1-889c-de1615d675ca'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b84c77e2-bba1-54b6-b848-e0f7ad97338a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'dcef1a35-9a44-5637-bd21-0d67f272a6d2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '82bf0151-47dd-5244-91a8-6c511c389f16'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '37420d77-6d26-5e48-81cf-c8939bad98c3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e0185545-2d46-54d3-adb6-8aa285fa977f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '34398a44-feda-54e1-be04-5e8bb80bfed5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'leverage machine' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '83e830c3-cbdc-552e-bfd3-1f4453d32aa7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'af6c2533-29be-5e0a-a30f-b4ae3d3a3e07'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'glutes' else target_muscle end,
  category = case when category is null then 'Glutes' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6c269b5e-0c56-5a21-8c2d-48f3aa05d95f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = 'f910b61f-ab5a-5a7e-a700-f3327f2ac360'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1f4fe39a-2a8f-5637-bd5e-0fd88aa3ce4e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '4d5d456c-2387-55d0-a9a9-c7b916000e1a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'core' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'abdominals' else target_muscle end,
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'e31e8f26-4412-570f-ae0f-478347046270'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7ed967b8-806e-510d-a0cc-bdcde0947872'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '2713e769-7331-54ee-b5e5-538ca54fb457'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ea23c0d3-1f88-58fd-8ace-3719af696bd2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'upper back' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'fb22d8db-64fe-5fef-b237-681a46b9d23c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '2742c08f-a6ee-5874-9ff7-7e2505f6ffdc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ed637ea3-a28b-5077-8443-b5ba261e0192'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '830202e6-fe7f-56fe-91d2-b7d8d3a2f621'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e56d4c87-a057-584a-9af5-a8ea0ca9f291'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '69a93aca-8473-5812-8624-a784e33a78e1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '4f79d805-0a9c-5fcc-9847-0893c01a888c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b29b560b-c274-5f34-8e5c-435558422fd8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = 'd7c2ae2f-a50c-566c-a891-affdf5b9427f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c1443373-0dcf-59c9-8cbd-b929bf2c0e1a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd8e48055-84b3-5d29-aed2-fe7e2320fcaf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '524d6717-10a5-592a-8042-f18e333c7a04'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '57002f1a-8f20-5a8e-831c-02cfb10043fc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '071edcb0-41d2-5e97-a177-bdfb6760e1cb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'fc837900-d69d-59d6-a07e-ba2e53018ed6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b1a7a9e7-fe88-5a8e-9aee-e65f387e0065'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '44ffc3ca-7518-5272-a964-9650c6cae12a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '00e8e119-56c1-52bc-a231-aaf8fccaecb6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'medicine ball' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '491b9073-695d-5ba8-9018-81fbe9c4048d'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '49db1d57-c3f7-5593-8f2f-a3c7afa816b6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'dea3baf6-a171-5d83-8085-f646fb6ef519'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'dda7798f-dbae-580a-99cc-d2ee9f5e9b84'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9c944323-7316-51f0-acda-a377d76b09f4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'a16b3ad1-8677-5317-834c-216e0f8ad02f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = 'd3fe53a2-b362-5d01-8273-cd6cededeab2'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'bb78c2c1-fb01-51bf-b848-5825b7bf487e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5859600b-5af3-5f35-b371-4d2dbc119dd4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'eb09a5be-fe8a-58bf-8193-e97ff12c3a37'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cbe6a77f-69bc-5465-a11d-28134e3972d8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'ff7d9fed-39fc-5423-8361-6e6c8043dbea'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '097e749b-e1df-56bf-b5fe-d329e297497f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'd4fa122e-2e5c-55ff-8fc2-92f1b8318197'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'a8b061e5-fe01-57c3-8279-9d3c03d23270'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '34b40a65-90a5-5339-9dd6-90e4c45fa2c9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1470e9a6-46c5-5479-9a29-6d87896d3547'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = '2d204af9-1f28-509e-998c-b887a5ccf87b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a0b90f9d-9f76-529d-8d9b-5387bff1bac8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '5eba1e6c-9f2a-5715-add7-b9cc5296e98e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '35c9add6-5302-5b2e-be9a-7a4db649311e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = '125f178c-7bab-532a-9e31-713f2c298980'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end
where id = 'b2e5a999-6b59-5716-aaac-790a9da89f9e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'neck' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'resistance band' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'neck' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = 'aad67d55-d9cf-597c-8927-35a6b3d77efe'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f0e6ce20-28e3-586e-ac63-c77a7551e3c1'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7fa12b51-c8d6-58ae-b03f-d657b42b4310'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3af3a2e2-9ae4-5901-b746-366691afaaa7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'chest' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'pectorals' else target_muscle end,
  category = case when category is null then 'Chest' else category end
where id = '6858b00b-4501-565d-8144-fe2f3543830f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '29378f33-54d9-5546-901f-f6e909e7390b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '0f9f07cc-184d-5fab-b84d-2822cabedb54'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '44436e64-8e49-5217-991d-6dd516425e20'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '1d38c3d0-5b54-58e6-a231-5cb06b2461d0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '27e6fbbb-4bde-5786-a812-b362f703913f'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'faffa60d-6407-52ef-ae23-10a3a0a89e42'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'e5285928-25de-5b87-8150-f11ddbad2d39'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '024a115a-74a8-5b49-9e33-4597b2081102'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '5844776e-bab8-52f8-a3ba-99ed6cd05806'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '3f923e27-bd53-53d9-8e34-8964d9717bb6'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'barbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'quadriceps' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '7a86db5d-fbdb-5e48-bf85-7587ed8017eb'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '3281e78d-a0c2-5c41-b809-7ab7e979861e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '4bd1fe1e-c995-51d0-89ac-c96267046e68'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'ccdea0e8-9c01-50b9-a976-7acf5cb99ac9'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '19ef6d55-c6b9-5c45-a365-61a9540dd059'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '499f35e7-0a5e-58c5-859f-136b845e0035'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Triceps' else category end
where id = '1ba4f4a6-2794-580c-9ef8-70d42af6177c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Core' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'd7692cb5-e52c-5e52-942d-5b96abe3c77c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cec79c45-7dc9-5bc1-b243-749fd2dcf6a0'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end
where id = 'bc8604d5-17af-595a-a403-5b7efc76bea7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '9ee0fcea-3b3e-5c8f-b30b-a43809138342'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '5696b60f-99ea-5023-9a5c-9ead97a60d07'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '7e381394-79e9-531f-bace-238dab413e71'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '38128ca5-0591-5204-a7e8-c198e53f4944'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Chest' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '6ee97462-894c-5434-848d-cead71008993'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'f3c83a83-f7dc-5420-922a-35dcf8f9e296'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'b74a7eee-7815-52a7-9233-8b9bd2e3be8e'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '1e621d57-9fcd-5ad1-80e3-dde82c8dff38'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'a0b2b786-6dde-50e1-a430-89f244d1edfe'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = '74e95ce7-24e8-5bae-a3a8-90a780f2a2d7'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'cable' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end,
  is_compound = case when is_compound is null then true else is_compound end
where id = 'fa09ee1c-3156-5a20-9207-d7d8b721de10'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '3940d360-1e02-56f3-a989-172d4c101cf3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Glutes' else category end
where id = '5f56f412-fc7b-599a-9d8d-2c5268c0ed24'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'back' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'latissimus dorsi' else target_muscle end,
  category = case when category is null then 'Back' else category end
where id = '454b8c71-6354-512c-b0ea-131dec8b031b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '25f43748-e005-5cec-bdf5-11ad01cc12e3'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '5e0d182c-54b1-5cce-823b-b2c55083fbcf'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'biceps' else body_part end,
  equipment = case when coalesce(equipment, '') = '' then 'dumbbell' else equipment end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'biceps' else target_muscle end,
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '7595e30e-e5dd-51aa-8cd6-4eac5ce89c4b'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'bc8b4b08-2c16-51f8-a440-6cee9d2bdf7a'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Shoulders' else category end
where id = '247b2dbd-80fe-5601-aa7d-9e97cc3e7006'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'b7c41110-2849-508a-a2f6-353581d48dcc'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  equipment = case when coalesce(equipment, '') = '' then 'bodyweight' else equipment end,
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '8b978b38-7979-5718-8817-74fc0cfaf7d8'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = 'b13c1f42-b991-5f93-b4bd-d8f2f9978de5'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'shoulders' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'deltoids' else target_muscle end,
  category = case when category is null then 'Shoulders' else category end
where id = 'df456391-691b-54ef-b4d3-9d6a174758b4'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'legs' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'hamstrings' else target_muscle end,
  category = case when category is null then 'Legs' else category end
where id = '8cb66e6c-3a94-5f39-be83-4de016f42318'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Mobility' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '19d75bc7-1d45-5ad3-93b8-c85d9a82eaab'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Legs' else category end
where id = '46cc126c-182c-51ee-ada4-9f0bc6773991'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  body_part = case when coalesce(body_part, '') in ('', 'other') then 'cardio' else body_part end,
  target_muscle = case when coalesce(target_muscle, '') = '' then 'cardiovascular system' else target_muscle end,
  category = case when category is null then 'Cardio' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'c6a163f5-e188-5710-948f-326ee56c0d8c'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = 'cdc917f4-0382-59c7-9e9e-caf973e44a54'
  and source in ('exercisedb', 'wger', 'public_domain');

update public.exercises
set
  category = case when category is null then 'Biceps' else category end,
  is_compound = case when is_compound is null then false else is_compound end
where id = '233a77d2-9499-5740-ac72-2d0e3e2d896c'
  and source in ('exercisedb', 'wger', 'public_domain');

notify pgrst, 'reload schema';
