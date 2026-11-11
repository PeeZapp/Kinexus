/** Production AI-chat MCP URL — Grok must reach a public HTTPS host (never localhost). */
export const GROK_PRODUCTION_MCP_URL = 'https://kinexus-green.vercel.app/ai/mcp';

export const GROK_CONNECTOR_NAME = 'Kinexus';

export const GROK_TEST_PROMPT = "What's on my meal plan this week?";

export const GROK_COPY_URL_LABEL = 'Copy URL';
export const GROK_OPEN_LABEL = 'Open Grok';

/**
 * Verified web URL from docs.x.ai/grok/connectors.
 * No documented native-app deep link for custom MCP connectors.
 */
export function grokInstallDeepLink(): string {
  return 'https://grok.com/connectors';
}

/**
 * Live docs: connectors available to all Grok users;
 * Business/Enterprise need admin provisioning. Soft-gate for paid-plan disagreement.
 */
export const GROK_PLAN_NOTICE =
  'May need a paid Grok plan. Business/Enterprise: an admin must provision the connector first.';

export const GROK_TIPS: readonly string[] = [
  GROK_PLAN_NOTICE,
  'Path: grok.com/connectors → New Connector → Custom → paste MCP URL → complete sign-in.',
  'If sign-in fails, remove the connector in Grok and re-add it.',
  'Sign in with the same Kinexus account you use here.',
];

/** Platform settings for the pasteable guide (addressed to Grok). */
export const GROK_SETUP_PROMPT_SETTINGS: readonly string[] = [
  'May need a paid Grok plan.',
  'Business/Enterprise: a team admin must provision the connector in the cloud console first.',
  'Path: grok.com/connectors → New Connector → Custom → paste MCP URL → complete sign-in.',
];
