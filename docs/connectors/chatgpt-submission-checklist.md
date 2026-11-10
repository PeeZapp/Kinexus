# ChatGPT plugin directory — submission checklist

**Status:** draft only. Do **not** submit until product signs off.

Live-checked packaging/review docs 2026-11-10:

- [Package your plugin](https://developers.openai.com/plugins/build/plugins)
- [Upload and submit your plugin](https://developers.openai.com/plugins/deploy/submission)
- [Remote MCP server review requirements](https://developers.openai.com/plugins/deploy/app-review)
- [Plugin guidelines](https://developers.openai.com/apps-sdk/app-submission-guidelines)

## Identity verification

Before any public submit: complete **individual** or **business** verification in the OpenAI Platform Dashboard for the publishing name. Unverified identity → rejection.

Organization owners (or members with `api.apps.write`) create drafts and submit. Prefer a project with **global** data residency (EU residency cannot submit MCP plugins for now).

## Listing metadata (draft)

| Field | Draft |
| --- | --- |
| Package `name` | `kinexus` |
| Display name | Kinexus |
| Short description | Meal plans, fitness, and lists for your household — ask ChatGPT what’s for dinner or log a workout. |
| Long description | Connect ChatGPT to your Kinexus household. Read meal plans, recipes, shopping lists, workouts, and watch/wish lists. Suggest changes as previews you confirm before anything is saved. Sign in with your Kinexus account (OAuth). Your data stays under your household’s permissions. |
| Category | Productivity |
| Keywords | meals, recipes, meal plan, shopping list, fitness, workouts, watchlist, wishlist, household |
| Developer name | Kinexus — **confirm legal entity before submit** |

## Logo / icon spec

| Item | Spec |
| --- | --- |
| Formats | PNG, JPEG, WebP, or SVG |
| Size | Square; **≥ 48×48**; raster ≤ 4096 per side; ≤ 5 MiB |
| Recommended | 512×512 PNG for listing clarity |
| Fields | `logo` (required for submission) + optional `logoDark`; `composerIcon` (+ optional dark) |
| Background | Solid brand color or transparent — no busy photos |
| Asset path in package | `./assets/logo.png` (placeholder until exported) |

## URLs

| Field | Value |
| --- | --- |
| MCP server URL | `https://kinexus-green.vercel.app/ai/mcp` |
| Privacy policy | `https://kinexus-green.vercel.app/privacy` — **confirm page exists before submit** |
| Website | `https://kinexus-green.vercel.app` |
| Support | Product owner email / in-app support — **fill before submit** |
| Terms of service | **fill HTTPS URL before submit** |
| Docs | `https://kinexus-green.vercel.app/docs/ai-connectors` |

## Countries

Default availability for first submission: **Australia** only.

Placeholder list (expand after legal/product review):

- [x] Australia
- [ ] VERIFY AFTER DEPLOY — add further countries in package / portal publication settings

## Auth (package `mcp.json`)

| Field | Value |
| --- | --- |
| Transport | `streamable-http` |
| Authentication | OAuth — Dynamic Client Registration (`client.mode: "dcr"`) |
| Authorization server | Supabase Auth OAuth 2.1 (`…/auth/v1`) via discovery |
| Notes | DCR on in Supabase; consent at `/oauth/consent`; omit secrets from ZIP |

## Test prompts + expected responses (per tool family)

Use a dedicated reviewer household with sample meal plan, one workout, and one watchlist item. No MFA on the reviewer login.

### Positive (minimum five for portal)

| Scenario | Prompt | Expected tools | Expected result |
| --- | --- | --- | --- |
| Identity | `Who am I in Kinexus?` | `whoami` | Handle, household name, role only |
| Meal plan | `What's on my meal plan this week?` | `get_meal_plan` (and related reads) | Slots for the week from the test household |
| Recipe search | `Find a pasta recipe in my household` | `search_recipes` | Matching recipes; no invented titles |
| Shopping | `What's on my shopping list this week?` | `get_shopping_list` | Items for the seeded week |
| Fitness | `List my workouts` | `list_workouts` (or equivalent registry name) | Library workouts for the household |
| Watchlist | `What's on my watchlist?` | list/get watchlist tools | Titles from seeded list |
| Preview write | `Add milk to my shopping list` | `preview_add_to_shopping_list` then wait for user confirm → `commit` | Preview only until confirmed; no silent write |

### Negative (minimum three)

| Scenario | Expected |
| --- | --- |
| Ask for another user’s private data | Refuse / empty under RLS — no cross-household leak |
| Ask to delete everything without confirm | Preview or refuse; no irreversible delete without confirm + `commit` |
| Ask for unrelated web scraping / secrets | No tool call that exfiltrates credentials or open-world scrape beyond annotated tools |

## Packaging script

Docs require a plugin ZIP (`plugin.json` + `mcp.json` + assets). Package only — **do not upload or submit** from this checklist:

```bash
node scripts/package-chatgpt-plugin.mjs
```

Output: `dist/chatgpt-plugin/kinexus-chatgpt-plugin.zip`

## Pre-submit gate

- [ ] Identity verification complete
- [ ] Production `/ai/mcp` reachable; Scan Tools has **no** annotation findings
- [ ] OAuth consent works on production Site URL; refresh tokens renew
- [ ] Privacy / terms / support URLs live
- [ ] Logo + composer icons exported into `docs/connectors/chatgpt-plugin/assets/`
- [ ] Countries confirmed (Australia default)
- [ ] Reviewer account seeded; test cases re-run
- [ ] Product sign-off

**Do not submit this plugin from the checklist alone.**
