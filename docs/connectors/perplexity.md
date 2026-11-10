# Perplexity connector

Live-checked 2026-11-10 against:

- [Adding Custom Remote Connectors](https://www.perplexity.ai/help-center/en/articles/13915507-adding-custom-remote-connectors) (EN page CF-gated in automation; same article body confirmed via Help Center locale mirrors + English search snippets)
- [Local and Remote MCPs for Perplexity](https://www.perplexity.ai/help-center/en/articles/11502712-local-and-remote-mcps-for-perplexity)
- Plan gate also confirmed from Perplexity Computer workshop copy and third-party connector guides citing Pro / Max / Enterprise

Production MCP URL (never type this — copy from Kinexus or paste after **Copy URL**):

```
https://kinexus-green.vercel.app/ai/mcp
```

## Which plans can add a custom remote connector

| Plan | Custom remote MCP |
| --- | --- |
| Free / Standard | Not listed as able to add custom connectors |
| Pro | Yes |
| Max | Yes |
| Enterprise | Yes — admins control org connectors; members need **Allow members to add custom connectors** |

There is **no public Perplexity connector directory** and **no one-click install**. Setup is always Add custom → Add MCP connector.

## Click path — custom remote MCP (account)

Recorded from Perplexity Help Center on 2026-11-10:

1. Open **Perplexity** on the web.
2. Open **[Plugins](https://www.perplexity.ai/computer/plugins)** in the sidebar (or **Customize → Connectors** if Plugins is not shown yet).
3. **Add custom** → **Add MCP connector**.
4. Select **Remote**.
5. **Name** (e.g. `Kinexus`) → paste the production `/ai/mcp` URL under **MCP server URL**.
6. Under **Advanced** → **Authentication** → **OAuth** (leave **Transport** on **Streamable HTTP**; **Network access** Public).
7. Acknowledge the custom-connector risk checkbox → **Add**.
8. Open the connector card to start OAuth → complete Kinexus sign-in / consent (**Allow**).
9. Ask Perplexity something that uses the connector (or paste the in-app test prompt).

Organization path (admins): **Organization settings → [Connectors](https://www.perplexity.ai/account/org/connectors)** → **Custom connector** (org connectors are always remote).

Kinexus **Open Perplexity** opens the deepest documented Plugins entry:

```
https://www.perplexity.ai/computer/plugins
```

If that path moves after deploy, mark the in-app deep link **VERIFY AFTER DEPLOY** and update `perplexityInstallDeepLink()`.

## Auth options (from Help Center)

| Option | When to use |
| --- | --- |
| **None** | Public MCP with no credentials (not Kinexus) |
| **API Key** | Static key at setup (not Kinexus) |
| **OAuth** | Kinexus — OAuth 2.0; Client ID/Secret only if the server lacks DCR |

When the MCP host serves `/.well-known/oauth-authorization-server`, Perplexity auto-discovers endpoints and scopes. Kinexus proxies/mirrors Supabase Auth AS metadata at that path on the app origin.

OAuth redirect URLs Perplexity documents (register only if a non-DCR client is created manually):

- `https://www.perplexity.ai/rest/connections/oauth_callback`
- Enterprise subdomain: `https://enterprise.perplexity.ai/rest/connections/oauth_callback`

## Server requirements (Perplexity)

- Public HTTPS Streamable HTTP (or SSE) endpoint — production `/ai/mcp`.
- Unauthenticated `/ai/mcp` → **401** with `WWW-Authenticate: Bearer … resource_metadata="…"`.
- Protected-resource metadata unchanged: `resource` = MCP URL; `authorization_servers` = Supabase issuer.
- Host also serves `/.well-known/oauth-authorization-server` pointing at the Supabase issuer (issuer, authorize, token, registration).
- OAuth 2.1 + DCR + PKCE S256 via Supabase Auth.
- CORS allows `https://www.perplexity.ai`, `https://perplexity.ai`, and `https://enterprise.perplexity.ai`.

## In-app wizard

Settings → Connected AI chats → Connect → Perplexity:

- Plan line up front: **Needs Perplexity Pro, Max or Enterprise**.
- **Copy URL** — production MCP URL.
- **Open Perplexity** — Plugins page above.
- Numbered steps + screenshot placeholders + collapsed tips (plan gate, org admin may disable custom connectors, remove/re-add).
- Polls for an `mcp_connections` row with platform `perplexity`, then shows **Connected ✓**.
- **Test it** prompt: `What's on my meal plan this week?`

## Screenshots

Step illustrations in the wizard are placeholders. Replace with real Perplexity Plugins UI screenshots after production deploy.

## Directory

No public directory listing. Do not expect one-click install; keep the custom remote wizard as the only path.
