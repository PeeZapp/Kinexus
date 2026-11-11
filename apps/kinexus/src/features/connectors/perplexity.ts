/** Production AI-chat MCP URL — Perplexity must reach a public HTTPS host (never localhost). */
export const PERPLEXITY_PRODUCTION_MCP_URL = 'https://kinexus-green.vercel.app/ai/mcp';

export const PERPLEXITY_CONNECTOR_NAME = 'Kinexus';

export const PERPLEXITY_TEST_PROMPT = "What's on my meal plan this week?";

export const PERPLEXITY_COPY_URL_LABEL = 'Copy URL';
export const PERPLEXITY_OPEN_LABEL = 'Open Perplexity';

/**
 * Verified Plugins URL from Perplexity Help Center.
 * No documented native-app deep link for adding custom MCP — add on the website.
 */
export function perplexityInstallDeepLink(): string {
  return 'https://www.perplexity.ai/computer/plugins';
}

/** Shown in troubleshooting so Free users are not left waiting silently. */
export const PERPLEXITY_PLAN_NOTICE = 'Needs Perplexity Pro, Max or Enterprise';

export const PERPLEXITY_TIPS: readonly string[] = [
  PERPLEXITY_PLAN_NOTICE,
  'Add the connector on the website (Plugins). The phone app may not support adding custom connectors.',
  'Org admins may turn off Allow members to add custom connectors.',
  'If Connect fails, remove the connector in Perplexity and re-add it.',
  'Sign in with the same Kinexus account you use here.',
];

/** Platform settings for the pasteable guide (addressed to Perplexity). */
export const PERPLEXITY_SETUP_PROMPT_SETTINGS: readonly string[] = [
  'Plan: Perplexity Pro, Max, or Enterprise.',
  'Path (website): Plugins → Add custom → Add MCP connector → Remote → paste URL → Advanced → Authentication → OAuth; Transport → Streamable HTTP.',
  'Add connectors on the Perplexity website — the phone app may not support adding custom connectors.',
];
