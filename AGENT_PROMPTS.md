# Kinexus — Agent Prompt Series

Use these in a **new Cursor agent** with workspace `C:\Apps\Kinexus`.

**Rules for every session**

1. Read `SUITE_REWRITE_PLAN.md` first (or re-read the relevant section).
2. Work **only** inside `C:\Apps\Kinexus` unless a prompt says to *read* another app path.
3. **Never** modify `C:\Apps\huddle`, `C:\Apps\Stashd`, or `C:\Apps\RemixFit`.
4. Stop at the phase acceptance checklist; do not start the next phase unless asked.
5. Prefer implementing over documenting unless the prompt asks for docs.

---

## Prompt 0 — Create GitHub repo + monorepo scaffold

```
You are building Kinexus from scratch in C:\Apps\Kinexus.

Read SUITE_REWRITE_PLAN.md and README.md in this folder completely before doing anything.

## Goal (Phase 0 only)
1. Initialize git if needed and create the GitHub repo PeeZapp/Kinexus (same account as PeeZapp/huddle). Push this folder as the initial commit including the existing plan docs.
2. Scaffold a pnpm monorepo:
   - apps/kinexus — Expo SDK (current stable) + Expo Router, targets iOS, Android, and web
   - packages/domain — empty package with tsconfig ready for pure TS
   - packages/db — placeholder for Supabase migrations
   - packages/api — placeholder for AI/scrape handlers
3. App shell requirements:
   - Auth placeholder screen (Google button can be stubbed until Supabase keys exist; structure the client for Supabase Auth)
   - After “signed in” (dev bypass OK if env missing): app chrome with FOUR modules — Meals, Stash, Nutrition, Train
   - WEB DESKTOP: sidebar navigation, polished wide layout
   - NATIVE MOBILE: bottom tabs, mobile-first layout
   - WEB DEV ONLY: if EXPO_PUBLIC_ENABLE_MOBILE_PREVIEW=1, show a toggle that switches the web app into mobile layout inside a phone frame with a clear DEV PREVIEW banner. Default off for production builds.
   - Meals route: simple “Meals coming next” placeholder
   - Stash / Nutrition / Train: empty shell screens with module name + one-line description
4. Add .env.example with the keys listed in the plan. Add .gitignore suitable for Expo/Node.
5. Root README: how to install (pnpm), run web, run Expo, where plan docs live.
6. Do NOT implement meal planning domain yet. Do NOT connect real Supabase until keys are available — leave clear TODOs.

## Acceptance
- pnpm install works
- Web dev server shows desktop shell
- Mobile preview toggle works on web when env enabled
- Expo starts for native
- GitHub repo PeeZapp/Kinexus exists with plan docs + scaffold pushed
- No changes under C:\Apps\huddle, Stashd, or RemixFit
```

---

## Prompt 1 — Supabase project wiring + Google Auth

```
Continue Kinexus Phase 1 (Auth + Household foundation). Workspace: C:\Apps\Kinexus. Read SUITE_REWRITE_PLAN.md sections 4–6 and 9.

## Constraints
- Only modify C:\Apps\Kinexus
- Do not port Meals domain yet
- Household invites redesigned (no FP-XXXX as security model)

## Tasks
1. Add Supabase client in the Expo app; document exact Google OAuth + redirect setup steps in README (local web, Vercel, Expo).
2. Implement real Google sign-in with Supabase Auth (web + native as far as Expo allows). If native Google needs extra config, implement web fully and stub/document native gaps clearly.
3. SQL migrations in packages/db:
   - profiles (id = auth.uid())
   - households
   - household_members (roles: owner | admin | member)
   - household_invites (token hash, expiry, role)
   - household_people (non-login planning personas: name, type, dietary[])
   - RLS: users only see/write households they belong to; invite accept via secure RPC
4. Settings / onboarding UI:
   - Create household
   - Invite member (copy link / token UX)
   - Accept invite
   - List members + people
5. Gate Meals/Stash/Nutrition/Train behind: signed in AND member of a household (with clear empty states).

## Acceptance
- Migrations apply cleanly (document supabase db commands)
- RLS verified with two users joining one household via invite (manual test steps in README)
- Desktop + mobile settings screens (respect experience mode)
- Still no meal planner features
```

---

## Prompt 2 — Port Meals domain brain into packages/domain

```
Continue Kinexus Phase 2. Workspace: C:\Apps\Kinexus. Read SUITE_REWRITE_PLAN.md section 3 and 11.

## Goal
Port the meal-planning DOMAIN LOGIC from Huddle into packages/domain as pure TypeScript. No UI. No Firebase.

## Read-only sources (DO NOT MODIFY)
- C:\Apps\huddle\artifacts\huddle\src\lib\types.ts
- C:\Apps\huddle\artifacts\huddle\src\lib\generate-plan.ts
- Related amount/shopping helper modules under C:\Apps\huddle\artifacts\huddle\src\lib\ (discover and port what shopping-from-plan needs)

## Port
1. Trimmed types: meals, recipes, ingredients, shopping items, nutrition goals used by generate-plan, dietary — EXCLUDE calendar, lists, nutrition daily log, alerts.
2. generate-plan.ts behaviour: core vs optional slots, slot targets, recipe matching, plan generation — preserve logic; clean namespaced exports.
3. shopping-from-plan derivation (category grouping, merge amounts if present).
4. Unit tests (vitest) for generate-plan: budgeting, snack optional behaviour, eligibility filters (is_component, excluded_from_auto).

## Acceptance
- packages/domain builds and tests pass
- No React / RN imports in domain
- Brief DOMAIN.md listing public API
```

---

## Prompt 3 — Meals schema, seed data, sync + offline outbox

```
Continue Kinexus Phase 3. Workspace: C:\Apps\Kinexus. Read SUITE_REWRITE_PLAN.md sections 4.4, 6, 10.

## Goal
Persist Meals data in Supabase with sync-friendly rows and limited offline editing.

## Tasks
1. Migrations: nutrition_goals, recipes, recipe_favourites, meal_plans, meal_slots, shopping_items — all household-scoped with RLS.
2. Prefer meal_slots as individual rows (day + slot_key), not one JSON blob for the whole week.
3. Seed system/catalog recipes (port seed content from Huddle recipe seeds — read-only copy).
4. App data layer: TanStack Query + Supabase; Realtime on meal_slots and shopping_items for the active household.
5. Offline outbox: when offline, allow local mutations to meal_slots (add/edit/clear); queue and flush on reconnect. Block AI/import with clear UX when offline.
6. Wire packages/domain types to DB mappers.

## Acceptance
- Two clients see slot updates via Realtime when online
- Airplane-mode style test: edit slot offline, come online, syncs
- RLS prevents cross-household reads
- No Meals UI polish required yet — hooks/API can be exercised via minimal debug screen OR early Plan screen WIP
```

---

## Prompt 4 — Meals UI dual experience (Plan, Generate, Shopping, Recipes)

```
Continue Kinexus Phase 4. Workspace: C:\Apps\Kinexus. Read SUITE_REWRITE_PLAN.md sections 3.1, 3.3, 4.3.

## Goal
Ship full Meals module UI with SEPARATE desktop and mobile presentations. Rebuild UI — do not paste Huddle React DOM. Behaviour reference from Huddle pages (read-only).

## Read-only UX references
- C:\Apps\huddle\artifacts\huddle\src\pages\Plan.tsx
- C:\Apps\huddle\artifacts\huddle\src\pages\GeneratePlan.tsx
- C:\Apps\huddle\artifacts\huddle\src\pages\Shopping.tsx
- C:\Apps\huddle\artifacts\huddle\src\pages\Recipes.tsx
- C:\Apps\huddle\artifacts\huddle\src\pages\RecipeDetail.tsx
- C:\Apps\huddle\artifacts\huddle\src\pages\ImportRecipe.tsx

## Features
1. Plan: week navigation, slots, hide/show slot, assign recipe, clear, calorie hints if available
2. Generate Plan: select slots, edit goals (calories/protein etc), dietary constraints from household_people, preview, accept/swap — uses packages/domain generate-plan; AI optional assist only if API ready
3. Shopping: generate from plan, check-off, categories
4. Recipes: browse library + household recipes, detail, favourites, import (online)
5. Desktop layouts ≠ mobile layouts (PlanDesktop vs PlanMobile pattern or equivalent)
6. Respect useExperienceMode including web mobile preview

## Explicitly OUT
- Calendar, Lists, Nutrition food log, ads, notifications

## Acceptance
- All Meals flows work on desktop web
- Same flows work in mobile layout (native or web preview)
- Generate Plan uses goals/dietary without any daily food-log UI
- Shopping linked to plan
```

---

## Prompt 5 — AI API (Anthropic + DeepSeek) + recipe scrape

```
Continue Kinexus Phase 5a (API). Workspace: C:\Apps\Kinexus.

## Goal
Server-side AI + scrape for Meals, with provider switch.

## Tasks
1. Implement packages/api (or Vercel/Expo API routes) with JWT verification via Supabase.
2. AiClient interface with Anthropic and DeepSeek implementations; AI_PROVIDER env selects default.
3. Endpoints inspired by Huddle (read-only reference):
   - C:\Apps\huddle\artifacts\api-server\src\routes\ai.ts
   - C:\Apps\huddle\artifacts\api-server\src\routes\scrape.ts
   Adapt for recipe import + any generate assist. DO NOT port calendar or nutrition meal-photo/barcode logging.
4. Wire Import Recipe + any Generate assist in the app.
5. Document env vars and provider switching in README.

## Acceptance
- Import-from-URL works with server scrape/AI
- Switching AI_PROVIDER does not require code changes at call sites
- Keys never exposed to the client bundle
```

---

## Prompt 6 — Harden, deploy, Meals MVP checklist

```
Continue Kinexus Phase 5b (Harden + deploy). Workspace: C:\Apps\Kinexus. Read SUITE_REWRITE_PLAN.md section 13.

## Goal
Make Meals MVP shippable on web; prepare mobile builds.

## Tasks
1. Vercel deploy for web; document production env + Supabase redirect URLs
2. EAS project config (eas.json) for development/preview; document how to run
3. Polish empty shells for Stash / Nutrition / Train so they feel intentional
4. Error/empty/offline states consistent
5. Walk the Definition of Done checklist in section 13 and fix gaps
6. Update README with architecture diagram summary and local/prod runbooks

## Acceptance
- Section 13 checklist completed (mark done in SUITE_REWRITE_PLAN.md or a CHECKLIST.md)
- Production web URL works with Google auth + household + meals
- No monetization, ads, or notifications added
```

---

## Prompt 7 — Stash module (after Meals MVP)

```
Begin Kinexus Phase 6 — Stash module. Workspace: C:\Apps\Kinexus.

Read SUITE_REWRITE_PLAN.md. Meals must already be MVP-complete.

## Goal
Rebuild a wishlist module (Stash). NEW UI. Reuse ideas and data-model concepts from Stashd — do not copy the Stashd UI wholesale and do NOT modify Stashd.

## Read-only reference
- C:\Apps\Stashd\Stashd\ (especially firestore data shapes: products, lists, list-product links, sharing)

## Tasks
1. Design Postgres schema for Stash under same households + RLS
2. Dual UX (desktop + mobile) consistent with Kinexus shell
3. Core flows: lists, products, add to list, basic share-within-household first
4. Deep link/nav handoff placeholder from Meals if natural (optional)

## Acceptance
- Stash usable end-to-end for one household
- Stashd repo untouched
```

---

## Prompt 8 — Nutrition module (ground up)

```
Begin Kinexus Phase 7 — Nutrition. Workspace: C:\Apps\Kinexus.

## Goal
Build Nutrition from scratch (daily food log, etc.). Do NOT port Huddle Nutrition.tsx.

Integrate with existing Meals nutrition_goals / generate-plan goals where sensible. Optional: “add planned meal to log” handoff later in this phase or a follow-up.

## Constraints
- Dual UX desktop/mobile
- Same Supabase household RLS patterns
- Anthropic/DeepSeek via existing AI interface if food analysis is needed
- No ads/monetization

## Acceptance
- Daily logging works; goals visible; does not break Meals generate-plan
- Huddle untouched
```

---

## Prompt 9 — Train module (RemixFit ideas)

```
Begin Kinexus Phase 8 — Train. Workspace: C:\Apps\Kinexus.

## Goal
Rebuild exercise/training module. NEW UI. Reuse ideas/models from RemixFit read-only.

## Read-only reference
- C:\Apps\RemixFit\RemixFit\
- C:\Apps\RemixFit\RemixFit\mobile\ for mobile UX ideas only

## Tasks
1. Schema + RLS under households
2. Exercise library approach (don’t blindly dump huge static files without a plan — design import/seed strategy)
3. Dual UX; link out to Nutrition later if straightforward

## Acceptance
- Core workout planning/logging usable
- RemixFit repo untouched
```

---

## Meta prompt — Resume / stuck

```
Workspace: C:\Apps\Kinexus. Read SUITE_REWRITE_PLAN.md and summarize:
1) Which phase we appear to be in
2) What is done vs missing vs broken
3) The single next concrete task
Then implement ONLY that next task unless I say otherwise.
Do not modify Huddle, Stashd, or RemixFit.
```

---

## Meta prompt — Amend the plan

```
Update C:\Apps\Kinexus\SUITE_REWRITE_PLAN.md to reflect this change: <DESCRIBE CHANGE>.
Also update AGENT_PROMPTS.md if a phase prompt must change.
Do not start implementing the change until I confirm.
```

---

## Suggested session cadence

| Session | Prompt |
|---------|--------|
| 1 | Prompt 0 |
| 2 | Prompt 1 |
| 3 | Prompt 2 |
| 4 | Prompt 3 |
| 5 | Prompt 4 |
| 6 | Prompt 5 |
| 7 | Prompt 6 |
| later | Prompts 7–9 |

After Prompt 0, create the Supabase project and Google Cloud OAuth credentials yourself (or ask the agent to list exact console clicks), put secrets in `.env.local` (never commit), then continue Prompt 1.
