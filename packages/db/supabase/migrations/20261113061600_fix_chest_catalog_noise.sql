-- Clear non-chest movements still stamped Chest (usually because "bench" is in the name).

-- Wrist / forearm curls
update public.exercises
set
  category = null,
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'chest') then 'forearms'
    else body_part
  end,
  target_muscle = case
    when coalesce(target_muscle, '') in ('', 'other', 'chest', 'pectorals') then 'forearms'
    else target_muscle
  end,
  is_compound = coalesce(is_compound, false)
where
  category = 'Chest'
  and name ~* 'wrist[[:space:]-]*curls?';

-- Core movements (leg raises, pallof, planche, crunch, rollout, …)
update public.exercises
set
  category = 'Core',
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'chest') then 'core'
    else body_part
  end,
  target_muscle = case
    when coalesce(target_muscle, '') in ('', 'other', 'chest', 'pectorals') then 'abdominals'
    else target_muscle
  end,
  is_compound = coalesce(is_compound, false)
where
  category = 'Chest'
  and (
    name ~* '(pallof|planche|maltese|rollout|russian[[:space:]-]*twist)'
    or name ~* '(leg[[:space:]-]*(raise|pull|tuck)|knee\/hip[[:space:]-]*raise|crunch)'
    or (
      body_part = 'core'
      and name !~* '(push-?ups?|bench[[:space:]-]*press|chest[[:space:]-]*press|flye?s?)'
    )
  );

-- Legs / glute noise stamped Chest via "bench"
update public.exercises
set
  category = case
    when name ~* '(glute|hip[[:space:]-]*(thrust|extension)|groiner)'
      or coalesce(target_muscle, '') ~* 'glute' then 'Glutes'
    else 'Legs'
  end,
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'chest') then 'legs'
    else body_part
  end,
  is_compound = coalesce(is_compound, false)
where
  category = 'Chest'
  and body_part = 'legs'
  and name !~* 'push-?ups?';

-- Neck mobility
update public.exercises
set
  category = 'Mobility',
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'chest') then 'neck'
    else body_part
  end,
  is_compound = coalesce(is_compound, false)
where
  category = 'Chest'
  and (body_part = 'neck' or name ~* 'neck');

-- Biceps curls wrongly Chest
update public.exercises
set
  category = 'Biceps',
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'chest') then 'biceps'
    else body_part
  end,
  is_compound = coalesce(is_compound, false)
where
  category = 'Chest'
  and body_part = 'biceps'
  and name ~* 'curls?';
