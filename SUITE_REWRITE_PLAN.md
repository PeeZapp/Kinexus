# Kinexus — Full Suite Rewrite Plan

**Status:** Meals MVP — Phase 5b (harden + deploy). Product checklist: [CHECKLIST.md](./CHECKLIST.md).  
**Workspace:** `C:\Apps\Kinexus`  
**GitHub:** `https://github.com/PeeZapp/Kinexus` (create in Phase 0)  
**Date locked:** 2026-09-04  

This document is the source of truth for building Kinexus. A new Cursor agent should follow it and the prompts in `AGENT_PROMPTS.md`. Do **not** modify Huddle, Stashd, or RemixFit to create Kinexus — they remain standalone products.

---

## 1. Vision

**Kinexus** is one professional suite:

| Module | Codename in nav | v1 | Later |
|--------|-----------------|----|-------|
| Meals | Meals | Full (ported from Huddle core) | Iterate |
| Wishlist | Stash | Empty shell | Rebuild UI; reuse Stashd ideas/models |
| Nutrition | Nutrition | Empty shell | Rebuild food log / tracker from scratch |
| Exercise | Train | Empty shell | Rebuild; reuse RemixFit ideas/models |

**Clients**

- **One App Store / Play Store binary** (Expo) — mobile-first UI dedicated to phones.
- **One web app** (Expo Router web) — polished for desktop and tablet.
- Shared account, shared household, modules talk to each other (handoff via in-app navigation / deep links).
- **No monetization in early phases** — ship product quality first.
- **Clean break** on data — no Firebase migration from Huddle/Stashd/RemixFit.

**Device UX rule (non-negotiable)**

- Web on computer/tablet = desktop/tablet layouts (wide nav, multi-column plan, dense tables where useful).
- Native mobile = dedicated mobile layouts (thumb reach, bottom nav, sheet patterns) — **not** a shrunk desktop page.
- **Dev-only preview toggle** on web: “Mobile preview” that renders the mobile navigation/layout inside a phone frame on desktop for testing. Must be stripped or gated so it never ships to production users (env flag / `__DEV__` / `EXPO_PUBLIC_ENABLE_MOBILE_PREVIEW`).

---

## 2. Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Name | **Kinexus** |
| 2 | Repo path | `C:\Apps\Kinexus` |
| 3 | GitHub | PeeZapp / **Kinexus** (new repo; do not destroy existing apps) |
| 4 | Stack clients | **Expo + Expo Router** for iOS, Android, **and** web |
| 5 | Backend SoT | **Supabase** (Auth, Postgres, Realtime, Storage) |
| 6 | Region | Prefer **`ap-southeast-2` (Sydney)** unless latency testing says otherwise; APAC-local |
| 7 | Hosting web/API | **Vercel** for web (+ serverless/edge API routes as needed); Supabase hosted |
| 8 | AI | **Anthropic** primary; design provider interface for **DeepSeek** as cheaper alternate |
| 9 | Auth day-1 | **Google** (add Apple later before iOS social-login compliance if required) |
| 10 | Offline day-1 | **Limited**: local meal plan edits + manual slot fills when offline; no AI/scrape/prices/sync-until-online |
| 11 | Household | **Redesign invites** from day 1 (not FP-XXXX guessable codes as sole tenancy) |
| 12 | v1 modules | Meals **full** + **empty shells** for Stash / Nutrition / Train |
| 13 | Module order after Meals | Stashd ideas → Nutrition rebuild → Train (RemixFit ideas) |
| 14 | Port style for Stash/Train | Rebuild UI; reuse ideas + data models only |
| 15 | Monetization | None until product is fully working as desired |
| 16 | Ads / notifications / PWA install push | **Out** of Kinexus |
| 17 | Calendar / Lists / Health tracker UI from Huddle | **Out** — rebuild later from scratch |
| 18 | Generate Plan health inputs | **Keep** dietary prefs, goals/macros, member constraints — **not** the daily food-log tracker |
| 19 | Shopping | **Keep** — linked to plan |
| 20 | Standalone apps | Huddle, Stashd, RemixFit stay alive; Kinexus is additive |

---

## 3. Scope from Huddle — keep vs cut

### 3.1 Keep (port domain logic + rebuild UI in Expo)

| Area | Huddle references (read-only) | Notes |
|------|-------------------------------|-------|
| Domain types | `artifacts/huddle/src/lib/types.ts` | Meal slots, recipes, shopping, family member dietary — adapt; drop calendar/list/nutrition-log types |
| Generate plan engine | `artifacts/huddle/src/lib/generate-plan.ts` | Calorie/protein slot budgeting, recipe matching — **high value, port carefully** |
| Amount / shopping utils | `artifacts/huddle/src/lib/*` (amount utils, shopping derivation) | Keep shopping-from-plan behaviour |
| Seed recipes | recipe seed data in huddle | Port as seed/migration or JSON import |
| Plan week UI behaviour | `pages/Plan.tsx` | Slots, hide slot, swap, eaten_by optional later |
| Generate Plan UI flow | `pages/GeneratePlan.tsx` | Goals editable, preview, swap — rebuild UI, keep flow |
| Shopping | `pages/Shopping.tsx` | Categories, check-off, generate from plan |
| Recipes library | `pages/Recipes.tsx`, `RecipeDetail.tsx`, `ImportRecipe.tsx` | Favourites, import, community share — redesign household-scoped sharing |
| Price / costing helpers | `pages/PriceSettings.tsx` + API `prices` | Optional in Meals v1; can phase as Meals v1.1 |
| Auth patterns | Google sign-in concepts | Reimplement on Supabase Auth Google |
| Family/profile concepts | members, dietary, country/currency | **New invite model**; keep member + dietary fields |
| AI proxy pattern | `artifacts/api-server/src/routes/ai.ts`, `scrape.ts` | New API with Anthropic + DeepSeek providers; scrape for recipe import |
| Sync ideas | `firestore-sync.ts`, `useMealPlanSync`, `useShoppingSync` | Do **not** copy Firestore blobs; redesign as Postgres rows + Realtime |

### 3.2 Cut (do not port)

- Calendar + Google Calendar OAuth (`Calendar.tsx`, `api-server/.../calendar.ts`)
- Custom Lists (`Lists.tsx`)
- Health / Nutrition tracker UI (`Nutrition.tsx`) — daily food log, barcode meal-photo flows for logging
- Alerts / notifications (`Alerts.tsx`)
- AdSense / ad slots
- PWA-only service worker strategy as product foundation (Expo handles targets)
- `family-plate` Expo fork (divergent schema — ignore)
- Unused Postgres chat scaffolding in huddle monorepo
- Firebase as SoT

### 3.3 Explicit: “health” that stays for Generate Plan

**In scope for Meals**

- Per-member or household dietary restrictions
- Calorie / protein (and related) **goals** used by `generate-plan`
- Slot assumptions / core vs optional meals
- Recipe macros for matching

**Out of scope until Nutrition module**

- Daily food diary / entries
- Weight log
- Barcode → log meal
- Meal photo → log meal  
  (Those APIs can exist later under Nutrition; do not block Meals v1)

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  apps/mobile+web (Expo Router)                              │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐ │
│  │  Meals   │ │  Stash   │ │ Nutrition  │ │    Train     │ │
│  │  (full)  │ │ (shell)  │ │  (shell)   │ │   (shell)    │ │
│  └────┬─────┘ └────┬─────┘ └─────┬──────┘ └──────┬───────┘ │
│       │            │             │               │         │
│  ┌────┴────────────┴─────────────┴───────────────┴───────┐ │
│  │  packages/ui  (web layout vs mobile layout primitives) │ │
│  │  packages/domain (pure TS: generate-plan, shopping…)   │ │
│  └───────────────────────────┬───────────────────────────┘ │
└──────────────────────────────┼─────────────────────────────┘
                               │
                    TanStack Query + Supabase JS
                               │
         ┌─────────────────────┴─────────────────────┐
         │              Supabase                      │
         │  Auth (Google) · Postgres · Realtime · Storage │
         └─────────────────────┬─────────────────────┘
                               │
         ┌─────────────────────┴─────────────────────┐
         │  API (Vercel serverless / Hono)             │
         │  /ai (Anthropic | DeepSeek) · /scrape · …  │
         │  Verifies Supabase JWT                      │
         └───────────────────────────────────────────┘
```

### 4.1 Monorepo layout (target)

```
C:\Apps\Kinexus\
  README.md
  SUITE_REWRITE_PLAN.md
  AGENT_PROMPTS.md
  package.json                 # pnpm workspace root
  pnpm-workspace.yaml
  turbo.json                   # optional
  apps/
    kinexus/                   # Expo Router app (iOS, Android, web)
      app/                     # file-based routes
        (auth)/
        (app)/
          _layout.tsx          # shell: web sidebar vs mobile tabs
          meals/
          stash/               # placeholder
          nutrition/           # placeholder
          train/               # placeholder
          settings/
      src/
        features/meals/
        features/shell/
        lib/supabase.ts
        lib/offline/
  packages/
    domain/                    # pure TS, no RN/React DOM
      src/
        meals/
          types.ts
          generate-plan.ts
          shopping-from-plan.ts
          amounts.ts
        household/
          types.ts
    db/                        # Supabase SQL migrations + typed client helpers
      supabase/migrations/
    api/                       # shared API route handlers or Hono app
      src/
        ai/provider.ts         # Anthropic | DeepSeek
        scrape/
    config/                    # eslint, tsconfig bases
  .env.example
```

### 4.2 Why Expo Router for web + native

- One React codebase with **platform files** (`*.web.tsx` / `*.native.tsx`) and/or explicit layout branches.
- Avoids Huddle’s “PWA + separate Expo fork” split brain.
- Vercel can host the web export; EAS for store builds.

### 4.3 Dual UX strategy

| Surface | Navigation | Layout |
|---------|------------|--------|
| Web desktop/tablet | Persistent sidebar + top context | Multi-column week plan, wider recipe grid |
| Native mobile | Bottom tabs (Meals, Stash, Nutrition, Train, More) | Single column, bottom sheets, large tap targets |
| Web “Mobile preview” (dev) | Same as native tabs inside ~390×844 frame | Forces mobile layout tree; banner “DEV PREVIEW” |

Implementation sketch:

- `useExperienceMode(): 'desktop' | 'mobile'`  
  - native → always `mobile`  
  - web → `desktop` by default; if `EXPO_PUBLIC_ENABLE_MOBILE_PREVIEW=1` and user toggles → `mobile`
- Feature screens accept layout via shared containers: `<MealsPlanScreen />` uses hooks; presentational splits in `PlanDesktop.tsx` / `PlanMobile.tsx`.

### 4.4 Offline day-1 (Meals only)

**Works offline**

- View last-cached week plan + recipes subset
- Add/edit/clear meal slots manually
- Queue mutations in local store (SQLite or async storage outbox)

**Requires online**

- Auth, invites, AI generate, recipe scrape/import, price refresh, sync flush, community/global recipe fetch

**Sync rule**

- Prefer **row-level** meal slots (or day documents), not one giant Firestore-style blob
- On reconnect: push outbox; pull Realtime/postgres changes; simple last-write-wins per slot with `updated_at` (improve later)

---

## 5. Household model (redesign)

Replace guessable `FP-XXXX` as the only security boundary.

### 5.1 Concepts

- **User** — Supabase Auth user (Google)
- **Profile** — display name, avatar, preferences
- **Household** — the shared tenancy (name, timezone, currency/country)
- **Membership** — user ↔ household with role: `owner` | `admin` | `member`
- **Invite** — email or magic link / one-time token (expiring), created by admin/owner; accepting joins membership
- **Household members (people)** — optional non-login people (kids) for dietary + planning, distinct from auth users

### 5.2 Security

- All meal/recipe/shopping rows keyed by `household_id`
- **RLS** on every table: access iff `auth.uid()` is active member
- Invites validated server-side / RPC; tokens hashed at rest

### 5.3 Migration note

No import from Huddle Firebase. Users create fresh households.

---

## 6. Data model (Meals v1 sketch)

Implement as Supabase SQL migrations in `packages/db`. Refine during Phase 2; do not invent Firebase-shaped mega-documents.

```
profiles
  id uuid PK = auth.uid()
  display_name, avatar_url, created_at, …

households
  id, name, country, currency, timezone, created_at

household_members          -- auth users in household
  household_id, user_id, role, joined_at

household_people           -- planning personas (may map to a user_id nullable)
  id, household_id, name, person_type, birthday, dietary text[]

household_invites
  id, household_id, token_hash, email nullable, role, expires_at, created_by, accepted_at

nutrition_goals            -- for generate-plan (not a food log)
  id, household_id, person_id nullable, calories, protein, carbs, fat, updated_at

recipes
  id, household_id nullable (null = system seed), …
  macros, ingredients jsonb, method jsonb, meal_slots, flags…

recipe_favourites
  user_id, recipe_id

meal_plans                 -- one row per household per week_start
  id, household_id, week_start, active_slots, updated_at

meal_slots                 -- row per day+slot (sync-friendly)
  id, meal_plan_id, day, slot_key, recipe_id, denormalized fields, hidden, updated_at

shopping_items
  id, household_id, week_start, name, amount, category, checked, metadata jsonb, updated_at
```

Community/global recipes: either `recipes.household_id IS NULL AND is_public` or separate `catalog_recipes` — decide in Meals implementation prompt; prefer clear RLS.

---

## 7. AI provider interface

```ts
// packages/api — conceptual
type AiProvider = 'anthropic' | 'deepseek';

interface AiClient {
  complete(input: { system?: string; prompt: string; json?: boolean }): Promise<string>;
}
```

- Env: `AI_PROVIDER=anthropic|deepseek`, plus provider keys
- Same routes: `/api/ai`, recipe-import assist, etc.
- Default Anthropic; DeepSeek switchable without rewriting call sites
- Never expose keys to the client

**Port from Huddle API (adapt, don’t copy calendar/nutrition-log):**

- General `/ai`
- `/scrape` for recipe URLs
- Prices refresh (optional phase)
- **Skip** barcode/meal-photo log endpoints until Nutrition module

---

## 8. Phased delivery

### Phase 0 — Repo, GitHub, scaffold
- Init git, create GitHub `PeeZapp/Kinexus`, pnpm monorepo, Expo Router app runs on web + Expo Go
- Supabase project created (manual or CLI), env templates
- Shell: auth gate (Google), desktop vs mobile nav chrome, module placeholders
- Dev mobile preview toggle on web
- Docs already in repo

### Phase 1 — Household + Auth solid
- Profiles, households, invites, RLS
- Settings: create/join household, members list
- No Meals domain yet beyond empty route

### Phase 2 — Domain package port (Meals brain)
- Port `generate-plan`, types (trimmed), shopping derivation, amount helpers into `packages/domain`
- Unit tests for generate-plan (first tests in the suite)
- No UI dependency

### Phase 3 — Meals data + sync
- Migrations for recipes, plans, slots, shopping
- Supabase client hooks + Realtime subscriptions
- Offline outbox for slot edits
- Seed recipe library

### Phase 4 — Meals UI (dual layout)
- Plan, Generate Plan, Shopping, Recipes, Recipe detail, Import
- Desktop and mobile presentations
- Wire AI scrape + generate via API

### Phase 5 — Harden Meals
- Invite flows polished, conflict behaviour documented
- EAS build profiles, Vercel web deploy
- README for local dev

### Phase 6 — Stash shell → real module
- Empty shell already exists; rebuild wishlist using Stashd **ideas/models** only (`C:\Apps\Stashd`)
- New UI; Postgres model inspired by lists/products/links

### Phase 7 — Nutrition module (ground up)
- Food log, goals integration with Meals generate-plan already present
- Deep links: “log this meal from plan” later

### Phase 8 — Train module
- Rebuild using RemixFit ideas (`C:\Apps\RemixFit`); link to Nutrition later

---

## 9. Hosting & env

### Supabase
- Project region: `ap-southeast-2` (Sydney) preferred
- Google OAuth provider configured
- Redirect URLs for local, Vercel preview, production, and Expo schemes

### Vercel
- Deploy `apps/kinexus` web export (or Expo web)
- API routes on Vercel (or `apps/api` package)
- Env: Supabase URL/anon key (public), service role **server only**, AI keys server only

### EAS (mobile)
- `eas.json` development / preview / production
- App Store / Play later — not blocking web Meals MVP

### Env template (illustrative)

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_ENABLE_MOBILE_PREVIEW=1
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=
DEEPSEEK_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server only
```

---

## 10. Quality bar

- TypeScript strict
- RLS enabled on all user data tables before Meals ships
- Domain logic unit-tested (`generate-plan` minimum)
- No ads, no notification spam, no calendar
- Do not delete or refactor Huddle/Stashd/RemixFit as part of Kinexus work
- Prefer small PRs / commits per phase
- Dual UX verified: desktop web ≠ mobile layout

---

## 11. Source inventory cheat sheet

### Huddle (port brain + behaviour)

```
C:\Apps\huddle\artifacts\huddle\src\lib\types.ts
C:\Apps\huddle\artifacts\huddle\src\lib\generate-plan.ts
C:\Apps\huddle\artifacts\huddle\src\lib\firestore-sync.ts          # behaviour reference only
C:\Apps\huddle\artifacts\huddle\src\pages\Plan.tsx
C:\Apps\huddle\artifacts\huddle\src\pages\GeneratePlan.tsx
C:\Apps\huddle\artifacts\huddle\src\pages\Shopping.tsx
C:\Apps\huddle\artifacts\huddle\src\pages\Recipes.tsx
C:\Apps\huddle\artifacts\huddle\src\pages\RecipeDetail.tsx
C:\Apps\huddle\artifacts\huddle\src\pages\ImportRecipe.tsx
C:\Apps\huddle\artifacts\huddle\src\pages\Setup.tsx
C:\Apps\huddle\artifacts\huddle\src\pages\Family.tsx
C:\Apps\huddle\artifacts\huddle\src\pages\PriceSettings.tsx        # optional later
C:\Apps\huddle\artifacts\api-server\src\routes\ai.ts
C:\Apps\huddle\artifacts\api-server\src\routes\scrape.ts
C:\Apps\huddle\artifacts\api-server\src\routes\prices.ts           # optional later
```

### Explicitly ignore for Kinexus Meals

```
...\pages\Calendar.tsx
...\pages\Lists.tsx
...\pages\Nutrition.tsx
...\pages\Alerts.tsx
...\api-server\src\routes\calendar.ts
C:\Apps\huddle\artifacts\family-plate\   # entire divergent mobile app
```

### Later modules (read ideas only)

```
C:\Apps\Stashd\Stashd\          # wishlist
C:\Apps\RemixFit\RemixFit\      # exercise (+ mobile subfolder)
```

---

## 12. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Expo web feels “mobile-ish” on desktop | Dedicated desktop layouts + sidebar; preview toggle only for mobile chrome |
| Offline sync conflicts | Slot-level rows + outbox; document LWW; revisit later |
| Scope creep into Nutrition/Stash | Shells only until Meals Phase 5 done |
| AI cost | Provider switch to DeepSeek; cache; don’t call AI on every keystroke |
| Google OAuth redirect hell | Document redirect URL checklist in README early |
| Accidental edits to old apps | Agent rule: Kinexus workspace only; old apps read-only |

---

## 13. Definition of done — Meals MVP (end of Phase 5)

Tracked with notes in [CHECKLIST.md](./CHECKLIST.md).

- [x] Google sign-in works on web and Expo Go
- [x] Create household + invite member + RLS verified
- [x] Weekly plan CRUD with desktop and mobile UIs
- [x] Generate Plan using goals/dietary + recipe library
- [x] Shopping list generated from plan, check-off syncs
- [x] Recipes: browse, detail, favourite, import (online)
- [x] Limited offline: edit slots offline, sync when back
- [x] Stash / Nutrition / Train visible as polished placeholders
- [x] Dev mobile preview toggle on web only when enabled
- [ ] Deployed web on Vercel; Supabase project live
- [x] Huddle / Stashd / RemixFit untouched as products

---

## 14. How to use the agent prompts

Open `AGENT_PROMPTS.md`. Run **one prompt per agent session** (or one phase per session). Paste the prompt as the user message. After each phase, run the acceptance checklist before moving on.

If something conflicts with this plan, **this plan wins** unless you explicitly amend this file.
