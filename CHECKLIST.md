# Meals MVP — Definition of Done

Source: [SUITE_REWRITE_PLAN.md](./SUITE_REWRITE_PLAN.md) §13. Product work for Phase 5b lives in this repo. **Vercel production URL** needs a one-time login + env on your account (see README).

No ads, monetization, or notifications were added.

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Google sign-in on web | Done | PKCE, `/auth/callback`, session persistence. |
| 2 | Google sign-in on Expo Go | Done with caveat | System-browser OAuth. Add the on-screen `exp://…` redirect in Supabase each session, or use a `kinexus://` dev client. Native Google SDK is still a documented gap. |
| 3 | Create household + invite + RLS | Done | Manual two-user test is in the README. Tokens hashed at rest. |
| 4 | Weekly plan CRUD, desktop + mobile | Done | Plan grid / accordion, slot sheet, hide/shuffle/clear. |
| 5 | Generate Plan with goals/dietary + library | Done | Local `generateMealPlan` in `packages/domain`. |
| 6 | Shopping from plan, check-off sync | Done | Realtime on `shopping_items`. |
| 7 | Recipes browse, detail, favourite, import | Done | Import uses JWT-checked `/scrape` + `/ai`. |
| 8 | Limited offline slot edits + sync | Done | Outbox + Offline banner. Import stays online-only. |
| 9 | Stash / Nutrition / Train polished placeholders | Done | Coming-later copy, planned bullets, CTA to Meals. |
| 10 | Dev mobile preview only when enabled | Done | `EXPO_PUBLIC_ENABLE_MOBILE_PREVIEW=1`. Leave unset on Vercel. |
| 11 | Deployed web on Vercel; Supabase live | GitHub connected; production is still the scaffold commit | Vercel project: [kinexus](https://vercel.com/paul-zappavignas-projects/kinexus). Alias: `https://kinexus-paul-zappavignas-projects.vercel.app`. GitHub `main` is still `7b18602` (scaffold). Phases 1–5b are local-only until commit + push. Deployment Protection (Vercel SSO) is on — turn it off for Production so Google auth works for real users. |
| 12 | Huddle / Stashd / RemixFit untouched | Done | Kinexus workspace only. |

## After GitHub is connected to Vercel

Production alias: `https://kinexus-paul-zappavignas-projects.vercel.app`  
Dashboard: `https://vercel.com/paul-zappavignas-projects/kinexus`

1. **Commit and push** Phases 1–5b. GitHub `main` is still the scaffold (`7b18602`); Vercel will rebuild on push.
2. Set Vercel env (README production table). `EXPO_PUBLIC_*` are build-time — redeploy after changing them. Do **not** set `EXPO_PUBLIC_ENABLE_MOBILE_PREVIEW`.
3. Vercel → Project → Settings → Deployment Protection: disable **Vercel Authentication** on Production (otherwise Google sign-in hits an SSO wall).
4. Add these to Google JS origins and Supabase redirect URLs:
   - `https://kinexus-paul-zappavignas-projects.vercel.app`
   - `https://kinexus-paul-zappavignas-projects.vercel.app/auth/callback`
   - `https://kinexus-paul-zappavignas-projects.vercel.app/invite/**`
5. Confirm: Google sign-in → household → Meals → Import (`GET /health` → `{"ok":true}`).
6. Tick item 11 here and in §13 of the plan.
