# Claude connector

Live-checked 2026-11-10 against:

- [Get started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166)
- [Authentication for connectors](https://claude.com/docs/connectors/building/authentication)
- [Directory vs custom connectors](https://claude.com/docs/connectors/building/directory-vs-custom) (install-link format)

Production MCP URL (never type this — copy from Kinexus or use **Open Claude**):

```
https://kinexus-green.vercel.app/ai/mcp
```

Availability (per support article): Free (1 custom connector), Pro, Max, Ultra, Team, Enterprise — web, Desktop, Cowork, mobile. Claude reaches the server from Anthropic’s cloud (public HTTPS required).

## Click path — Free / Pro / Max / Ultra

Recorded from the support article on 2026-11-10:

1. Navigate to **Customize → Connectors**.
2. Click **+ Add**, then **Add custom connector**.
3. Enter a name (e.g. `Kinexus`) and the remote MCP server URL. Click **Continue**.
4. Review the authentication settings Claude detected. Click **Continue**.
5. Under **Authentication**, choose how people connect (e.g. **Sign in now**).
6. Under **OAuth client**, choose how Claude identifies itself (e.g. **Register automatically** or **Use Claude’s published identity (Recommended)**).
7. Click **Add**.
8. Complete Kinexus sign-in / consent (**Allow**).

Kinexus **Open Claude** uses the official custom-connector install link so name + URL are prefilled:

```
https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Kinexus&connectorUrl=<encoded production /ai/mcp>
```

## Click path — Team / Enterprise

Owners add the connector for the org first:

1. **Organization settings → Connectors**.
2. Click **Add**.
3. Hover **Custom**, then select **Web**.
4. Enter name + remote MCP URL → **Continue**.
5. Review auth settings → **Continue**.
6. Choose **Authentication** and **OAuth client** options → **Add**.

Members then:

1. **Customize → Connectors**.
2. Find the custom connector → **Connect**.

## Server requirements (Claude)

- Unauthenticated `/ai/mcp` → **401** with `WWW-Authenticate: Bearer … resource_metadata="…"`.
- Protected-resource metadata: `resource` equals the MCP URL exactly; `authorization_servers` lists the Supabase Auth issuer first.
- OAuth 2.1 + DCR + PKCE S256 via Supabase Auth.
- Tools expose `title` plus `readOnlyHint` / `destructiveHint` / `openWorldHint`.

## In-app wizard

Settings → Connected AI chats → Connect → Claude:

- **Copy URL** — production MCP URL.
- **Open Claude** — install link above.
- Numbered steps + collapsed tips (Free = 1 custom connector; remove/re-add if Connect fails; same Kinexus account).
- Polls for an `mcp_connections` row with platform `claude`, then shows **Connected ✓**.
- **Test it** prompt: `What's on my meal plan this week?`

## Screenshots

Step illustrations in the wizard are placeholders. Replace with real Claude UI screenshots after production deploy.

## Directory listing

See [claude-directory-checklist.md](./claude-directory-checklist.md). Do not submit until the checklist owner is ready.
