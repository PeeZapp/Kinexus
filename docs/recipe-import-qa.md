# Recipe import E2E QA

Date: 2026-09-20  
Environment: local `npm run dev` (app `:5300`, API `:5301`)  
Harness: POST `/api/recipes/import` + poll GET `/api/recipes/:id` with distinct `X-Forwarded-For` so the guest hourly cap does not abort the API suite.

## Provider config (no secrets)

| Signal | Result |
| --- | --- |
| `ANTHROPIC_API_KEY` in `packages/api/.env` | Set (Claude usable) |
| `DEEPSEEK_API_KEY` in `packages/api/.env` | Empty — DeepSeek is **not** used |
| `AI_PROVIDER` | `anthropic` |
| Live extraction logs | `provider: "claude"` on LLM jobs; never logged API keys |

DeepSeek-first fallback is implemented (`importLlmClients()`), but with an empty DeepSeek key the pipeline correctly uses Claude only. No key values were printed or requested.

## Cache / canonicalization / logs

| Check | Result |
| --- | --- |
| YouTube Shorts, `?si=` share, and `watch?v=` share one cache key | **Pass.** Canonical `https://www.youtube.com/watch?v=mAskHrcolNU`. Same job id `d406bfde-575f-4eb5-a2e9-cc3ef2aa651e`. |
| Share params do not create duplicate recipes | **Pass.** Cases 5 and 6 were 200 cache hits (518ms / 448ms). |
| Progress labels on slow/async video | **Pass.** YouTube POST 202 then `Fetching…` → `Reading the recipe…` → `Ready`. Cook UI also rotates `rotatingProgressMessage`. |
| Logs include provider, host, latency — no keys | **Pass.** Shape: `[recipe-import] { jobId, host, sourceKind, videoId, provider, latencyMs, status, method, errorCode }`. `anthropic` is mapped to `claude`. |

## Cases

### 1. Blog with schema.org/Recipe — **Pass**

- URL: `https://www.bbcgoodfood.com/recipes/classic-lasagne`
- HTTP 200 in **1669ms** (under 10s)
- Title: Easy classic lasagne
- Method: `json-ld`, 15 ingredients, 5 steps, servings 6
- Cook view populated; source link opened `https://www.bbcgoodfood.com/recipes/classic-lasagne` in a new tab

Sample ingredients: `1 tbsp olive oil`, `2 rashers smoked streaky bacon`, `1 onion finely chopped`  
Sample step: “Heat the oil in a large saucepan…”

### 2. Long-intro recipe blog — **Pass** (with CMS note)

- URL: `https://www.thepioneerwoman.com/food-cooking/recipes/a10352/pws-spaghetti-sauce/`
- Live page **redirects** to `/sausage-potato-and-kale-soup/` (Hearst reused the CMS id). H1 + JSON-LD name are “Sausage, Potato, and Kale Soup”. JSON-LD `recipeInstructions` is an empty array, so extraction correctly fell through to LLM.
- HTTP 202 then succeeded in **12527ms**
- Method: `html-llm`, provider Claude
- 11 ingredients + 8 cook steps (no memoir/related-recipe mix in the sample)
- Phases: `Summarizing with AI…` → `Ready`

### 3. TikTok cooking URL — **Pass** (async + friendly failure)

- URL: `https://www.tiktok.com/@177milkstreet/video/7509245406728178990`
- POST **202** in ~1s; job finished in **~4s** (did not hang; 3 min TTL unused)
- Phases: `Fetching…` → `Recipe not found`
- Public oEmbed caption is a restaurant teaser that ends with “Get the recipe … via the link in our profile” — **no ingredients or steps**. LLM correctly refused to invent a recipe.
- TikTok HTML is a WAF challenge (`Please wait…` / `wafchallengeid`); adapter now prefers oEmbed and ignores that wall.
- Fixture path (caption with quantities) still succeeds in unit tests.

This matches the case’s allowed outcome: async job + progress + succeed **or** friendly timeout/not-found, never a hung request.

### 4. YouTube Shorts (address-bar) — **Pass**

- URL: `https://www.youtube.com/shorts/mAskHrcolNU`
- POST 202; succeeded in **7018ms**
- Canonicalized to `https://www.youtube.com/watch?v=mAskHrcolNU`
- Title: Chili Garlic Chicken; 9 ingredients, 4 steps
- Method: `caption-llm`, provider Claude
- Phases: `Fetching…` → `Reading the recipe…` → `Ready`

### 5. YouTube share `?si=` — **Pass**

- URL: `https://www.youtube.com/shorts/mAskHrcolNU?si=QaShareToken123`
- HTTP **200** cache hit, **518ms**, same job as (4)

### 6. YouTube watch URL — **Pass**

- URL: `https://www.youtube.com/watch?v=mAskHrcolNU`
- HTTP **200** cache hit, **448ms**, same job as (4)/(5)

### 7. Non-recipe / empty recipe metadata — **Pass**

- URL: `https://www.bbc.com/news`
- HTTP 200 failed job, **688ms**, `errorCode: not_a_recipe`, message `Recipe not found`
- Not a 500

YouTube music-video fixture (title-only / non-recipe captions) also maps to `not_a_recipe` in unit tests.

### 8. Invalid URL + SSRF — **Pass**

| Input | HTTP | Code | Time |
| --- | --- | --- | --- |
| `javascript:alert(1)` | 400 | `invalid_url` | 7ms |
| `http://127.0.0.1/recipe` | 422 | `ssrf_blocked` | 1604ms |

Copy: “Enter a valid URL starting with https://” / “That URL is not allowed”. No fetch of private hosts beyond the SSRF check.

### 9. Prefix URL form — **Pass**

- Opened `http://localhost:5300/https/www.bbcgoodfood.com/recipes/classic-lasagne`
- Redirected to `/import?url=https://bbcgoodfood.com/recipes/classic-lasagne`
- After submit, cook view showed Easy classic lasagne

Guest cap is 5 imports/hour; the first auto-submit during this session hit `Too many imports` until rate-limit rows were cleared. Distinct `X-Forwarded-For` on the API harness avoids that for cases 1–8.

### 10. PWA cook view offline — **Pass** (local AsyncStorage; SW is production)

On cook view `/recipes/75489c44-3c9a-452e-85cc-58899db37ce7`:

- Title, source, ingredients, numbered steps present
- Servings `6` → `7` scaled quantities (`1 tbsp` → `1.17 tbsp`, `500g` → `583g`) **while the tab was offline**
- Ingredient checkbox state survived reload (`500g beef mince` stayed checked). Servings reset to 6 on reload (session-only, by design)
- Source control opened the BBC recipe in a new tab
- Household **Save** stays “Sign in to save” for guests (not exercised with a Google session)

Service worker registration in `app/+html.tsx` is **production-only**. Locally the cook JSON/checks live in AsyncStorage. On Vercel, `public/sw.js` network-first caches succeeded `GET /api/recipes/:uuid` on the same origin.

## Fixes landed during QA (P0/P1)

1. **TikTok WAF wall** — watch-page HTML is a challenge; adapter prefers oEmbed JSON (with JSON `Accept` + retries) and ignores challenge HTML. Unit test covers oEmbed-only captions.
2. **DNS lookup** — 5s timeout and one retry (was 2s, which could drop the first TikTok oEmbed as SSRF).
3. **Wrong-dish LLM risk** — web structuring now gets page title + incomplete JSON-LD as a hint and is told to extract the primary recipe only.
4. **Failed LLM logs** — `not_a_recipe` after a model call now records `provider` on the job so logs can show `claude` / `deepseek` without keys.
5. **Canonical YouTube cache** — confirmed live: Shorts / share / watch are one recipe.

## Residual / follow-ups (not P0)

- DeepSeek is unused until `DEEPSEEK_API_KEY` is non-empty in `packages/api/.env`. Claude-only is safe.
- Pioneer Woman slug `pws-spaghetti-sauce` is no longer spaghetti sauce on the live site.
- Spoken-only TikToks still need the documented Whisper follow-up; public captions that only say “link in bio” must stay `Recipe not found`.
- Guest import cap is 5/hour (hashed IP, persisted). Easy to hit during a mixed UI + harness session.
- Local dev does not register the PWA service worker; production same-origin `/api` is the SW path.
