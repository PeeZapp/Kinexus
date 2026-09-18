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
| `recipesForSlot(recipes, slot)` | Drops `isComponent` and `excludedFromAuto`; snack slots are interchangeable; lunch recipes can fill dinner |
| `nutritionFitScore(recipe, target)` | Lower is better |
| `recipeProteinKind` / `PROTEIN_KINDS` | Ingredient-inferred protein for swap filters |
| `pickRandomSwapRecipe` / `filterRecipesForSwap` | Similar-nutrition random swap (±20% calories/protein) that avoids recent picks |
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

## Stash (`stash` namespace or named exports)

| Export | Notes |
|--------|--------|
| `StashProduct`, `StashList`, `StashListVisibility` | Family lists with household / private / people sharing |
| `listTree`, `productsForList`, `canViewList`, `canManageLists`, `listShareLabel` | Nested lists and access |
| `listTree`, `productsForList`, `descendantListIds`, `wouldCreateListCycle` | Nested lists |
| `SavedLink`, `SavedLinkCollection`, `canonicalizeUrl`, `inferLinkType`, `filterSavedLinks` | Saved URL library |
| `formatMoney`, `parseMoney`, `isSale` | Price display |

## Finances (`finances` namespace or named exports)

| Export | Notes |
|--------|--------|
| `FinanceAccount`, `FinanceAccountKind`, `ASSET_KINDS` / `LIABILITY_KINDS` | Household assets and debts; class is derived from kind |
| `netWorth`, `withListedShares`, `withCollectibles`, `groupAccounts`, `canManageFinances` | Family net worth; owners/admins manage |
| `FinanceBudget`, `FinanceBudgetLine`, `FinanceBudgetTxn`, `DEFAULT_BUDGET_SEED` | One standing household budget; planned amounts apply every month; imported transactions can be reclassified |
| `budgetTotals`, `monthStartIso`, `shiftMonth` | Planned vs typical leftover |
| `parseBankStatement`, `draftBudgetFromStatement` | CSV / OFX / QIF / pasted statement → average monthly category totals, with questions for unknown merchants |
| `FinanceSharePortfolio`, `FinanceShareHolding`, `holderIdKind` | ASX portfolios; HIN/SRN stored for a future registry feed |
| `parseShareImport` | CommSec-style CSV, pasted CHESS statements, and `CBA,50,90` lines |
| `portfolioTotals`, `normalizeAsxSymbol`, `yahooAsxSymbol` | Market value from units × last price |
| `FinanceCollectible`, `COLLECTIBLE_KINDS` | LEGO/minifigs via BrickEconomy or Brickset; cards, games, comics, Funko, coins via PriceCharting; vinyl via Discogs; sneakers/watches often need a manual value |

Not in this package: calendar, custom todo lists, outfits, daily nutrition log, barcode/photo logging, alerts, ads, live bank feeds, CHESS/HIN lookups, or tax filing. Statement CSV/OFX/QIF upload is a one-shot import, not a bank login.
