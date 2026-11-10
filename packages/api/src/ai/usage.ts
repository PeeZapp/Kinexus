import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';
import type { AiFeature } from './features.js';
import type { AiProvider } from './provider.js';
import { scrubErrorMessage } from './scrub.js';

export type AiUsageStatus = 'ok' | 'error' | 'blocked_no_access' | 'blocked_paused';
export type AiKeySource = 'household' | 'platform';

export type AiUsageRow = {
  householdId: string;
  userId: string;
  feature: AiFeature | string;
  provider?: AiProvider | null;
  keySource?: AiKeySource | null;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  webSearchUsed?: boolean;
  status: AiUsageStatus;
};

/** One row per AI attempt. Never logs prompts or keys. */
export async function logAiUsage(row: AiUsageRow): Promise<void> {
  if (!isServiceRoleConfigured()) return;
  try {
    const admin = createServiceClient();
    const { error } = await admin.rpc('internal_insert_ai_usage_log', {
      p_household_id: row.householdId,
      p_user_id: row.userId,
      p_feature: row.feature,
      p_provider: row.provider ?? null,
      p_key_source: row.keySource ?? null,
      p_model: row.model ?? null,
      p_input_tokens: row.inputTokens ?? null,
      p_output_tokens: row.outputTokens ?? null,
      p_web_search_used: Boolean(row.webSearchUsed),
      p_status: row.status,
    });
    if (error) {
      console.warn('[ai-usage]', scrubErrorMessage(error.message));
    }
  } catch (err) {
    console.warn('[ai-usage]', scrubErrorMessage(err));
  }
}
