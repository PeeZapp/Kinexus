# Clean recipe from any URL — PRD (MVP)

**Job:** Paste a recipe blog URL or a TikTok / YouTube / Instagram cooking video → get a clean cook view (no blog fluff), then optionally save it to My Recipes.

Inspired by the cooked.wiki *job*, not their UI, brand, copy, or code. Kinexus already has URL import; this expands it from “fill the editor form” into “cook from a clean, attributed recipe.”

This document is spec only. No app implementation in this step. Types live in `@kinexus/domain` as `packages/domain/src/meals/clean-recipe.ts`. Architecture: [recipe-import-architecture.md](./recipe-import-architecture.md).

---

## Current Kinexus (what we keep / change)

| Today | MVP change |
| --- | --- |
| `/meals/recipes/import` fetches a URL, then dumps a **form** (name, macros, editors) | Primary output is a **cook view**. Form/edit stays as a secondary “tweak before save” path. |
| JSON-LD `schema.org/Recipe` first, then AI on stripped HTML | Keep this order. JSON-LD that is missing ingredients **or** steps is incomplete — fall through. |
| Site blocked → `extract_recipe_from_url` (model **reconstructs** from the URL) | **Stop hallucinating.** If we cannot read the page or a transcript, fail with a clear error + paste-text fallback. |
| Sync POST `/scrape` + `/ai`, 12s HTML timeout, JWT required | Blog JSON-LD can stay fast/sync. Video (minutes) needs a **job + progress**. Import API may be used **without an account**; save still needs auth. |
| `Recipe.method: string[]`, `Ingredient.amount?: string` | Cook view needs **section headings** and **scalable quantities**. Persist by mapping onto existing `Recipe` (see schema). |
| Entire `(app)` group redirects to sign-in | Add a **public** import/cook route. Household library, plan, and save stay behind auth. |
| Keys: `packages/api/.env` via `createAiClient()` / `AI_PROVIDER` | Reuse. Never put keys in the Expo app, never log secret values. |

**LLM loading (already in repo, reuse as-is):**

- `packages/api/.env`: `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`
- `createAiClient()` in `packages/api/src/ai/provider.ts` (Anthropic default, DeepSeek switch)
- Client talks to the API; keys never ship in `apps/kinexus`

---

## Goals

1. From a public recipe URL, show a cook view in one tap: title, outbound source link, optional hero, servings `+/-` that scales quantities, ingredient checkboxes, numbered steps (optional headings).
2. Prefer **JSON-LD Recipe**. Fall back to **LLM structuring of fetched text or video captions** via the existing Claude/DeepSeek client.
3. Always attribute the original source with a working outbound link.
4. Guests can import into an in-memory cook view. **Save / sync requires a signed-in household member** (Kinexus already has auth).
5. Architecture stays in `packages/api` + `@kinexus/domain` so PWA now does not block later iOS/Android + web.

## Non-goals (do not block MVP)

Nutrition accuracy, metric/imperial toggle, AI “breakdown/simplify”, TTS, PDF, QR share, shopping-list push, cook journal, auto tags, paywall bypass, downloading video files, cloning cooked.wiki.

Paste-text import already exists — keep it as the escape hatch when URL import fails.

---

## Users

| Actor | Can do |
| --- | --- |
| Guest (signed out) | Open public import, paste URL, wait, cook from the view. Checkboxes + serving scale are session-only. Save prompts sign-in. |
| Signed-in household member | Same import, plus **Save to My Recipes** (existing household `recipes` row, `source_url` set). |

Rate-limit guest imports (IP + optional anonymous cookie). Authenticated users get a higher cap. Never expose model keys to either.

---

## Experience

### Entry

- Meals → Recipes → Import (existing). Also a public deep link, e.g. `/cook` or `/import`, so guests are not bounced to Google sign-in first.
- One field: URL. Keep the existing “Paste text” tab as fallback, not the hero.

### Progress (especially video)

Jobs can take **minutes**. Do not leave a spinner with no copy.

Suggested phases (map to `RecipeImportPhase` in the schema):

1. Checking the link
2. Fetching the page
3. Reading recipe data
4. Getting captions (video only)
5. Turning it into a recipe
6. Ready / failed

Show elapsed time after ~8s. Allow cancel. On timeout, show the timeout error (not a generic 500).

### Cook view (must-have)

- **Title**
- **From [source host / channel]** — always a real outbound link to the submitted (or canonical) URL
- Optional **hero** (`imageUrl` from JSON-LD / og / oEmbed; hide if missing or flagged)
- **Servings** with `+/-` (min 1). Scales ingredient quantities from `originalServings`. Unparseable amounts stay as the original string.
- **Ingredients** as checkboxes (session-only; not persisted)
- **Method** as a numbered list; `HowToSection` / LLM section titles render as headings and **do not** consume a step number
- **Save to My Recipes** — hidden or disabled for guests with “Sign in to save”

Do not show blog narrative, comments, ads, or related posts. Do not claim Kinexus wrote the recipe.

### Errors (user-facing, must be distinct)

| Situation | User copy (intent) |
| --- | --- |
| Page/transcript is not a cookable recipe | **Not a recipe.** Try another link, or paste the ingredients and steps. |
| Host/app we will not fetch, or video with no usable captions | **That link isn’t supported yet.** YouTube with captions is the video MVP. Paste the recipe text instead. |
| Fetch, captions, or model exceeded the budget | **This is taking too long.** Try again, or paste the recipe text. |

Internal codes in the schema map onto these three (plus `invalid_url` / `blocked` which can reuse the same buckets with slightly more specific copy).

---

## Extraction pipeline

All fetching and model calls stay on the API. The PWA (and later native apps) only POST a URL and poll.

```
URL
  → classify (web_recipe | youtube | tiktok | instagram | facebook | unsupported)
  → SSRF-safe fetch (or platform caption/oEmbed path)
  → if JSON-LD Recipe complete → cook recipe
  → else if we have page text or captions → LLM structure
  → else typed error (never invent a recipe from the URL path)
```

**Complete JSON-LD** means: a non-empty name, at least one ingredient, and at least one instruction step. Partial JSON-LD (name + image only) is not a success.

**JSON-LD mapping notes:**

- `recipeIngredient` → ingredient lines; parse quantity when possible, keep `raw`
- `recipeInstructions` as `HowToStep[]` or strings → steps
- `HowToSection` → heading + nested steps (today’s scraper flattens these — preserve headings)
- `recipeYield` / `nutrition` / `image` / `cookTime` / `totalTime` as today
- Always set `sourceUrl` to the user URL (canonical if we have it)

**Web HTML fallback:** reuse `stripHtml` + `extractRecipeFromText` (existing `AiClient.complete({ json: true })`). Prompt must say: extract only what is in the content; if it is not a recipe, return a structured `not_a_recipe` failure, do not invent.

**Video MVP:**

- **YouTube:** oEmbed for title/thumbnail (already in stash `scrape/link.ts`) + captions/transcript if publicly available. Do **not** download the media file.
- **TikTok / Instagram:** best-effort public caption / og description. If that text is not enough to structure a recipe → `unsupported_url` (or `video_no_transcript`) and point at paste.
- Never use `extract_recipe_from_url` (training-data reconstruction) for the cook view.

**Jobs:** Production API is a Vercel serverless function. Minute-long work cannot run in one request. `POST /recipe-imports` returns a job id immediately; a worker (same Node process locally; queue/cron or background path in prod) updates the row; client polls `GET /recipe-imports/:id`. Blog JSON-LD that finishes in a few seconds may complete on the first poll.

Suggested budgets (implementation can tune): HTML fetch 12s (already), job wall-clock ~3 minutes, LLM call ~45s.

---

## Security & attribution

- Reuse and **harden** `assertPublicHttpUrl` / `fetchPublicHtml`: http(s) only, block localhost/private/link-local/metadata hosts, re-check **every redirect hop**, cap hops, timeout, cap body size.
- **Add DNS resolution of the final hostname** and reject private/reserved IPs (closes DNS rebinding the current hostname-string check misses).
- Do not follow redirects to file:, data:, or non-http(s).
- Strip credentials from URLs before logging. Log host + job id, never API keys, never full HTML dumps in production logs.
- Attribution is mandatory on cook view, saved recipe (`source_url`), and any later print path.
- Do not bypass paywalls or login walls; treat 401/403 as blocked → clear error + paste.

---

## Save mapping

Cook view model (`CleanRecipe`) is the import contract. Saving writes a household `Recipe`:

- `name`, `servings` (original, not the scaled cook-session value), `cookTime`, `imageUrl`, `sourceUrl`
- `ingredients[]` with `amount` as the original `raw` (or formatted original qty) so shopping/`parseAmount` keep working
- `method[]` as step strings; if headings exist, persist a heading line (e.g. prefix) **or** a parallel `methodSections` jsonb once a migration exists
- `extraction` meta (source kind, json-ld vs llm, provider) for support, not for the cook UI
- Serving scale and ingredient checks are **not** saved

Existing edit screen remains the place to fix a bad extract after save.

---

## Success (MVP)

- Majority of popular recipe blogs with JSON-LD open a cook view without an LLM call.
- A YouTube cooking video **with captions** produces a cook view with source link, or a typed error if captions are missing.
- A news homepage, a product page, or a non-cooking TikTok returns **not a recipe** / **unsupported**, never a made-up dish.
- Guest can complete import → cook; Save requires sign-in and then appears in that household’s library.

---

## Edge cases

| # | Case | Expected |
| --- | --- | --- |
| E1 | `javascript:`, `file:`, `ftp:`, bare “allrecipes.com” | `invalid_url` / unsupported — must start with `http://` or `https://` |
| E2 | `http://127.0.0.1`, `localhost`, `10.*`, `192.168.*`, `169.254.*`, `::1`, cloud metadata hosts | `ssrf_blocked` — never fetched |
| E3 | Public host that **DNS-resolves** to a private IP | `ssrf_blocked` after resolve (today’s hostname-only check is not enough) |
| E4 | Redirect chain to a private IP or non-http(s) | Stop; `ssrf_blocked` or fetch failed. Re-validate every hop (max 4) |
| E5 | HTML with complete `schema.org/Recipe` JSON-LD | Cook view from JSON-LD, **no LLM**. `extraction.method = json-ld` |
| E6 | JSON-LD Recipe with name + image but empty ingredients/instructions | Incomplete → HTML/LLM fallback, not a success |
| E7 | `recipeInstructions` as `HowToSection[]` | Section `name` → heading blocks; nested `HowToStep` → numbered steps |
| E8 | `recipeYield` is `"4–6 servings"` or an array | Parse a positive integer when possible; if not, omit `originalServings` and disable +/- |
| E9 | Amounts like `"salt"`, `"to taste"`, `"2-3 tbsp"` | Keep `raw`; `value` null (or unscaled). Other numeric lines still scale |
| E10 | Blog JSON-LD + 2k words of life story | Cook view uses structured recipe only; narrative stripped |
| E11 | Recipe behind 401/403/paywall | Not a silent AI reconstruction. Error + paste fallback |
| E12 | HTML page, no JSON-LD, body is a recipe | `html-llm` cook view; source link still the page URL |
| E13 | HTML page is news/product/homepage | `not_a_recipe` — no invented dish |
| E14 | YouTube with public captions | `transcript-llm`; title + thumbnail from oEmbed; source link is the watch URL |
| E15 | YouTube with **no** captions / Shorts with no text | `video_no_transcript` → unsupported copy + paste |
| E16 | TikTok / Instagram with a caption that **is** a recipe | `caption-llm` if text is sufficient |
| E17 | TikTok / Instagram with no usable caption (typical) | `unsupported_url` — do not download the video in MVP |
| E18 | `youtu.be`, `m.youtube.com`, `vm.tiktok.com`, `instagram.com/reel/` | Classify as the platform, not generic web |
| E19 | Non-cooking YouTube (music, vlog) | `not_a_recipe` after transcript/LLM, not a fake recipe |
| E20 | Import runs > job budget (~3 min) | `timeout`; client shows timeout copy; job cannot hang forever |
| E21 | HTML fetch > 12s | Timeout (existing scrape budget) |
| E22 | Guest imports, then hits Save | Sign-in; after auth, offer to save the in-memory `CleanRecipe` (do not lose it) |
| E23 | Guest hammers import | `rate_limited` with a clear wait message |
| E24 | Signed-in save | Household recipe with `source_url`; original servings/amounts (not scaled session values); checkboxes discarded |
| E25 | +/- servings 4 → 8 | `100g` → `200g`; “to taste” unchanged; min servings 1 |
| E26 | Check ingredient, change servings, navigate away without save | Checks + scale are gone (session-only) |
| E27 | Duplicate import of the same URL | Allowed; each save is a new household recipe (no silent merge in MVP) |
| E28 | Image URL is tracking/broken | Hero optional; cook view still usable without it |
| E29 | LLM returns JSON missing steps | `extraction_failed` / not a recipe — do not show a half recipe as success |
| E30 | API keys missing in env | 503-style “import isn’t configured”; never ask the user to paste a key |
| E31 | PWA offline | Cannot start a URL import; paste/save follow existing online gates |
| E32 | Later native app | Same API (`POST` job + poll). No browser-only scrape in the client |

---

## Acceptance criteria

### Cook view

- [ ] Given a complete JSON-LD recipe URL, the cook view shows **title**, **outbound source link**, optional hero, servings, ingredient checkboxes with quantities, and numbered steps within the existing scrape timeout — **without** an LLM call.
- [ ] Source link opens the original page (or canonical URL) in a new browsing context; Kinexus is not presented as the author.
- [ ] `HowToSection` headings render as headings; only `step` blocks are numbered.
- [ ] Servings `+/-` scales parseable quantities proportionally from `originalServings`; unparseable lines stay as `raw`; servings cannot go below 1.
- [ ] Ingredient checks are local to the session and are not written to `recipes`.

### Import pipeline

- [ ] JSON-LD is preferred; LLM runs only on fetched page text or video captions/transcripts via `createAiClient()` (`AI_PROVIDER` / Anthropic / DeepSeek in `packages/api/.env`).
- [ ] Keys are never in the Expo bundle, never logged, never requested from the user.
- [ ] `extract_recipe_from_url` (reconstruct from URL/training data) is **not** used for this cook view.
- [ ] Video imports show phase + progress for the whole job (can take minutes) and can fail with **timeout**.
- [ ] YouTube with captions → cook view or a typed error; TikTok/IG without a usable caption → **unsupported**, not a hang.
- [ ] SSRF: private/link-local/metadata/localhost and DNS-to-private IPs are rejected; redirects are re-checked.

### Errors

- [ ] Not-a-recipe, unsupported URL, and timeout are visually distinct and each offer paste-text as a way forward.
- [ ] A non-recipe URL never yields a plausible made-up recipe as a success.

### Auth & save

- [ ] A signed-out user can complete import → cook view on a **public** route (not bounced to Google first).
- [ ] Save is blocked until sign-in; after sign-in the pending recipe can be saved to that household’s library with `source_url` set.
- [ ] Saved amounts/servings are the **published** ones, not the cook-session scale.

### Platform

- [ ] Import I/O lives in `packages/api` + domain types; the PWA only submits a URL and polls. No design that requires a browser engine, so later iOS/Android can reuse the same API.
