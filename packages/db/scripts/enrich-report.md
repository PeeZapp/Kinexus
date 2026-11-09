# Exercise catalogue enrichment report

Generated: 2026-11-09T05:36:13.887Z
Migration: `20261109150000_enrich_exercise_catalog.sql`
Rows parsed: 2670
Rows with at least one update: 2563

## Gap counts (allowed sources)

| Field | Before | After | Filled |
| --- | ---: | ---: | ---: |
| body_part empty/other | 794 | 217 | 577 |
| equipment empty | 835 | 421 | 414 |
| target_muscle empty | 778 | 213 | 565 |
| category null | 2668 | 144 | 2524 |
| is_compound null | 2668 | 763 | 1905 |

## Rule hit counts (field-level)

| Rule | Hits |
| --- | ---: |
| same_exercise | 150 |
| keyword_name | 2895 |
| keyword_instructions | 811 |
| derived_category | 224 |
| compound_rule | 1905 |

## Remaining unresolved (body/equipment/target): 474

Sample names:
- 1 Leg Box Squat (wger)
- 1/2 Kneeling Thoracic Rotation (wger)
- 90/90 Breathing (wger)
- 90/90 Hamstring / Barre-Style Stretch (wger)
- 90/90 Hip Switches (wger)
- Abdominal Draw-In (wger)
- Abdominal Stabilization (wger)
- Abduction while standing (wger)
- Adductor Rock Backs (wger)
- Adductor/Groin (public_domain)
- Alternate back lunges (wger)
- Alternate Leg Diagonal Bound (public_domain)
- Alternate Walking (wger)
- Alternative DB Gorilla rows (wger)
- ankle dorsiflexion rocks (wger)
- Ankle On The Knee (public_domain)
- Ankle Roll (wger)
- Anterior Tibialis-SMR (public_domain)
- Arabesque (wger)
- Arch Hang (wger)
- Arm and neck stretch (wger)
- Arm Circles (public_domain)
- Arm Raises (T/Y/I) (wger)
- Back bridge (wger)
- Back neck stretch (wger)
- Backward arm circles (wger)
- Backward shoulder rotation (wger)
- Bag training (wger)
- Ball crunches (wger)
- Band pull-apart with external rotation (wger)
