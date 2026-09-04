# Kinexus

Unified lifestyle suite (Meals · Stash · Nutrition · Train) — **App Store + web**, one Expo binary, Supabase-backed.

## Install

Requires Node 22.13+ and [pnpm](https://pnpm.io).

```bash
pnpm install
```

Copy env templates (do not commit real secrets):

```bash
copy .env.example apps\kinexus\.env
```

On macOS/Linux: `cp .env.example apps/kinexus/.env`

`EXPO_PUBLIC_*` keys must live in `apps/kinexus/.env` so Expo can read them. Leave `EXPO_PUBLIC_SUPABASE_*` empty until Phase 1. `EXPO_PUBLIC_ENABLE_MOBILE_PREVIEW=1` turns on the web-only mobile preview toggle (off in production unless you set it).

## Run

Web (desktop shell by default):

```bash
pnpm web
```

Expo (iOS / Android / Expo Go):

```bash
pnpm dev
```

Then press `i` / `a` in the Expo CLI, or scan the QR code with Expo Go.

Platform-specific shortcuts:

```bash
pnpm ios
pnpm android
```

## Plan docs

| File | Purpose |
|------|---------|
| [SUITE_REWRITE_PLAN.md](./SUITE_REWRITE_PLAN.md) | Architecture, scope, phasing, data model, UX rules |
| [AGENT_PROMPTS.md](./AGENT_PROMPTS.md) | Phase-by-phase agent prompts |

This repo is the Phase 0 scaffold: auth placeholder, desktop sidebar / mobile tabs, and empty module shells. Meal-planning domain and live Supabase land in later phases.

## Workspace

```
apps/kinexus      Expo Router app (iOS, Android, web)
packages/domain   Pure TypeScript domain (empty until Phase 2)
packages/db       Supabase migrations placeholder
packages/api      AI / scrape handler placeholder
```

## Source apps (read-only — do not modify)

| App | Path | Role |
|-----|------|------|
| Huddle | `C:\Apps\huddle` | Meals domain + UX ideas |
| Stashd | `C:\Apps\Stashd` | Wishlist ideas / models |
| RemixFit | `C:\Apps\RemixFit` | Exercise ideas / models |

GitHub: [PeeZapp/Kinexus](https://github.com/PeeZapp/Kinexus)
