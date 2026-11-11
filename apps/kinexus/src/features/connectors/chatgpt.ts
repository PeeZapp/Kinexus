/** Production AI-chat MCP URL — ChatGPT must reach a public HTTPS host (never localhost). */
export const CHATGPT_PRODUCTION_MCP_URL = 'https://kinexus-green.vercel.app/ai/mcp';

export const CHATGPT_CONNECTOR_NAME = 'Kinexus';

export const CHATGPT_TEST_PROMPT = "What's on my meal plan this week?";

export const CHATGPT_COPY_URL_LABEL = 'Copy URL';
export const CHATGPT_OPEN_LABEL = 'Open ChatGPT';

/**
 * Verified web URL from OpenAI docs (“Go to ChatGPT Plugins”).
 * No documented native-app deep link for adding custom MCP — web only.
 */
export function chatgptInstallDeepLink(): string {
  return 'https://chatgpt.com/plugins';
}

/** Shown in troubleshooting; Free/Plus/Pro users are not left waiting silently. */
export const CHATGPT_PLAN_NOTICE =
  'Needs ChatGPT Business or Enterprise/Edu. Free and Plus can’t add custom MCP apps; Pro is read-only.';

export const CHATGPT_TIPS: readonly string[] = [
  CHATGPT_PLAN_NOTICE,
  'Add custom MCP on the website (chatgpt.com/plugins). The phone app does not support adding custom MCP servers.',
  'If your workspace needs it: Settings → Connectors → Advanced → enable Developer Mode.',
  'If Connect fails, remove the plugin in ChatGPT and re-add it.',
  'Sign in with the same Kinexus account you use here.',
];

/** Platform settings for the pasteable guide (addressed to ChatGPT). */
export const CHATGPT_SETUP_PROMPT_SETTINGS: readonly string[] = [
  'Plan: Business/Enterprise/Edu for full access; Pro is read-only; Free and Plus cannot add custom MCP apps.',
  'Developer mode: Workspace Settings → Connectors → Advanced → enable Developer Mode when your workspace requires it for custom MCP.',
  'Path (website): chatgpt.com/plugins → Plus → Add custom MCP server → paste URL → OAuth → Create as a plugin → Install.',
  'Add connectors on the ChatGPT website — the phone app does not support adding custom MCP servers.',
];
