-- Catalogue category corrections after enrich heuristics stamped many shoulder /
-- arm / back movements as Chest (bare "fly"/"bench"/"press" matched first).
-- Safe to re-run. Postgres POSIX regex (no \b word boundaries).

-- 1) Reverse / rear / back flies → Shoulders
update public.exercises
set
  category = 'Shoulders',
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'chest') then 'shoulders'
    else body_part
  end,
  target_muscle = case
    when coalesce(target_muscle, '') in ('', 'other', 'chest', 'pectorals') then 'deltoids'
    else target_muscle
  end,
  is_compound = coalesce(is_compound, false)
where
  coalesce(category, '') in ('Chest', '')
  and name ~* '(reverse.*flye?s?|rear[[:space:]-]*(delt[[:space:]-]*)?flye?s?|rear[[:space:]-]*fly|back[[:space:]-]*flye?s?)';

-- 2) Rear-delt raises (not rows / stretches) → Shoulders
update public.exercises
set
  category = 'Shoulders',
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'chest') then 'shoulders'
    else body_part
  end,
  target_muscle = case
    when coalesce(target_muscle, '') in ('', 'other', 'chest', 'pectorals') then 'deltoids'
    else target_muscle
  end,
  is_compound = coalesce(is_compound, false)
where
  coalesce(category, '') in ('Chest', '')
  and name ~* 'rear[[:space:]-]*delt'
  and name !~* '(row|stretch)';

-- 3) Lateral / front / side raises still on Chest → Shoulders
update public.exercises
set
  category = 'Shoulders',
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'chest') then 'shoulders'
    else body_part
  end,
  target_muscle = case
    when coalesce(target_muscle, '') in ('', 'other', 'chest', 'pectorals') then 'deltoids'
    else target_muscle
  end,
  is_compound = coalesce(is_compound, false)
where
  category = 'Chest'
  and name ~* '((lateral|front|side)[[:space:]-]+raises?|side[[:space:]-]+laterals?)';

-- 4) body_part=shoulders but category=Chest (presses, rotations, raises).
--    Keep true chest compounds out via name guard.
update public.exercises
set
  category = 'Shoulders',
  target_muscle = case
    when coalesce(target_muscle, '') in ('', 'other', 'chest', 'pectorals') then 'deltoids'
    else target_muscle
  end
where
  category = 'Chest'
  and body_part = 'shoulders'
  and name !~* '(bench[[:space:]-]*press|chest[[:space:]-]*press|push-?ups?)';

-- 5) Overhead / push / seated / standing shoulder presses stamped Chest via press_generic
update public.exercises
set
  category = 'Shoulders',
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'chest') then 'shoulders'
    else body_part
  end,
  target_muscle = case
    when coalesce(target_muscle, '') in ('', 'other', 'chest', 'pectorals') then 'deltoids'
    else target_muscle
  end
where
  category = 'Chest'
  and name ~* '(overhead|military|push|seated|standing|arnold|bradford|rocky|scott|cuban|landmine|anti[[:space:]-]*gravity|w-?press|para[[:space:]-]*press|seesaw|iron[[:space:]-]*cross)'
  and name ~* 'press(es)?'
  and name !~* '(bench[[:space:]-]*press|chest[[:space:]-]*press|french[[:space:]-]*press|jm[[:space:]-]|tate[[:space:]-]*press|triceps?)';

-- 6) Face pulls → Shoulders
update public.exercises
set
  category = 'Shoulders',
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'chest', 'back') then 'shoulders'
    else body_part
  end,
  target_muscle = case
    when coalesce(target_muscle, '') in ('', 'other', 'chest', 'pectorals', 'upper back') then 'deltoids'
    else target_muscle
  end,
  is_compound = coalesce(is_compound, false)
where
  name ~* 'face[[:space:]-]*pulls?'
  and coalesce(category, '') in ('Chest', 'Back', '');

-- 7) Band / cable pull-aparts → Shoulders (leave Mobility variants alone)
update public.exercises
set
  category = 'Shoulders',
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'chest', 'back') then 'shoulders'
    else body_part
  end,
  is_compound = coalesce(is_compound, false)
where
  name ~* 'pull[[:space:]-]*aparts?'
  and coalesce(category, '') in ('Chest', 'Back', '')
  and name !~* '(mobility|stretch|external[[:space:]-]*rotation)';

-- 7b) Handstand push-ups stamped Chest → Shoulders
update public.exercises
set
  category = 'Shoulders',
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'chest', 'triceps') then 'shoulders'
    else body_part
  end,
  target_muscle = case
    when coalesce(target_muscle, '') in ('', 'other', 'chest', 'pectorals', 'triceps') then 'deltoids'
    else target_muscle
  end
where
  category = 'Chest'
  and name ~* 'handstand[[:space:]-]*push';

-- 8) Upright rows → Shoulders
update public.exercises
set
  category = 'Shoulders',
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'back') then 'shoulders'
    else body_part
  end,
  target_muscle = case
    when coalesce(target_muscle, '') in ('', 'other', 'upper back', 'traps') then 'deltoids'
    else target_muscle
  end
where
  name ~* 'upright[[:space:]-]+row'
  and category = 'Back';

-- 9) Clear triceps isolations / close-grip / diamond still on Chest
update public.exercises
set
  category = 'Triceps',
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'chest') then 'triceps'
    else body_part
  end,
  target_muscle = case
    when coalesce(target_muscle, '') in ('', 'other', 'chest', 'pectorals') then 'triceps'
    else target_muscle
  end,
  is_compound = case
    when name ~* '(close[[:space:]-]*grip|diamond|narrow|bench[[:space:]-]*dips?|jm[[:space:]-])' then coalesce(is_compound, true)
    else coalesce(is_compound, false)
  end
where
  coalesce(category, '') in ('Chest', '')
  and (
    name ~* 'triceps?'
    or name ~* '(french[[:space:]-]*press|jm[[:space:]-]*(bench[[:space:]-]*)?press|tate[[:space:]-]*press|skull|elbow[[:space:]-]*press)'
    or name ~* '(bench[[:space:]-]*dips?|close[[:space:]-]*grip|diamond[[:space:]-]*push|narrow[[:space:]-]*push)'
    or (
      body_part = 'triceps'
      and name ~* '(extension|pushdowns?|push-?downs?|kickbacks?|dips?)'
    )
  )
  and name !~* '(chest[[:space:]-]*dip|dips?[[:space:]-]*-?[[:space:]-]*chest)';

-- 10) Biceps curls wrongly Chest because of "bench" in the name
update public.exercises
set
  category = 'Biceps',
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'chest') then 'biceps'
    else body_part
  end,
  target_muscle = case
    when coalesce(target_muscle, '') in ('', 'other', 'chest', 'pectorals') then 'biceps'
    else target_muscle
  end,
  is_compound = coalesce(is_compound, false)
where
  category = 'Chest'
  and body_part = 'biceps'
  and name ~* 'curls?'
  and name !~* '(leg[[:space:]-]*curl|hamstring|wrist)';

-- 11) Back movements stamped Chest (hypers, muscle-ups, bench pulls, lat pullovers)
update public.exercises
set
  category = 'Back',
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'chest') then 'back'
    else body_part
  end
where
  category = 'Chest'
  and (
    name ~* '(hyperextension|muscle[[:space:]-]*ups?|bench[[:space:]-]*pull|incline[[:space:]-]*bench[[:space:]-]*pull|bench[[:space:]-]*pull-?ups?)'
    or (
      name ~* 'pullover'
      and (
        body_part = 'back'
        or coalesce(target_muscle, '') ~* 'lat'
      )
    )
  );

-- 12) Glute kickback without "glute" in the name (enrich kickback → Triceps)
update public.exercises
set
  category = 'Glutes',
  is_compound = coalesce(is_compound, false)
where
  category = 'Triceps'
  and body_part = 'legs'
  and coalesce(target_muscle, '') ~* 'glute'
  and name ~* 'kickback';

-- 13) Calf-machine shoulder shrug (enrich calf rule won)
update public.exercises
set
  category = 'Back',
  body_part = case
    when coalesce(body_part, '') in ('', 'other', 'legs') then 'back'
    else body_part
  end,
  target_muscle = case
    when coalesce(target_muscle, '') in ('', 'other', 'calves') then 'traps'
    else target_muscle
  end
where
  name ~* 'shoulder[[:space:]-]*shrug'
  and category = 'Legs';

-- 14) Sit-ups / crunches still on Chest
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
  and name ~* '(sit[[:space:]-]*ups?|crunches?|butterfly[[:space:]-]*sit)';
