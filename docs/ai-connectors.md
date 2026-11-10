# AI chat connectors (MCP)

Remote MCP for ChatGPT, Claude, and Perplexity. Users link a Kinexus account with OAuth; tools run as that user under RLS.

## Endpoint

Production resource URL (do not hardcode the host in clients — use the deployed origin):

```
https://<app-domain>/ai/mcp
```

Local API (default): `http://localhost:5301/ai/mcp`

Discovery:

| URL | Purpose |
| --- | --- |
| `/.well-known/oauth-protected-resource` | Resource metadata → Supabase authorization server (`resource` = `<origin>/ai/mcp`) |
| `/.well-known/oauth-protected-resource/ai/mcp` | Same metadata (path-scoped discovery) |
| `/.well-known/oauth-authorization-server` | Proxies/mirrors Supabase AS metadata |
| `/mcp/connections` | List connections (session JWT; UI in 18b) |
| `DELETE /mcp/connections/:id` | Revoke connection + OAuth grant immediately |

Grocery shopping MCP (token connectors) lives at `/mcp`, not `/ai/mcp`.

## Auth flow

1. MCP client reads protected-resource metadata and discovers the Supabase OAuth 2.1 authorization server.
2. Client registers dynamically (DCR) or uses a pre-registered public client.
3. Authorization code + PKCE: user signs in on Kinexus, sees consent (`/oauth/consent`): “\<AI app\> wants to use your Kinexus account” → Allow / Cancel.
4. App scopes (`meals|fitness|watchlists|wishlists` × `read|write`) are granted in full by default and not shown.
5. Supabase issues short-lived access tokens and rotating refresh tokens.
6. MCP calls send `Authorization: Bearer <access_token>`. Handlers use a user-scoped Supabase client (RLS). Never service role for user data.

### Supabase dashboard (enable once)

1. **Authentication → OAuth Server** → enable OAuth 2.1 server.
2. **Authorization Path**: `/oauth/consent`
3. **Allow dynamic client registration**: on (for ChatGPT / Claude / Perplexity / Inspector).
4. **Authentication → URL Configuration → Site URL**: your web origin (prod: the Vercel production URL; local: `http://localhost:5300`).
5. Add redirect allow-list entries for that origin, including `/oauth/consent` and `/auth/callback`.
6. Prefer asymmetric JWT signing if you use OIDC `openid` scope.

`packages/db/supabase/config.toml` already has `[auth.oauth_server]` for local.

## Tools

Registry: `packages/api/src/mcp/registry.ts`

| Tool | Mode | Returns |
| --- | --- | --- |
| `whoami` | read | `{ handle, householdName, role }` only |
| `search_recipes` | read (`meals:read`) | Matching household + catalog recipes |
| `get_recipe` | read | One recipe; nutrition is stored or labelled `estimate`, else missing |
| `get_meal_plan` | read | Plan slots for a date range |
| `get_shopping_list` | read | Shopping list for a week |
| `get_pantry` | read | Device-local only — reports unavailable |
| `get_picks` | read | Person/slot approved recipe picks |
| `preview_create_recipe` | write (`meals:write`) | Preview create (dedupe candidates; optional plan slots = one confirmation) |
| `preview_update_recipe` | write | Preview update household recipe |
| `preview_delete_recipe` | write | Preview delete household recipe |
| `preview_import_recipe_from_url` | write | Preview import via `/recipes/import` (AI lockout messages as-is) |
| `preview_add_meal` / `preview_move_meal` / `preview_remove_meal` | write | Plan slot changes; filled slots need explicit `overwrite` |
| `preview_plan_meals` | write | Multi-slot plan preview (lists every slot) |
| `preview_add_to_shopping_list` | write | Preview manual shopping item |
| `commit` | write | Commit one preview (all steps); rejects missing/expired/mismatched/already-committed |

Writes use preview → commit (`packages/api/src/mcp/preview.ts`, 10-minute TTL). The user confirms once per request.

## Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

1. Transport: **Streamable HTTP**
2. URL: `http://localhost:5301/ai/mcp` (API) or your deployed `https://<app-domain>/ai/mcp`
3. Complete OAuth when prompted (consent on the Site URL origin).
4. Call `whoami` — expect only your handle, household name, and role.

Ensure API env has `SUPABASE_URL` and `SUPABASE_ANON_KEY`, and the web app Site URL matches the consent host.

## Future platforms

| Platform | Status |
| --- | --- |
| ChatGPT / Claude / Perplexity | Supported via this remote MCP + OAuth |
| Microsoft 365 Copilot | Work tenants only — not built |
| Gemini | Not built |
| DeepSeek | Not built |
