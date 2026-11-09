-- Cardio modalities for plan sessions + in-workout blocks.
-- Tag existing locomotion/machine rows as Cardio and add missing Assault Bike.

-- ---------------------------------------------------------------------------
-- Backfill category / body_part on known cardio catalogue rows
-- ---------------------------------------------------------------------------

update public.exercises
set
  body_part = case
    when coalesce(nullif(trim(body_part), ''), '') in ('', 'other') then 'cardio'
    else body_part
  end,
  category = coalesce(nullif(trim(category), ''), 'Cardio'),
  updated_at = now()
where canonical_key in (
  'walking',
  'treadmill walking',
  'walking on incline treadmill',
  'walking on stepmill',
  'jogging',
  'jogging treadmill',
  'running treadmill',
  'running trail walking',
  'elliptical',
  'elliptical trainer',
  'walk elliptical cross trainer',
  'stairmaster',
  'rowing stationary',
  'bike stationary',
  'bike cardio stationary',
  'bike run stationary',
  'bike stationary walk',
  'bike recumbent',
  'cycle cross trainer',
  'jump rope',
  'Jump rope: basic jumps',
  'skipping',
  'continuous easy freestyle swim',
  'Swimming 50m sprints',
  'ski ergometer',
  'Treadmill Cardio'
)
or (
  body_part = 'cardio'
  and coalesce(nullif(trim(category), ''), '') = ''
);

-- ---------------------------------------------------------------------------
-- Missing first-class modalities (Assault Bike ≠ Air Bike abs crunch)
-- ---------------------------------------------------------------------------

insert into public.exercises (
  id,
  canonical_key,
  name,
  body_part,
  equipment,
  target_muscle,
  secondary_muscles,
  instructions,
  media_url,
  media_kind,
  source,
  license,
  license_author,
  scope,
  status,
  category,
  is_compound
)
values
  (
    'a11c0001-ca4d-4001-8001-000000000001',
    'assault bike',
    'Assault Bike',
    'cardio',
    'machine',
    'cardiovascular system',
    array['quadriceps', 'hamstrings', 'glutes', 'shoulders']::text[],
    array[
      'Set the fan bike resistance to a manageable level.',
      'Sit tall, grip the handles, and drive arms and legs together in a smooth cycle.',
      'Keep cadence steady for the prescribed time or calories.',
      'Ease off gradually at the end rather than stopping abruptly.'
    ]::text[],
    null,
    null,
    'public_domain',
    'Unlicense',
    null,
    'global',
    'active',
    'Cardio',
    true
  ),
  (
    'a11c0001-ca4d-4001-8001-000000000002',
    'fan bike',
    'Fan Bike',
    'cardio',
    'machine',
    'cardiovascular system',
    array['quadriceps', 'hamstrings', 'glutes', 'shoulders']::text[],
    array[
      'Adjust the seat so hips and knees move comfortably.',
      'Drive through the pedals and pull/push the handles in rhythm.',
      'Hold a sustainable pace for the target duration.',
      'Finish with an easy cool-down spin.'
    ]::text[],
    null,
    null,
    'public_domain',
    'Unlicense',
    null,
    'global',
    'active',
    'Cardio',
    true
  ),
  (
    'a11c0001-ca4d-4001-8001-000000000003',
    'outdoor walk',
    'Outdoor Walk',
    'cardio',
    'body only',
    'cardiovascular system',
    array['calves', 'quadriceps', 'glutes']::text[],
    array[
      'Walk outdoors at a brisk, conversational pace.',
      'Keep posture tall and arms swinging naturally.',
      'Continue for the planned time or distance.'
    ]::text[],
    null,
    null,
    'public_domain',
    'Unlicense',
    null,
    'global',
    'active',
    'Cardio',
    false
  ),
  (
    'a11c0001-ca4d-4001-8001-000000000004',
    'outdoor jog',
    'Outdoor Jog',
    'cardio',
    'body only',
    'cardiovascular system',
    array['calves', 'quadriceps', 'hamstrings', 'glutes']::text[],
    array[
      'Jog outdoors at an easy, sustainable pace.',
      'Land softly and keep breathing steady.',
      'Hold the pace for the planned time or distance.'
    ]::text[],
    null,
    null,
    'public_domain',
    'Unlicense',
    null,
    'global',
    'active',
    'Cardio',
    false
  ),
  (
    'a11c0001-ca4d-4001-8001-000000000005',
    'spin bike',
    'Spin Bike',
    'cardio',
    'machine',
    'cardiovascular system',
    array['quadriceps', 'hamstrings', 'glutes', 'calves']::text[],
    array[
      'Set saddle and handlebar height for a slight knee bend at the bottom of the stroke.',
      'Clip in or place feet firmly on the pedals.',
      'Ride at the planned resistance and cadence for the target duration.'
    ]::text[],
    null,
    null,
    'public_domain',
    'Unlicense',
    null,
    'global',
    'active',
    'Cardio',
    true
  ),
  (
    'a11c0001-ca4d-4001-8001-000000000006',
    'easy swim',
    'Easy Swim',
    'cardio',
    'body only',
    'cardiovascular system',
    array['lats', 'shoulders', 'core']::text[],
    array[
      'Swim continuous easy lengths with any comfortable stroke.',
      'Keep effort conversational; rest briefly at the wall if needed.',
      'Continue for the planned time or distance.'
    ]::text[],
    null,
    null,
    'public_domain',
    'Unlicense',
    null,
    'global',
    'active',
    'Cardio',
    false
  )
on conflict (canonical_key) do update
set
  body_part = excluded.body_part,
  equipment = excluded.equipment,
  target_muscle = excluded.target_muscle,
  secondary_muscles = excluded.secondary_muscles,
  instructions = excluded.instructions,
  category = excluded.category,
  is_compound = excluded.is_compound,
  updated_at = now();

notify pgrst, 'reload schema';
