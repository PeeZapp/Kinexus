import {
  CHATGPT_COPY_URL_LABEL,
  CHATGPT_OPEN_LABEL,
  CHATGPT_PRODUCTION_MCP_URL,
  CHATGPT_SETUP_PROMPT_SETTINGS,
  CHATGPT_TEST_PROMPT,
  CHATGPT_TIPS,
  chatgptInstallDeepLink,
} from '@/src/features/connectors/chatgpt';
import {
  CLAUDE_COPY_URL_LABEL,
  CLAUDE_OPEN_LABEL,
  CLAUDE_PRODUCTION_MCP_URL,
  CLAUDE_SETUP_PROMPT_SETTINGS,
  CLAUDE_TEST_PROMPT,
  CLAUDE_TIPS,
  claudeInstallDeepLink,
} from '@/src/features/connectors/claude';
import {
  GROK_COPY_URL_LABEL,
  GROK_OPEN_LABEL,
  GROK_PRODUCTION_MCP_URL,
  GROK_SETUP_PROMPT_SETTINGS,
  GROK_TEST_PROMPT,
  GROK_TIPS,
  grokInstallDeepLink,
} from '@/src/features/connectors/grok';
import {
  PERPLEXITY_COPY_URL_LABEL,
  PERPLEXITY_OPEN_LABEL,
  PERPLEXITY_PRODUCTION_MCP_URL,
  PERPLEXITY_SETUP_PROMPT_SETTINGS,
  PERPLEXITY_TEST_PROMPT,
  PERPLEXITY_TIPS,
  perplexityInstallDeepLink,
} from '@/src/features/connectors/perplexity';

export type AiChatPlatformId = 'chatgpt' | 'claude' | 'perplexity' | 'grok';

export type AiChatPlatform = {
  id: AiChatPlatformId;
  name: string;
  /** Short glyph shown in the list when no brand asset is wired yet. */
  icon: string;
  /** Official connector directory URL — open this when set (#24 directory listings). */
  directoryUrl: string;
  /**
   * Verified open URL (web and/or universal link). Used on desktop and as fallback.
   * Do not put unverified native schemes here.
   */
  deepLink: string;
  /**
   * Optional verified native-app scheme (e.g. myapp://…). Only set when docs confirm
   * it opens the connector flow. Tried on phone before falling back to deepLink.
   */
  appDeepLink?: string;
  /** Placeholder until setup screenshots ship after deploy. */
  setupImage: 'placeholder';
  enabled: boolean;
  productionMcpUrl: string;
  copyUrlLabel: string;
  openLabel: string;
  tips: readonly string[];
  testPrompt: string;
  /** Platform-specific settings / plan lines for the pasteable guide. */
  setupPromptSettings: readonly string[];
  /** Surface hint for the guide: web vs phone. */
  guideSurface: 'web' | 'web or phone';
};

export const AI_CHAT_PLATFORMS: readonly AiChatPlatform[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    icon: 'G',
    directoryUrl: '',
    deepLink: chatgptInstallDeepLink(),
    setupImage: 'placeholder',
    enabled: true,
    productionMcpUrl: CHATGPT_PRODUCTION_MCP_URL,
    copyUrlLabel: CHATGPT_COPY_URL_LABEL,
    openLabel: CHATGPT_OPEN_LABEL,
    tips: CHATGPT_TIPS,
    testPrompt: CHATGPT_TEST_PROMPT,
    setupPromptSettings: CHATGPT_SETUP_PROMPT_SETTINGS,
    guideSurface: 'web',
  },
  {
    id: 'claude',
    name: 'Claude',
    icon: 'C',
    directoryUrl: '',
    // Install link is also an AASA-claimed universal link for modal=add-custom-connector.
    deepLink: claudeInstallDeepLink(),
    setupImage: 'placeholder',
    enabled: true,
    productionMcpUrl: CLAUDE_PRODUCTION_MCP_URL,
    copyUrlLabel: CLAUDE_COPY_URL_LABEL,
    openLabel: CLAUDE_OPEN_LABEL,
    tips: CLAUDE_TIPS,
    testPrompt: CLAUDE_TEST_PROMPT,
    setupPromptSettings: CLAUDE_SETUP_PROMPT_SETTINGS,
    guideSurface: 'web or phone',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    icon: 'P',
    directoryUrl: '',
    deepLink: perplexityInstallDeepLink(),
    setupImage: 'placeholder',
    enabled: true,
    productionMcpUrl: PERPLEXITY_PRODUCTION_MCP_URL,
    copyUrlLabel: PERPLEXITY_COPY_URL_LABEL,
    openLabel: PERPLEXITY_OPEN_LABEL,
    tips: PERPLEXITY_TIPS,
    testPrompt: PERPLEXITY_TEST_PROMPT,
    setupPromptSettings: PERPLEXITY_SETUP_PROMPT_SETTINGS,
    guideSurface: 'web',
  },
  {
    id: 'grok',
    name: 'Grok',
    icon: 'X',
    directoryUrl: '',
    deepLink: grokInstallDeepLink(),
    setupImage: 'placeholder',
    enabled: true,
    productionMcpUrl: GROK_PRODUCTION_MCP_URL,
    copyUrlLabel: GROK_COPY_URL_LABEL,
    openLabel: GROK_OPEN_LABEL,
    tips: GROK_TIPS,
    testPrompt: GROK_TEST_PROMPT,
    setupPromptSettings: GROK_SETUP_PROMPT_SETTINGS,
    guideSurface: 'web',
  },
];

export const COPY_GUIDE_LABEL = 'Copy guide';

/** Enabled platforms ship in production; `__DEV__` also shows unfinished rows (#24). */
export function visibleAiChatPlatforms(isDev: boolean = typeof __DEV__ !== 'undefined' && __DEV__): AiChatPlatform[] {
  return AI_CHAT_PLATFORMS.filter((platform) => platform.enabled || isDev);
}

export function aiChatPlatformById(id: string): AiChatPlatform | undefined {
  return AI_CHAT_PLATFORMS.find((platform) => platform.id === id);
}

export function guideExplainer(platformName: string): string {
  return `Paste this into ${platformName} (e.g. ${platformName} Chat) and it will walk you through connecting Kinexus.`;
}

/** Exactly the three primary actions on the connect screen. */
export function connectWizardActions(platform: AiChatPlatform): {
  copyGuide: string;
  open: string;
  copyUrl: string;
  explainer: string;
} {
  return {
    copyGuide: COPY_GUIDE_LABEL,
    open: platform.openLabel,
    copyUrl: platform.copyUrlLabel,
    explainer: guideExplainer(platform.name),
  };
}

/** Verified open target; Claude prefills with the MCP URL being copied. */
export function openTargetForPlatform(
  platform: AiChatPlatform,
  mcpUrl: string,
  opts: { isWeb: boolean; canOpenApp?: boolean } = { isWeb: true },
): string {
  if (platform.id === 'claude') return claudeInstallDeepLink(mcpUrl);
  return resolveAiChatOpenUrl(platform, opts);
}

/**
 * Prefer a verified native appDeepLink on phone when the OS can open it;
 * otherwise return the verified web/universal deepLink.
 */
export function resolveAiChatOpenUrl(
  platform: AiChatPlatform,
  opts: { isWeb: boolean; canOpenApp?: boolean },
): string {
  if (!opts.isWeb && platform.appDeepLink && opts.canOpenApp !== false) {
    return platform.appDeepLink;
  }
  return platform.deepLink;
}

/** Guide text the user pastes into that AI so it walks them through connector setup. */
export function buildAiChatSetupPrompt(platform: AiChatPlatform, mcpUrl: string): string {
  const settings = platform.setupPromptSettings.map((line) => `- ${line}`).join('\n');
  return [
    `I want to connect the Kinexus app to you as a custom connector. Please guide me step by step.`,
    `First give me this URL in a code block so I can copy it:`,
    '',
    '```',
    mcpUrl,
    '```',
    '',
    `Then tell me exactly where to paste it in your settings on ${platform.guideSurface}, and which options to pick:`,
    settings,
    `Wait for me to confirm each step. After I sign in to Kinexus and approve, suggest a test like "${platform.testPrompt}".`,
  ].join('\n');
}
