import { chatgptInstallDeepLink } from '@/src/features/connectors/chatgpt';
import { claudeInstallDeepLink } from '@/src/features/connectors/claude';
import { perplexityInstallDeepLink } from '@/src/features/connectors/perplexity';

export type AiChatPlatformId = 'chatgpt' | 'claude' | 'perplexity';

export type AiChatPlatform = {
  id: AiChatPlatformId;
  name: string;
  /** Short glyph shown in the list when no brand asset is wired yet. */
  icon: string;
  /** Official connector directory URL — open this when set (#24 directory listings). */
  directoryUrl: string;
  /** App / deep link for “Open <AI>”. */
  deepLink: string;
  /** Placeholder until setup screenshots ship after deploy. */
  setupImage: 'placeholder';
  enabled: boolean;
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
  },
  {
    id: 'claude',
    name: 'Claude',
    icon: 'C',
    directoryUrl: '',
    deepLink: claudeInstallDeepLink(),
    setupImage: 'placeholder',
    enabled: true,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    icon: 'P',
    directoryUrl: '',
    deepLink: perplexityInstallDeepLink(),
    setupImage: 'placeholder',
    enabled: true,
  },
];

/** Enabled platforms ship in production; `__DEV__` also shows unfinished rows (#24). */
export function visibleAiChatPlatforms(isDev: boolean = typeof __DEV__ !== 'undefined' && __DEV__): AiChatPlatform[] {
  return AI_CHAT_PLATFORMS.filter((platform) => platform.enabled || isDev);
}

export function aiChatPlatformById(id: string): AiChatPlatform | undefined {
  return AI_CHAT_PLATFORMS.find((platform) => platform.id === id);
}
