# ChatGPT connector

Live-checked 2026-11-10 against:

- [Add custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server)
- [Connect and test your plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [Connecting custom MCP servers in ChatGPT](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt) (Help Center — plans + click path)
- [Plugin guidelines / Apps SDK submission guidelines](https://developers.openai.com/apps-sdk/app-submission-guidelines)
- [Remote MCP server review requirements](https://developers.openai.com/plugins/deploy/app-review)
- [Upload and submit your plugin](https://developers.openai.com/plugins/deploy/submission)

Production MCP URL (never type this — copy from Kinexus or paste after **Copy URL**):

```
https://kinexus-green.vercel.app/ai/mcp
```

## Which plans can add a custom MCP app

Per Help Center article *Connecting custom MCP servers in ChatGPT* (live-checked 2026-11-10):

| Plan | Custom MCP |
| --- | --- |
| Free / Plus | Not listed as able to add custom MCP servers |
| Pro | Can connect custom MCP servers with **read/fetch** permissions only; full MCP (write) is Business / Enterprise / Edu |
| Business | Yes — admins/owners create and publish |
| Enterprise / Edu | Yes — admins/owners; RBAC can grant create permission to selected members |

Web only — Help Center FAQ: cannot connect custom MCP servers on mobile.

Current Plugins UI: you do **not** need Developer Mode first; acknowledge the risk warning per server instead.

## Click path — custom MCP (Business / Enterprise / Edu)

Recorded from OpenAI Help Center + developer docs on 2026-11-10:

1. Open **ChatGPT** on the web.
2. Go to **Plugins**.
3. Select the **plus** button, then **Add custom MCP server**.
4. Enter a name (e.g. `Kinexus`) and optionally a description.
5. Under **Connection**, enter the Server URL (paste the production `/ai/mcp` URL from Kinexus).
6. Configure authentication → **OAuth** (leave advanced settings on discovery / DCR unless the portal requires overrides).
7. Review the risk warning → check **I understand and want to continue**.
8. Select **Create as a plugin**, review discovered tools, then **install** the plugin.
9. Complete Kinexus sign-in / consent (**Allow**).
10. In a new chat, type `@` and select the plugin → try the test prompt.

Kinexus **Open ChatGPT** opens the deepest documented Plugins entry:

```
https://chatgpt.com/plugins
```

Official docs say “Go to ChatGPT Plugins” without a path query that prefills name/URL (unlike Claude’s install link). If that path changes after deploy, mark the in-app deep link **VERIFY AFTER DEPLOY** and update `chatgptInstallDeepLink()`.

## Server requirements (ChatGPT)

- Public HTTPS Streamable HTTP (or SSE) endpoint — production `/ai/mcp`.
- Unauthenticated `/ai/mcp` → **401** with `WWW-Authenticate: Bearer … resource_metadata="…"`.
- Protected-resource metadata: `resource` equals the MCP URL; `authorization_servers` lists the Supabase Auth issuer.
- OAuth 2.1 + DCR + PKCE S256 via Supabase Auth (ChatGPT also supports CIMD; we ship DCR).
- AS metadata should advertise refresh / `offline_access` (or equivalent) so ChatGPT can renew tokens.
- Tools expose `title` plus `readOnlyHint` / `destructiveHint` / `openWorldHint` (portal Scan Tools must show no annotation findings).
- CORS allows `https://chatgpt.com` and `https://chat.openai.com`.

## In-app wizard

Settings → Connected AI chats → Connect → ChatGPT:

- Plain plan line when the user’s ChatGPT plan cannot add a full custom MCP app.
- **Copy URL** — production MCP URL.
- **Open ChatGPT** — Plugins page above.
- Numbered steps + screenshot placeholders + collapsed tips (plan limits, remove/re-add, same Kinexus account).
- Polls for an `mcp_connections` row with platform `chatgpt`, then shows **Connected ✓**.
- **Test it** prompt: `What's on my meal plan this week?`

## Screenshots

Step illustrations in the wizard are placeholders. Replace with real ChatGPT Plugins UI screenshots after production deploy.

## Directory / plugin submission

See [chatgpt-submission-checklist.md](./chatgpt-submission-checklist.md). Do not submit until the checklist owner is ready.
