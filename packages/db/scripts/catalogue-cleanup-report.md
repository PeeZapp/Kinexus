# Exercise catalogue cleanup report
Generated: 2026-11-12T15:04:14.281Z
Migration: [`20261112103000_exercise_catalog_cleanup.sql`](../supabase/migrations/20261112103000_exercise_catalog_cleanup.sql)
Rows (allowed sources): 2668
Id-guarded updates: 546
Name-resolved Part 2 fixes: 7
Name-keyed rescues (avoid hide): 31
Hidden (status=hidden, both null category + empty equipment): 26
Live DB (verified earlier): null category 141, empty equipment 406.
Simulated baseline below = seed catalogue + enrich inference.
## Before / after (post-enrich baseline → cleanup round 2)
| Metric | Before | After (active only) |
| --- | ---: | ---: |
| null category | 144 | 50 |
| empty equipment | 405 | 120 |
| distinct equipment values | 35 | 28 |
## Rule hits
| Rule | Hits |
| --- | ---: |
| equipment_synonym | 132 |
| specific_fix | 50 |
| name_equipment_mismatch | 129 |
| empty_equipment_peer | 3 |
| empty_equipment_name | 8 |
| empty_equipment_bodyweight | 209 |
| category_contradiction | 42 |
| null_category_peer | 2 |
| null_category_keyword | 27 |
## Category contradictions fixed: 42
- Ankle On The Knee: Chest → Legs
- band squat row: Legs → Back
- Barbell Reverse-Grip Incline Bench Row: Chest → Back
- Bent-over Lateral Raises: Chest → Shoulders
- Biceps with TRX: Core → Biceps
- bodyweight kneeling triceps extension: Chest → Triceps
- cable incline bench row: Chest → Back
- cable rope extension incline bench row: Chest → Back
- cable squat row (with rope attachment): Legs → Back
- Cable Triceps Press: Chest → Triceps
- Crunches: Chest → Core
- Crunches With Legs Up: Shoulders → Core
- Dumbbell Crunches: Chest → Core
- Dumbbell One-Arm Triceps Extension: Chest → Triceps
- Dumbbell Reverse-Grip Incline Bench Single-Arm Row: Chest → Back
- Dumbbell Reverse-Grip Incline Bench Two-Arm Row: Chest → Back
- Dumbbell Single-Arm Triceps Extension (On Bench): Chest → Triceps
- Incline Chest-Supported Dumbbell Row: Chest → Back
- Incline Crunches: Chest → Core
- inverted row on bench: Chest → Back
- Low Cable Triceps Extension: Chest → Triceps
- Lying Triceps Extensions: Chest → Triceps
- Lying Triceps Press: Chest → Triceps
- Machine Side Lateral Raises: Chest → Shoulders
- One Arm Pronated Dumbbell Triceps Extension: Chest → Triceps
- One Arm Supinated Dumbbell Triceps Extension: Chest → Triceps
- Overhead Triceps Extension: Chest → Triceps
- Push-Ups - Close Triceps Position: Chest → Triceps
- Reverse Triceps Bench Press: Chest → Triceps
- Seated Bent-Over One-Arm Dumbbell Triceps Extension: Chest → Triceps
- Seated Bent-Over Two-Arm Dumbbell Triceps Extension: Chest → Triceps
- Seated Biceps: Chest → Biceps
- Seated Triceps Press: Chest → Triceps
- Speed Band Overhead Triceps: Chest → Triceps
- Standing Low-Pulley One-Arm Triceps Extension: Chest → Triceps
- Standing One-Arm Dumbbell Triceps Extension: Chest → Triceps
- Standing Side Crunches: Shoulders → Core
- Straight Bar Bench Mid Rows: Chest → Back
- triceps dip (bench leg): Chest → Triceps
- Triceps on Machine: Chest → Triceps
- triceps press: Chest → Triceps
- Triceps push up: Chest → Triceps
## Still unresolved before hide: 196
## Still unresolved after hide (active rows only): 170
Unresolved names ( `[hidden]` = both gaps → status=hidden ):
- Adductor/Groin (equipment=∅, category=Legs)
- Ankle On The Knee (equipment=∅, category=Legs)
- Ankle Roll (equipment=∅, category=Legs)
- Bear crawl pull through (equipment=dumbbell, category=null)
- Blackroll (equipment=foam roll, category=null)
- Blaze (equipment=∅, category=Cardio)
- Bus Drivers [hidden] (equipment=∅, category=null)
- Butterfly Reverse [hidden] (equipment=∅, category=null)
- Butterfly Sit Up (equipment=∅, category=Chest)
- Butterfly Superman (equipment=∅, category=Back)
- Carioca Quick Step (equipment=∅, category=Legs)
- Claps over the head (equipment=∅, category=Shoulders)
- Clean and Jerk OL (equipment=∅, category=Full Body)
- Close-grip Lat Pull Down (equipment=∅, category=Back)
- Controlled Kegels [hidden] (equipment=∅, category=null)
- Cool-Down Swim (equipment=∅, category=Cardio)
- Core Rotation (equipment=bodyweight, category=null)
- Cross-Body Cable Y-Raise (equipment=cable, category=null)
- Curl  - With Shoulder Elevated (equipment=∅, category=Shoulders)
- Curl De Muñeca Con Barra (equipment=∅, category=Biceps)
- Cycling cardio session (equipment=∅, category=Cardio)
- DB Wrist Extension (equipment=dumbbell, category=null)
- Deadbug (equipment=∅, category=Core)
- Diagonal Shoulder Press (equipment=∅, category=Shoulders)
- Double-Leg Abdominal Press (equipment=∅, category=Core)
- Dumbbell farmer's carry (equipment=dumbbell, category=null)
- Dumbbell Hang Power Cleans (equipment=dumbbell, category=null)
- dumbbell lying pronation (equipment=dumbbell, category=null)
- dumbbell lying pronation on floor (equipment=dumbbell, category=null)
- dumbbell lying supination (equipment=dumbbell, category=null)
- dumbbell lying supination on floor (equipment=dumbbell, category=null)
- Dumbbell Seated Single-Arm Rotate (equipment=dumbbell, category=null)
- Dumbbells on Scott Machine (equipment=dumbbell, category=null)
- Dynamic side hold (equipment=kettlebell, category=null)
- Easy Continuous Swim (Freestyle) (equipment=∅, category=Cardio)
- Elbows Back (equipment=∅, category=Chest)
- Elliptical (equipment=∅, category=Cardio)
- Exercise Band Dorsiflexion (equipment=resistance band, category=null)
- Fire Hydrant Circles (equipment=bodyweight, category=null)
- FlexBar Tyler Twist (equipment=∅, category=Core)
- … and 156 more
## Distinct equipment after (active rows)
- EZ bar
- ab wheel
- assisted
- barbell
- bodyweight
- bosu ball
- cable
- dumbbell
- elliptical machine
- foam roll
- hammer
- kettlebell
- leverage machine
- machine
- medicine ball
- other
- resistance band
- rope
- ski ergometer
- sled machine
- smith machine
- stability ball
- stationary bike
- stepmill machine
- tire
- trap bar
- upper body ergometer
- weighted
