# @kinexus/domain

Pure TypeScript. No React, React Native, or Firebase.

## Household

| Export | Kind |
|--------|------|
| `Household`, `HouseholdMember`, `HouseholdPerson`, `HouseholdInvite`, `Profile`, `HouseholdRole`, `PersonType` | types |

## Meals (`meals` namespace or named exports)

### Types

| Export | Notes |
|--------|--------|
| `MealSlotKey`, `Day`, `DAYS`, `DAY_LABELS`, `MEAL_SLOTS` | Week/slot constants |
| `Ingredient`, `Recipe` | `householdId` is null for catalog seeds; `imageUrl` is a representative photo; `imageFlagged` means an editor marked the photo wrong |
| `NutritionGoals`, `NutritionGoalPreset` | Goals used by generate-plan (not a food log) |
| `MealSlot`, `MealPlan` | Row-level slots, not a Firestore blob |
| `DerivedShoppingItem`, `ShoppingRecipeSource` | Shopping list lines before persistence |
| `PersonDietary` | `{ dietary?: string[] }` for household people |

### Generate plan

| Export | Notes |
|--------|--------|
| `CORE_SLOTS` / `OPTIONAL_SLOTS` / `SLOT_ASSUMED` / `ALL_MEAL_SLOTS` | Breakfast/lunch/dinner are assumed if unselected; snacks/dessert are not |
| `slotTarget(slot, selectedSlots, goals)` | Per-slot calorie/protein budget |
| `recipesForSlot(recipes, slot)` | Drops `isComponent` and `excludedFromAuto`; snack slots are interchangeable |
| `nutritionFitScore(recipe, target)` | Lower is better |
| `generateMealPlan(selectedSlots, existingSlotKeys, recipes, goals, options?)` | `existingSlotKeys` use `mealSlotRecordKey(day, slot)` (`monday_dinner`). Optional `options.random` for tests |

### Shopping

| Export | Notes |
|--------|--------|
| `parseAmount` / `combineAmounts` / `deduplicateIngredients` | Merge `"50g" + "100g"` → `"150g"` |
| `shoppingFromPlan({ plan, recipes })` | Active slots only; merged amounts + recipe sources |
| `resolveShoppingCategory` / `groupShoppingByCategory` / `SHOPPING_CATEGORIES` | Aisle grouping |

### Dietary (generate-plan constraints)

| Export | Notes |
|--------|--------|
| `DIETARY_OPTIONS` | Restriction catalog (no UI classes) |
| `hasConflict(recipe, restriction)` | Ingredient/macro conflict |
| `filterRecipesForPeople(recipes, people)` | Union of people `dietary[]` |
| `filterRecipesByDietary(recipes, restrictions)` | Direct restriction list |

Not in this package: calendar, custom lists, daily nutrition log, barcode/photo logging, alerts, ads.
