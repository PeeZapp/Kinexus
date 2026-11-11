/** Production AI-chat MCP URL — Claude must reach a public HTTPS host (never localhost). */
export const CLAUDE_PRODUCTION_MCP_URL = 'https://kinexus-green.vercel.app/ai/mcp';

export const CLAUDE_CONNECTOR_NAME = 'Kinexus';

export const CLAUDE_TEST_PROMPT = "What's on my meal plan this week?";

export const CLAUDE_COPY_URL_LABEL = 'Copy URL';
export const CLAUDE_OPEN_LABEL = 'Open Claude';

/**
 * Official custom-connector install link (claude.com docs).
 * AASA claims /customize/connectors?modal=add-custom-connector — may open the Claude app on phone.
 * Claude Code `claude://` schemes are Code-only and are not used for connectors.
 */
export function claudeInstallDeepLink(
  mcpUrl: string = CLAUDE_PRODUCTION_MCP_URL,
  name: string = CLAUDE_CONNECTOR_NAME,
): string {
  const params = new URLSearchParams({
    modal: 'add-custom-connector',
    connectorName: name,
    connectorUrl: mcpUrl,
  });
  return `https://claude.ai/customize/connectors?${params.toString()}`;
}

export const CLAUDE_TIPS: readonly string[] = [
  'Free plan allows 1 custom connector.',
  'Installing custom connectors on mobile is in beta — web or Claude Desktop is the primary path.',
  'If Connect fails, remove the connector in Claude and re-add it.',
  'Sign in with the same Kinexus account you use here.',
];

/** Platform settings for the pasteable guide (addressed to Claude). */
export const CLAUDE_SETUP_PROMPT_SETTINGS: readonly string[] = [
  'Path: Customize → Connectors → Add → Custom → Web → paste name + MCP URL.',
  'Authentication: "Sign in now"',
  'OAuth client: "Register automatically"',
  'Request headers: none',
  'Advanced transport: "Streamable HTTP"',
  'Custom connectors are primarily added on the website or Claude Desktop; mobile install is in beta.',
];

export function connectionForPlatform(
  connections: readonly { id: string; platform: string }[],
  platformId: string,
): { id: string; platform: string } | undefined {
  return connections.find((row) => row.platform === platformId);
}
