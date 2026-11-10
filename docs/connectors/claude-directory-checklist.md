# Claude Connectors Directory — listing checklist

**Status:** draft only. Do **not** submit until product signs off.

## Listing copy (draft)

| Field | Draft |
| --- | --- |
| Name | Kinexus |
| Short description | Meal plans, fitness, and lists for your household — ask Claude what’s for dinner or log a workout. |
| Long description | Connect Claude to your Kinexus household. Read meal plans, recipes, shopping lists, workouts, and watch/wish lists. Suggest changes as previews you confirm before anything is saved. Sign in with your Kinexus account (OAuth). Your data stays under your household’s permissions. |
| Categories | Productivity, Lifestyle / Home |
| Keywords | meals, recipes, meal plan, shopping list, fitness, workouts, watchlist, wishlist, household |

## Icon spec

| Item | Spec |
| --- | --- |
| Format | PNG (or SVG if the portal accepts it) |
| Size | 512×512 px minimum; square |
| Background | Solid brand color or transparent — no busy photos |
| Safe area | Keep mark inside ~80% center; no tiny text |
| Asset | Use the Kinexus app icon; export a dedicated connector mark if the mark is illegible at 48px |

## URLs

| Field | Value |
| --- | --- |
| MCP server URL | `https://kinexus-green.vercel.app/ai/mcp` |
| Privacy policy | `https://kinexus-green.vercel.app/privacy` — **confirm page exists before submit** |
| Docs | `https://kinexus-green.vercel.app/docs/ai-connectors` (also linked from protected-resource metadata) |
| Support contact | Product owner email / in-app support channel — **fill before submit** |
| Homepage | `https://kinexus-green.vercel.app` |

## Auth (submission portal)

| Field | Value |
| --- | --- |
| URL mode | Universal URL |
| Authentication | OAuth 2.0 — Dynamic Client Registration (`oauth_dcr`) |
| Authorization server | Supabase Auth OAuth 2.1 (`…/auth/v1`) |
| Redirect URI Claude uses | `https://claude.ai/api/mcp/auth_callback` |
| Notes | DCR on in Supabase; consent at `/oauth/consent` |

## Reviewer test account plan

1. Create a dedicated Kinexus household (e.g. `claude-reviewer@…`) with sample meal plan, one workout, and one watchlist item.
2. Share reviewer credentials only through the Anthropic reviewer channel (never in the public listing).
3. Steps for reviewer:
   - Open listing → Connect (or use custom connector URL above).
   - Complete Kinexus consent → Allow.
   - Ask: `What's on my meal plan this week?`
   - Ask a write: preview add a shopping item, then confirm via `commit` only after user OK.
4. Revoke path: Kinexus Settings → Connected AI chats → Disconnect; or remove connector in Claude.
5. After review, rotate/disable the test account password.

## Pre-submit gate

- [ ] Production `/ai/mcp` 401 + `resource_metadata` verified from Anthropic egress
- [ ] OAuth consent works on production Site URL
- [ ] Privacy policy URL live
- [ ] Support contact filled
- [ ] Icon exported at 512×512
- [ ] Reviewer account seeded
- [ ] Product sign-off

**Do not submit this listing from the checklist alone.**
