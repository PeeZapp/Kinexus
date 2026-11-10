/** Production AI-chat MCP URL — Perplexity must reach a public HTTPS host (never localhost). */
export const PERPLEXITY_PRODUCTION_MCP_URL = 'https://kinexus-green.vercel.app/ai/mcp';

export const PERPLEXITY_CONNECTOR_NAME = 'Kinexus';

export const PERPLEXITY_TEST_PROMPT = "What's on my meal plan this week?";

export const PERPLEXITY_COPY_URL_LABEL = 'Copy URL';
export const PERPLEXITY_OPEN_LABEL = 'Open Perplexity';

/**
 * Deepest Plugins entry Perplexity docs support without a prefilled URL modal.
 * Help Center: open Plugins → Add custom → Add MCP connector.
 */
export function perplexityInstallDeepLink(): string {
  return 'https://www.perplexity.ai/computer/plugins';
}

/** Shown above the steps so Free users are not left waiting silently. */
export const PERPLEXITY_PLAN_NOTICE = 'Needs Perplexity Pro, Max or Enterprise';

export type PerplexitySetupStep = {
  n: number;
  title: string;
  detail: string;
  /** Placeholder until real screenshots ship after deploy. */
  image: 'placeholder';
};

export const PERPLEXITY_SETUP_STEPS: readonly PerplexitySetupStep[] = [
  {
    n: 1,
    title: 'Open Perplexity',
    detail: 'Opens Plugins. Use Copy URL first — never type the address.',
    image: 'placeholder',
  },
  {
    n: 2,
    title: 'Add custom MCP',
    detail: 'Add custom → Add MCP connector → Remote → paste URL.',
    image: 'placeholder',
  },
  {
    n: 3,
    title: 'Choose OAuth',
    detail: 'Advanced → Authentication → OAuth (Streamable HTTP).',
    image: 'placeholder',
  },
  {
    n: 4,
    title: 'Done',
    detail: 'Add → open the card → Allow with the same Kinexus account.',
    image: 'placeholder',
  },
];

export const PERPLEXITY_TIPS: readonly string[] = [
  'Needs Perplexity Pro, Max or Enterprise.',
  'Org admins may turn off Allow members to add custom connectors.',
  'If Connect fails, remove the connector in Perplexity and re-add it.',
  'Sign in with the same Kinexus account you use here.',
];
