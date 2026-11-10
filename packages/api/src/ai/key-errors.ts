import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';
import { scrubErrorMessage } from './scrub.js';

export type AiKeyStatusValue = 'valid' | 'invalid' | 'unchecked';

/** Map provider HTTP/auth/quota failures onto household key_status. Never includes the key. */
export function classifyProviderKeyFailure(err: unknown): AiKeyStatusValue {
  const raw = err instanceof Error ? err.message : String(err);
  const message = scrubErrorMessage(raw).toLowerCase();
  const statusMatch = message.match(/\((\d{3})\)/);
  const status = statusMatch ? Number(statusMatch[1]) : NaN;

  if (
    status === 401 ||
    status === 403 ||
    message.includes('invalid_api_key') ||
    message.includes('incorrect api key') ||
    message.includes('invalid x-api-key') ||
    message.includes('authentication') ||
    message.includes('unauthorized') ||
    message.includes('expired') ||
    message.includes('permission')
  ) {
    return 'invalid';
  }

  if (
    status === 402 ||
    status === 429 ||
    message.includes('insufficient_quota') ||
    message.includes('quota') ||
    message.includes('credit') ||
    message.includes('billing') ||
    message.includes('rate limit') ||
    message.includes('rate_limit') ||
    message.includes('too many requests')
  ) {
    return 'invalid';
  }

  if (status >= 400 && status < 500) return 'invalid';
  return 'invalid';
}

export async function markHouseholdKeyStatus(
  householdId: string,
  status: AiKeyStatusValue,
): Promise<void> {
  if (!isServiceRoleConfigured()) return;
  try {
    const admin = createServiceClient();
    await admin.rpc('internal_set_household_ai_key_status', {
      p_household_id: householdId,
      p_key_status: status,
    });
  } catch (err) {
    console.warn('[ai-key-status]', scrubErrorMessage(err));
  }
}
