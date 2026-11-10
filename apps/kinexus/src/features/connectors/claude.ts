/** Production AI-chat MCP URL — Claude must reach a public HTTPS host (never localhost). */
export const CLAUDE_PRODUCTION_MCP_URL = 'https://kinexus-green.vercel.app/ai/mcp';

export const CLAUDE_CONNECTOR_NAME = 'Kinexus';

export const CLAUDE_TEST_PROMPT = "What's on my meal plan this week?";

export const CLAUDE_COPY_URL_LABEL = 'Copy URL';
export const CLAUDE_OPEN_LABEL = 'Open Claude';

/** Prefills Customize → Connectors → Add custom connector (official install-link format). */
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

export type ClaudeSetupStep = {
  n: number;
  title: string;
  detail: string;
  /** Placeholder until real screenshots ship after deploy. */
  image: 'placeholder';
};

export const CLAUDE_SETUP_STEPS: readonly ClaudeSetupStep[] = [
  {
    n: 1,
    title: 'Open Claude',
    detail: 'Opens Add custom connector with Kinexus already filled in.',
    image: 'placeholder',
  },
  {
    n: 2,
    title: 'Continue',
    detail: 'Confirm the URL, then Continue through authentication.',
    image: 'placeholder',
  },
  {
    n: 3,
    title: 'Sign in',
    detail: 'Use the same Kinexus account → Allow.',
    image: 'placeholder',
  },
  {
    n: 4,
    title: 'Done',
    detail: 'Return here — Connected appears automatically.',
    image: 'placeholder',
  },
];

export const CLAUDE_TIPS: readonly string[] = [
  'Free plan allows 1 custom connector.',
  'If Connect fails, remove the connector in Claude and re-add it.',
  'Sign in with the same Kinexus account you use here.',
];

export function connectionForPlatform(
  connections: readonly { id: string; platform: string }[],
  platformId: string,
): { id: string; platform: string } | undefined {
  return connections.find((row) => row.platform === platformId);
}
