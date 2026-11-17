import AsyncStorage from '@react-native-async-storage/async-storage';

export type AiChatNudgeSection = 'today' | 'calendar' | 'meals' | 'lists' | 'finances' | 'train';

export const MCP_CONNECTIONS_QUERY_KEY = ['mcp-connections'] as const;
export const AI_CHAT_TIPS_DISMISSED_QUERY_KEY = ['ai-chat-tips-dismissed'] as const;

function tipsDismissedKey(userId: string): string {
  return `ai-chat:tips-dismissed:${userId}`;
}

export async function loadAiChatTipsDismissed(userId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(tipsDismissedKey(userId));
    return raw === '1';
  } catch {
    return false;
  }
}

export async function setAiChatTipsDismissed(userId: string, dismissed: boolean): Promise<void> {
  await AsyncStorage.setItem(tipsDismissedKey(userId), dismissed ? '1' : '0');
}

/** Short line shown on a section that works with connected AI chats. */
export function aiChatNudgeCopy(section: AiChatNudgeSection): string {
  switch (section) {
    case 'today':
      return 'Connect an AI chat to ask about today — tasks, meals, and plans.';
    case 'calendar':
      return 'Connect an AI chat to check or add family events by talking.';
    case 'meals':
      return 'Connect an AI chat to ask about meal plans, recipes, and shopping.';
    case 'lists':
      return 'Connect an AI chat to update wishlists, watchlists, and checklists.';
    case 'finances':
      return 'Connect an AI chat to ask about budget and money tracking.';
    case 'train':
      return 'Connect an AI chat to ask about workouts and training plans.';
  }
}

/** Full breakdown for the More info sheet — simple language. */
export const AI_CHAT_CAPABILITY_BULLETS: readonly string[] = [
  "See what's on today and this week across the household",
  'Check and change the meal plan, recipes, pantry, and shopping list',
  'Look up and add family calendar events',
  'Update wishlists, watchlists, checklists, and your reading list',
  'Ask about workouts, training plans, and logged sessions',
  'Check budget months, transactions, and investment notes',
];

export type AiChatPlanTier = 'free' | 'paid';

export type AiChatPlanInfo = {
  id: string;
  name: string;
  tier: AiChatPlanTier;
  detail: string;
};

/** Which AI chats can connect on a free tier vs need a paid plan. */
export const AI_CHAT_PLAN_INFO: readonly AiChatPlanInfo[] = [
  {
    id: 'claude',
    name: 'Claude',
    tier: 'free',
    detail: 'Free plan can add 1 custom connector.',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    tier: 'paid',
    detail: 'Needs Business or Enterprise (Free and Plus can’t add custom apps; Pro is read-only).',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    tier: 'paid',
    detail: 'Needs Pro, Max, or Enterprise.',
  },
  {
    id: 'grok',
    name: 'Grok',
    tier: 'paid',
    detail: 'Usually needs a paid Grok plan (Business/Enterprise need an admin first).',
  },
];
