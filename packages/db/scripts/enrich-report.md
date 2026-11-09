# Exercise catalogue enrichment report

Generated: 2026-11-09T07:29:05.962Z
Migrations:
- `20261109150001_enrich_exercise_catalog_01_of_11.sql`
- `20261109150002_enrich_exercise_catalog_02_of_11.sql`
- `20261109150003_enrich_exercise_catalog_03_of_11.sql`
- `20261109150004_enrich_exercise_catalog_04_of_11.sql`
- `20261109150005_enrich_exercise_catalog_05_of_11.sql`
- `20261109150006_enrich_exercise_catalog_06_of_11.sql`
- `20261109150007_enrich_exercise_catalog_07_of_11.sql`
- `20261109150008_enrich_exercise_catalog_08_of_11.sql`
- `20261109150009_enrich_exercise_catalog_09_of_11.sql`
- `20261109150010_enrich_exercise_catalog_10_of_11.sql`
- `20261109150011_enrich_exercise_catalog_11_of_11.sql`
Rows parsed: 2670
Rows with at least one update: 2563
Chunk size: 250

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
