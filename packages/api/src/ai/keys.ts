import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';
import { createUserClient, readBearerToken } from '../auth.js';
import { keyLast4, providerLabel, resolveHouseholdAiKey } from './detect.js';
import { assertAiKeyRateLimit } from './keys-rate-limit.js';
import { scrubErrorMessage } from './scrub.js';
import type { AiProvider } from './provider.js';

export type HouseholdAiKeyMeta = {
  hasKey: boolean;
  provider: AiProvider | null;
  providerLabel: string | null;
  last4: string | null;
  keyStatus: string | null;
  lastCheckedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  allowed: boolean;
};

export type HouseholdAiKeyAccessRow = {
  userId: string;
  displayName: string;
  handle: string | null;
  allowed: boolean;
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function requireAdmin(userId: string, householdId: string): Promise<void> {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from('household_members')
    .select('role')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || (data.role !== 'owner' && data.role !== 'admin')) {
    throw new HttpError(403, 'Only an owner or admin can manage the household AI key.');
  }
}

async function requireMember(userId: string, householdId: string): Promise<void> {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Not a member of this household');
}

function asHouseholdId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('householdId is required');
  return value.trim();
}

export async function handleGetAiKey(
  userId: string,
  householdIdRaw: string,
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    if (!isServiceRoleConfigured()) throw new Error('API is not configured');
    const householdId = asHouseholdId(householdIdRaw);
    await requireMember(userId, householdId);

    const token = readBearerToken(request);
    const userClient = createUserClient(token);
    const { data, error } = await userClient.rpc('my_household_ai_key', { p_household_id: householdId });
    if (error) throw new Error(error.message);

    const row = Array.isArray(data) ? data[0] : data;
    const hasKey = Boolean(row?.has_key);
    const provider = (row?.provider as AiProvider | null) ?? null;
    const body: HouseholdAiKeyMeta = {
      hasKey,
      provider,
      providerLabel: provider ? providerLabel(provider) : null,
      last4: typeof row?.last4 === 'string' ? row.last4 : null,
      keyStatus: typeof row?.key_status === 'string' ? row.key_status : null,
      lastCheckedAt: typeof row?.last_checked_at === 'string' ? row.last_checked_at : null,
      createdAt: typeof row?.created_at === 'string' ? row.created_at : null,
      updatedAt: typeof row?.updated_at === 'string' ? row.updated_at : null,
      allowed: row?.allowed === true,
    };
    return { status: 200, body };
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 400;
    return { status, body: { error: scrubErrorMessage(err) } };
  }
}

export async function handleSetAiKey(
  userId: string,
  body: { householdId?: unknown; key?: unknown; provider?: unknown },
): Promise<{ status: number; body: unknown }> {
  try {
    if (!isServiceRoleConfigured()) throw new Error('API is not configured');
    const householdId = asHouseholdId(body.householdId);
    await requireAdmin(userId, householdId);
    await assertAiKeyRateLimit(userId);

    const key = typeof body.key === 'string' ? body.key.trim() : '';
    if (!key) throw new Error('Paste an API key.');

    const resolved = await resolveHouseholdAiKey({ key, provider: body.provider });
    if (!resolved.ok) {
      if ('needsProvider' in resolved && resolved.needsProvider) {
        return { status: 400, body: { error: 'Choose a provider for this key.', needsProvider: true } };
      }
      throw new Error('error' in resolved ? resolved.error : 'Could not validate that key.');
    }

    const last4 = keyLast4(key);
    const admin = createServiceClient();
    const { error } = await admin.rpc('internal_store_household_ai_key', {
      p_household_id: householdId,
      p_provider: resolved.provider,
      p_secret: key,
      p_last4: last4,
      p_key_status: 'valid',
      p_actor: userId,
    });
    if (error) throw new Error(error.message);

    return {
      status: 200,
      body: {
        hasKey: true,
        provider: resolved.provider,
        providerLabel: providerLabel(resolved.provider),
        last4,
        keyStatus: 'valid',
        allowed: true,
      } satisfies Partial<HouseholdAiKeyMeta>,
    };
  } catch (err) {
    const status =
      err instanceof HttpError
        ? err.status
        : err && typeof err === 'object' && 'code' in err && err.code === 'rate_limited'
          ? 429
          : 400;
    return { status, body: { error: scrubErrorMessage(err) } };
  }
}

export async function handleDeleteAiKey(
  userId: string,
  body: { householdId?: unknown },
): Promise<{ status: number; body: unknown }> {
  try {
    if (!isServiceRoleConfigured()) throw new Error('API is not configured');
    const householdId = asHouseholdId(body.householdId);
    await requireAdmin(userId, householdId);

    const admin = createServiceClient();
    const { error } = await admin.rpc('internal_remove_household_ai_key', {
      p_household_id: householdId,
      p_actor: userId,
    });
    if (error) throw new Error(error.message);
    return { status: 200, body: { ok: true } };
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 400;
    return { status, body: { error: scrubErrorMessage(err) } };
  }
}

export async function handleGetAiKeyAccess(
  userId: string,
  householdIdRaw: string,
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    if (!isServiceRoleConfigured()) throw new Error('API is not configured');
    const householdId = asHouseholdId(householdIdRaw);
    await requireAdmin(userId, householdId);

    const token = readBearerToken(request);
    const userClient = createUserClient(token);
    const { data, error } = await userClient.rpc('household_ai_key_access_list', {
      p_household_id: householdId,
    });
    if (error) throw new Error(error.message);

    const members: HouseholdAiKeyAccessRow[] = (Array.isArray(data) ? data : []).map((row) => ({
      userId: String(row.user_id),
      displayName: typeof row.display_name === 'string' ? row.display_name : 'Member',
      handle: typeof row.handle === 'string' ? row.handle : null,
      allowed: row.allowed === true,
    }));
    return { status: 200, body: { members } };
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 400;
    return { status, body: { error: scrubErrorMessage(err) } };
  }
}

export async function handlePutAiKeyAccess(
  userId: string,
  body: { householdId?: unknown; userId?: unknown; allowed?: unknown },
  request: Request,
): Promise<{ status: number; body: unknown }> {
  try {
    if (!isServiceRoleConfigured()) throw new Error('API is not configured');
    const householdId = asHouseholdId(body.householdId);
    await requireAdmin(userId, householdId);

    const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!targetUserId) throw new Error('userId is required');
    if (typeof body.allowed !== 'boolean') throw new Error('allowed must be true or false');

    const token = readBearerToken(request);
    const userClient = createUserClient(token);
    const { error } = await userClient.rpc('set_household_ai_key_access', {
      p_household_id: householdId,
      p_user_id: targetUserId,
      p_allowed: body.allowed,
    });
    if (error) throw new Error(error.message);
    return { status: 200, body: { ok: true } };
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 400;
    return { status, body: { error: scrubErrorMessage(err) } };
  }
}
