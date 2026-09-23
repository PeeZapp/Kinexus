# Kinexus

Unified lifestyle suite (Meals · Lists · Money · Nutrition · Train) — **App Store + web**, one Expo binary, Supabase-backed.

Meals, Lists, and Money are the live v1 modules. Nutrition and Train are intentional placeholders. There is no monetization, ads, or notifications.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  apps/kinexus (Expo Router — iOS, Android, web)             │
│  Meals · Lists · Money (live)  ·  Nutrition · Train (shells)│
│  desktop sidebar vs mobile tabs (`useExperienceMode`)       │
└───────────────────────────┬─────────────────────────────────┘
        │  TanStack Query + Supabase JS (anon key only)
        ▼
┌───────────────────┐     ┌──────────────────────────────────┐
│  Supabase         │     │  packages/api (Hono)             │
│  Auth (Google)    │     │  JWT → /health /scrape /ai /quotes │
│  Postgres + RLS   │     │  /prices · Anthropic | DeepSeek  │
│  Realtime         │     │  Local :5301 · Vercel /api/*     │
└───────────────────┘     └──────────────────────────────────┘
```

| Path | Role |
|------|------|
| `apps/kinexus` | Expo Router app |
| `packages/domain` | Pure TS meals, lists, finances, and household logic |
| `packages/db` | SQL migrations |
| `packages/api` | Server-only scrape, AI import, and recipe pricing |

Web is a **static export** hosted on Vercel. Scrape/AI/prices run as Node serverless functions next to that export (`/api/health`, `/api/scrape`, `/api/ai`, `/api/prices/*`), also rewritten from `/health`, `/scrape`, `/ai`, `/prices/*` so local and production clients share the same paths. AI keys never go in `EXPO_PUBLIC_*`.

Definition of Done: [CHECKLIST.md](./CHECKLIST.md) · plan: [SUITE_REWRITE_PLAN.md](./SUITE_REWRITE_PLAN.md).

## Install

Requires Node 22.13+ and [pnpm](https://pnpm.io).

```bash
pnpm install
```

Copy env templates (do not commit real secrets):

```bash
copy .env.example apps\kinexus\.env
copy packages\api\.env.example packages\api\.env
```

On macOS/Linux: `cp .env.example apps/kinexus/.env` and `cp packages/api/.env.example packages/api/.env`.

`EXPO_PUBLIC_*` keys must live in `apps/kinexus/.env` so Expo can read them. Never put `SUPABASE_SERVICE_ROLE_KEY` or AI keys in the Expo env file.

## Local runbook

One command starts both processes: Expo on **5300**, API on **5301**.

1. Fill `apps/kinexus/.env` (`EXPO_PUBLIC_SUPABASE_*`, `EXPO_PUBLIC_WEB_URL=http://localhost:5300`, `EXPO_PUBLIC_API_URL=http://localhost:5301`). Optional: `EXPO_PUBLIC_ENABLE_MOBILE_PREVIEW=1`.
2. Fill `packages/api/.env` (same Supabase URL + anon key, `AI_PROVIDER`, `ANTHROPIC_API_KEY` or DeepSeek, `CORS_ORIGIN=http://localhost:5300`).
3. Apply SQL if this database is new (below).
4. From the repo root: `pnpm dev` (or `npm run dev`) → Metro QR on **5300**, API on [http://localhost:5301](http://localhost:5301).
5. For a browser tab, `pnpm web` also starts both and opens Expo web.

If 5301 is already in use, stop the leftover API first. `pnpm api` still starts the API alone.

Then press `i` / `a` in the Expo output, or scan the QR code. Native preview builds should set `EXPO_PUBLIC_API_URL` to the deployed Vercel origin (rewrites `/scrape` there).

```bash
pnpm ios
pnpm android
```

Static web export (what Vercel builds):

```bash
pnpm web:export
```

Output: `apps/kinexus/dist`.

## Production runbook (Vercel)

**One Vercel project** at the repository root. You do not need a second project for the API.

`vercel.json` installs the workspace, runs `pnpm api:build` (esbuild bundle so `@kinexus/domain` is inlined for Node), exports Expo web to `apps/kinexus/dist`, and serves the Hono API as a serverless function (`api/[...path].js` → `/api/*`). Rewrites map `/health`, `/scrape`, `/quotes`, `/collectibles/*`, and so on onto that function, so the website and API share one domain.

```bash
npx vercel login
npx vercel          # preview
npx vercel --prod   # production
```

Or connect [PeeZapp/Kinexus](https://github.com/PeeZapp/Kinexus) in the Vercel dashboard (Root Directory = repository root, Framework Preset = Other).

### Vercel environment

Set these in the project **Environment Variables** (Production + Preview). `EXPO_PUBLIC_*` are **build-time** — change them and redeploy.

| Variable | Scope | Value |
|----------|--------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | Build | `https://<project-ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Build | anon key |
| `EXPO_PUBLIC_WEB_URL` | Build | `https://<prod-domain>` |
| `EXPO_PUBLIC_API_URL` | Build | leave **empty** on web (same-origin `/scrape`) or set to `https://<prod-domain>` |
| `EXPO_PUBLIC_ENABLE_MOBILE_PREVIEW` | — | **do not set** in production |
| `SUPABASE_URL` | Runtime (API) | same as public URL |
| `SUPABASE_ANON_KEY` | Runtime (API) | same anon key (JWT verify, not service role) |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime (API) | service role — recipe cost writes + monthly refresh |
| `CRON_SECRET` | Runtime (API) | Vercel Cron `Authorization: Bearer` for `/api/prices/refresh` |
| `AI_PROVIDER` | Runtime | `anthropic` or `deepseek` |
| `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY` | Runtime | server only |
| `TMDB_API_KEY` | Runtime (API) | Lists → Watchlist search and where-to-watch |
| `CORS_ORIGIN` | Runtime | `https://<prod-domain>,http://localhost:5300` |
| `RESIDENTIAL_PROXY_URL` | Runtime (API) | Stashd home Pi proxy origin, no trailing slash |
| `RESIDENTIAL_PROXY_KEY` | Runtime (API) | Same bearer key as the Pi `PROXY_KEY` |
| `PLAYWRIGHT_ENABLED` | Runtime (API) | Playwright stealth backup. On locally; off on Vercel unless set to `1` |

After the first URL exists, add it to Google + Supabase (next section) and tick item 11 in [CHECKLIST.md](./CHECKLIST.md).

Smoke: `GET https://<prod-domain>/health` → `{"ok":true}`. Then Google sign-in → household → Meals.

## Family testing (PWA)

Native App Store / Play builds stay on EAS (next section). Until then, the Vercel site is an installable PWA so phones can use the mobile app chrome without a store build.

**Before you share the link:** turn off Vercel Deployment Protection on Production (otherwise Google sign-in hits an SSO wall), and add the production origin to Google + Supabase as in the OAuth section below.

**iPhone / iPad** — open the site in **Safari** (not Chrome), tap Share → **Add to Home Screen**, then open the Kinexus icon and sign in from there so the session lives in the installed app.

**Android** — open the site in **Chrome**, then **Install app** / Add to Home screen (or the in-app Install banner). Sign in from the installed icon.

Phones, tablets under 900px, and installed PWAs use the tab layout. Wide desktop browsers keep the sidebar. The service worker is production-only (it does not run during `pnpm web`) and is network-first so deploys are not stuck on a stale cache.

## EAS (development / preview)

Config: `apps/kinexus/eas.json`. Bundle IDs: `com.peezapp.kinexus`.

One-time, from the Expo app directory (requires an Expo account):

```bash
cd apps\kinexus
pnpm exec eas login
pnpm exec eas init
```

That writes `extra.eas.projectId` into `app.json`. Then:

```bash
pnpm eas:build:dev       # dev client (simulators / devices)
pnpm eas:build:preview   # internal distribution
```

Or from `apps/kinexus`: `pnpm exec eas build --profile development --platform ios`.

Preview/production profiles should use the same `EXPO_PUBLIC_SUPABASE_*` as web, plus `EXPO_PUBLIC_API_URL=https://<prod-domain>` and `EXPO_PUBLIC_WEB_URL` for invite links. Store builds are not required for Meals web MVP.

## Google OAuth + redirects

Kinexus uses **Supabase Auth with the Google provider**. The Expo client only holds the anon key. Google redirects to Supabase; Supabase redirects back to the app.

### 1. Google Cloud Console

1. Create (or reuse) an OAuth 2.0 **Web application** client.
2. Authorized JavaScript origins:
   - `http://localhost:5300`
   - `https://<your-vercel-prod-domain>`
   - `https://<your-vercel-preview-domain>` (optional)
3. Authorized redirect URIs — **only the Supabase callback**, not the Expo URL:
   - `https://<project-ref>.supabase.co/auth/v1/callback`
4. Copy the client ID and secret into the Supabase dashboard (next step).

Native iOS/Android OAuth client IDs (reversed client-id URL scheme, Google Sign-In SDK) are **not wired yet**. See [Native gaps](#native-gaps).

### 2. Supabase Auth

Dashboard → **Authentication** → **Providers** → **Google**: enable, paste Web client ID + secret.

Dashboard → **Authentication** → **URL configuration**:

| Setting | Value |
|---------|--------|
| Site URL (local) | `http://localhost:5300` |
| Site URL (production) | `https://<your-vercel-prod-domain>` |

Redirect URLs allow-list (add all that you use):

```
http://localhost:5300
http://localhost:5300/auth/callback
http://localhost:5300/invite/**
https://<your-vercel-prod-domain>
https://<your-vercel-prod-domain>/auth/callback
https://<your-vercel-prod-domain>/invite/**
https://<your-vercel-preview-domain>/**
kinexus://auth/callback
kinexus://invite/**
```

Expo Go uses a changing `exp://<lan-ip>:5300/--/auth/callback` URL. Add the exact value shown on the native sign-in screen when testing in Expo Go, or use a [dev client](https://docs.expo.dev/develop/development-builds/introduction/) with the `kinexus://` scheme.

### 3. App env

In `apps/kinexus/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_WEB_URL=http://localhost:5300
EXPO_PUBLIC_API_URL=http://localhost:5301
```

On Vercel, set the same `EXPO_PUBLIC_*` values (and `EXPO_PUBLIC_WEB_URL` to the production origin). Restart Metro after changing local env.

Preferred project region: `ap-southeast-2` (Sydney). Current project ref: `ojiixihanistuiyfbxxp`.

## Database migrations

SQL lives in `packages/db/supabase/migrations/`.

Install the CLI (already a `@kinexus/db` devDependency after `pnpm install`). From the repo root:

```bash
pnpm db:link
```

That runs `supabase link` in `packages/db`. Use project ref `ojiixihanistuiyfbxxp` (or your own). You will be prompted for the database password from Supabase → Project Settings → Database.

Apply migrations:

```bash
pnpm db:push
```

Equivalent:

```bash
pnpm --filter @kinexus/db exec supabase db push
```

If the CLI is not logged in: `pnpm --filter @kinexus/db exec supabase login`.

**SQL editor fallback:** paste these files in order into the Supabase SQL editor and run each **once**:

1. `packages/db/supabase/migrations/20260904120000_household_foundation.sql`
2. `packages/db/supabase/migrations/20260904140000_meals_schema.sql`
3. `packages/db/supabase/migrations/20260904141000_catalog_recipes.sql`
4. `packages/db/supabase/migrations/20260904143000_catalog_recipe_images.sql`
5. `packages/db/supabase/migrations/20260904144000_catalog_image_review.sql`

If a file was already applied, skip it. `ERROR: type "household_role" already exists` means Phase 1 is in place — do **not** re-run file 1; start at file 2 (`meals_schema`). `relation "nutrition_goals" already exists` means file 2 is done; run file 3 (catalog recipes), then file 4 (catalog images), then file 5 (catalog photo review). File 4 is safe to re-run; it only adds `recipes.image_url` and updates catalog rows. File 5 is also safe to re-run.

Existing Auth users created before this migration do not get a profile trigger replay. The app upserts `profiles` on sign-in. Optional backfill:

```sql
insert into public.profiles (id, display_name, email)
select id,
       split_part(coalesce(email, ''), '@', 1),
       email
from auth.users
on conflict (id) do nothing;
```

## Manual RLS test (two users, one household)

Use two Google accounts (or two browsers / one normal + one incognito).

1. Apply migrations. Confirm Google provider and redirect URLs (above).
2. **User A** at `http://localhost:5300` → Continue with Google → **Create household**.
3. Open **Settings**. Confirm A is listed as `owner`.
4. **Invite a member** → copy the link (or token). The raw token is shown once; only a SHA-256 hash is stored.
5. **User B** opens the invite URL (must be signed in with Google). Confirm the household name, then **Accept invite**.
6. User B should land in the app with the same household, role `member`, and see A + B in Members.
7. As User B, try creating an invite — it should fail (members cannot invite). As User A it should succeed.
8. In the Supabase SQL editor, as a sanity check (service role / postgres), confirm `household_members` has two rows for that `household_id` and `household_invites.accepted_at` is set.
9. Optional: from a third unauthenticated `curl` with the anon key, `select` on `households` must return empty (RLS).

Meals / Lists / Money / Nutrition / Train stay gated until the signed-in user is in a household. Meals, Lists, and Money are full modules (desktop and mobile layouts).

## Meals UI (Phase 4)

After signing in and joining a household, open **Meals**:

- **Plan** — week grid (desktop) or day accordion (mobile). Tap a slot to assign, shuffle, clear, or hide.
- **Generate** — pick slots, edit calorie/protein goals, apply household dietary filters, preview, swap, then apply. Uses `generateMealPlan` locally (not a food log).
- **Shopping** — generate from the current week’s plan, check-off by aisle, add extras.
- **Recipes** — catalog + household library, favourites, detail, import from URL or pasted text (scrape + AI via the API). Each recipe shows an approximate supermarket **cost per serve** (Woolworths/Coles for Australia) that refreshes on the first of the month.

Use the web **Mobile preview** toggle (when `EXPO_PUBLIC_ENABLE_MOBILE_PREVIEW=1`) to check the mobile layout on desktop. Production web must omit that flag.

## Lists UI

Open **Lists** after joining a household:

- **Lists** — household checklists.
- **Wishlists** — products and prices.
- **Watchlist** — movies and series. Each list is **household** (everyone) or **personal** (only you). Search TMDB or paste a title URL from IMDb, TMDB, Rotten Tomatoes, Letterboxd, or JustWatch. Streaming/rent/buy in the household country comes from TMDB / JustWatch. Apply `packages/db/supabase/migrations/20260918140000_watchlist.sql` and set `TMDB_API_KEY` on the API.
- **Saves** — generic links.

## Money UI

Open **Money** after joining a household:

- **Dashboard** — family net worth (assets minus debts, including listed shares) and the monthly budget snapshot.
- **Assets** — accounts you own (cash, bank, investments, super, property, vehicles) and debts (credit, loans, mortgage). Values are entered by the household; there is no bank feed.
- **Shares** — ASX portfolios with a HIN/SRN, holdings, and live prices via `/quotes`. Import a CommSec-style CSV or pasted CHESS statement; a HIN cannot pull holdings on its own.
- **Budget** — set the household plan once (upload a statement or enter categories yourself). Each month keeps its own spend and entries, so you can look back at months that went over. Add this month’s purchases against a category, and expand a row to see them.

Owners and admins can edit. Other members can view. Apply `packages/db/supabase/migrations/20260907200000_finances_schema.sql`, `20260908100000_finance_shares.sql`, `20260916100000_finance_standing_budget.sql`, `20260916200000_finance_budget_txns.sql`, and `20260918100000_finance_budget_setup.sql` before using this module.

## Meals API (scrape + AI)

Recipe import talks to `packages/api`. AI keys never go in `apps/kinexus/.env`.

1. Copy `packages/api/.env.example` to `packages/api/.env`.
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the same project as the app (JWT verification).
3. Set `AI_PROVIDER=anthropic` (default) or `deepseek`, and the matching API key.
4. In `apps/kinexus/.env`, set `EXPO_PUBLIC_API_URL=http://localhost:5301`. Restart after changing this.
5. `pnpm dev` (or `pnpm web`) starts Expo and the API together.

Then `pnpm web` as usual. Import Recipe → Fetch recipe uses `/scrape` then `/ai` when the page has no JSON-LD or blocks bots.

Public HTML fetch (recipes, Stash product pages, collectibles catalogs) uses Impit, then the home Pi proxy (`RESIDENTIAL_PROXY_URL` / `RESIDENTIAL_PROXY_KEY`), then Playwright stealth as a local backup. Playwright stays off on Vercel unless `PLAYWRIGHT_ENABLED=1`.

On Vercel, the same Hono app is mounted at `/api/*` and rewritten from `/health`, `/scrape`, `/ai`, `/prices/*`. Web can omit `EXPO_PUBLIC_API_URL` and call the same origin.

Recipe cost estimates: `POST /prices/estimate` (signed-in) prices one recipe for the household's country. `GET /api/prices/refresh` is the Vercel Cron target (`0 6 * * *` UTC). The job only does work when estimates are from a previous month, so the first of the month starts a full refresh and leftover recipes continue on later days. Set `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` in Vercel. Apply `packages/db/supabase/migrations/20260907170000_recipe_cost_estimates.sql`.

**Provider switch:** change `AI_PROVIDER` in `packages/api/.env` (or Vercel env) and restart. Call sites always go through `createAiClient()` — no client or route changes.

| Env | Where | Purpose |
|-----|--------|---------|
| `EXPO_PUBLIC_API_URL` | Expo `.env` / Vercel build | Public base URL of the API (`http://localhost:5301` locally; empty or prod origin on Vercel) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | `packages/api/.env` / Vercel runtime | Verify the user's Supabase JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | API env | Write recipe cost estimates (cron + on-demand) |
| `CRON_SECRET` | Vercel runtime | Protect `/api/prices/refresh` |
| `AI_PROVIDER` | API env | `anthropic` or `deepseek` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | API env | Anthropic Messages API |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` | API env | DeepSeek OpenAI-compatible chat |
| `TMDB_API_KEY` | API env | Lists → Watchlist catalog + streaming providers |
| `CORS_ORIGIN` | API env | Comma-separated allowed web origins |
| `RESIDENTIAL_PROXY_URL` / `RESIDENTIAL_PROXY_KEY` | API env | Home Pi scrape proxy (Cloudflare fallback) |
| `PLAYWRIGHT_ENABLED` | API env | `1` to force Playwright on Vercel; `0` to disable locally |
| `API_PORT` | `packages/api/.env` | Default `5301` (local only) |

Generate Plan stays **local** (`generateMealPlan` in `packages/domain`). The API is for import scrape/extract and monthly recipe cost estimates — not food-log photo or barcode endpoints.

## Meals data, Realtime, and offline (Phase 3)

Slot edits are **row-level** (`meal_slots`: one row per day + slot), not a week JSON blob. Catalog recipes are `household_id is null` and read-only to clients.

### Two clients (Realtime)

1. Apply all three migrations. Sign in as two members of the same household (two browsers, or normal + incognito).
2. Open **Meals** on both. Select a catalog recipe, tap a breakfast/lunch/dinner cell.
3. The other client should refresh that cell without a reload (Realtime on `meal_slots`).
4. **Generate from plan** on one client; the other should see shopping rows move (Realtime on `shopping_items`).

### Airplane-mode slot edit

1. Load Meals while online (catalog + current week cache).
2. Go offline (browser DevTools → Network → Offline, or OS airplane mode).
3. Assign or clear a slot. The Plan screen shows **Offline**, queues the change, and the cell updates locally.
4. **Import recipe** stays disabled with an explanation. Generate still runs locally; applying slot writes queues in the outbox.
5. Come back online. Pending count should drop to 0 and the same slot should persist in Supabase / the other client.

### RLS (cross-household)

In the SQL editor (service role / postgres), pick a `meal_slots.household_id` from household A. As user B who is **not** a member of A, a client `select` on `meal_slots` must not return those rows. Anon `select` on `recipes` catalog rows is also blocked (authenticated catalog read only).

## Native gaps

**Web Google sign-in is complete** (PKCE, `/auth/callback`, session persistence).

**Native** uses the system browser (`WebBrowser.openAuthSessionAsync`) and the `kinexus://auth/callback` scheme. That works in a dev/production build once the redirect URL is allow-listed.

Not implemented yet:

- `@react-native-google-signin/google-signin` (native Google SDK)
- iOS URL scheme for the reversed Google client ID
- Android SHA-1 / Google Android client ID
- Stable Expo Go redirects (LAN IP changes; add the on-screen URL each session or use a dev client)

Until those exist, treat native Google as the browser OAuth flow above, not a first-party Google button SDK.

## Plan docs

| File | Purpose |
|------|---------|
| [SUITE_REWRITE_PLAN.md](./SUITE_REWRITE_PLAN.md) | Architecture, scope, phasing, data model, UX rules |
| [AGENT_PROMPTS.md](./AGENT_PROMPTS.md) | Phase-by-phase agent prompts |
| [CHECKLIST.md](./CHECKLIST.md) | Meals MVP Definition of Done |

Phase 1 is Auth + household. Phase 2 is `packages/domain` meal-planning logic. Phase 3 is Meals persistence. Phase 4 is the Meals UI. Phase 5a is the scrape/AI API. Phase 5b is harden + deploy.

## Workspace

```
apps/kinexus      Expo Router app (iOS, Android, web)
packages/domain   Pure TS meals, lists, finances, and household logic
packages/db       Supabase migrations + typed helpers
packages/api      JWT-checked scrape + AI (Anthropic / DeepSeek)
api/              Vercel serverless entry (Hono)
```

## Source apps (read-only — do not modify)

| App | Path | Role |
|-----|------|------|
| Huddle | `C:\Apps\huddle` | Meals domain + UX ideas |
| Stashd | `C:\Apps\Stashd` | Wishlist ideas / models |
| RemixFit | `C:\Apps\RemixFit` | Exercise ideas / models |

GitHub: [PeeZapp/Kinexus](https://github.com/PeeZapp/Kinexus)
