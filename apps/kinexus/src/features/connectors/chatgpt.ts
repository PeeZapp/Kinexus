/** Production AI-chat MCP URL — ChatGPT must reach a public HTTPS host (never localhost). */
export const CHATGPT_PRODUCTION_MCP_URL = 'https://kinexus-green.vercel.app/ai/mcp';

export const CHATGPT_CONNECTOR_NAME = 'Kinexus';

export const CHATGPT_TEST_PROMPT = "What's on my meal plan this week?";

export const CHATGPT_COPY_URL_LABEL = 'Copy URL';
export const CHATGPT_OPEN_LABEL = 'Open ChatGPT';

/**
 * Deepest Plugins entry OpenAI docs support without a prefilled URL modal.
 * Official copy: “Go to ChatGPT Plugins” — path verified against common chatgpt.com/plugins;
 * re-check after deploy if the UI moves.
 */
export function chatgptInstallDeepLink(): string {
  return 'https://chatgpt.com/plugins';
}

/** Shown above the steps so Free/Plus/Pro users are not left waiting silently. */
export const CHATGPT_PLAN_NOTICE =
  'Needs ChatGPT Business or Enterprise/Edu. Free and Plus can’t add custom MCP apps; Pro is read-only.';

export type ChatgptSetupStep = {
  n: number;
  title: string;
  detail: string;
  /** Placeholder until real screenshots ship after deploy. */
  image: 'placeholder';
};

export const CHATGPT_SETUP_STEPS: readonly ChatgptSetupStep[] = [
  {
    n: 1,
    title: 'Open ChatGPT',
    detail: 'Opens Plugins. Use Copy URL first — never type the address.',
    image: 'placeholder',
  },
  {
    n: 2,
    title: 'Add custom MCP',
    detail: 'Plus → Add custom MCP server → paste URL → OAuth.',
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
    detail: 'Install the plugin, then return here — Connected appears automatically.',
    image: 'placeholder',
  },
];

export const CHATGPT_TIPS: readonly string[] = [
  'Custom MCP with write tools needs Business or Enterprise/Edu. Pro is read/fetch only.',
  'Developer mode is not required in the current Plugins UI — acknowledge the risk warning instead.',
  'If Connect fails, remove the plugin in ChatGPT and re-add it.',
  'Sign in with the same Kinexus account you use here. Web only.',
];
