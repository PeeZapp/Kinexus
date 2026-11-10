import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { hasScope } from './scopes.js';
import { MCP_TOOL_REGISTRY } from './registry.js';
import { mcpWwwAuthenticate, resolveMcpCaller, type McpCaller } from './context.js';
import { assertMcpRateLimit } from './rate-limit.js';
import { logMcp } from './log.js';
import { mcpPublicOrigin, oauthProtectedResourceMetadataUrl } from './origin.js';
import { scrubErrorMessage } from '../ai/scrub.js';

function unauthorizedResponse(request: Request, message: string): Response {
  const origin = mcpPublicOrigin(request);
  const meta = oauthProtectedResourceMetadataUrl(origin);
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': mcpWwwAuthenticate(meta),
    },
  });
}

function buildServer(caller: McpCaller): McpServer {
  const server = new McpServer(
    { name: 'kinexus', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  for (const tool of MCP_TOOL_REGISTRY) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      },
      async (args) => {
        if (!hasScope(caller.scopes, tool.scope)) {
          throw new Error(`Missing scope ${tool.scope}`);
        }
        await assertMcpRateLimit({ userId: caller.userId, clientId: caller.clientId });
        const parsed = tool.inputSchema.parse(args ?? {});
        const result = await tool.handler(parsed, caller);
        const output = tool.outputSchema.parse(result);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output as Record<string, unknown>,
        };
      },
    );
  }

  return server;
}

export async function handleMcpHttp(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  const resolved = await resolveMcpCaller(request);
  if (!resolved.ok) {
    if (resolved.status === 401) return unauthorizedResponse(request, resolved.error);
    return new Response(JSON.stringify({ error: resolved.error }), {
      status: resolved.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await assertMcpRateLimit({ userId: resolved.caller.userId, clientId: resolved.caller.clientId });
  } catch (err) {
    const message = scrubErrorMessage(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const server = buildServer(resolved.caller);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return response;
  } catch (err) {
    logMcp({ event: 'mcp_http_error', error: scrubErrorMessage(err) });
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: 'Internal server error' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}
