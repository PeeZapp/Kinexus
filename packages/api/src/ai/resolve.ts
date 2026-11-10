import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';
import { featureWantsWebSearch, type AiFeature, WEB_SEARCH_FEATURES } from './features.js';
import { classifyProviderKeyFailure, markHouseholdKeyStatus } from './key-errors.js';
import type { AiClient, AiCompleteInput, AiProvider } from './provider.js';
import { AI_PROVIDERS, createAiClientFromKey, createPlatformAiClient, providerDefinition } from './registry.js';
import { scrubErrorMessage } from './scrub.js';
import { logAiUsage, type AiKeySource } from './usage.js';

export { WEB_SEARCH_FEATURES, featureWantsWebSearch };
export type { AiFeature };

export type AiBlockedCode = 'no_access' | 'key_paused';

export class AiBlockedError extends Error {
  readonly code: AiBlockedCode;

  constructor(code: AiBlockedCode) {
    super(
      code === 'no_access'
        ? 'AI is turned off for you in this household. Ask an admin.'
        : "Your household's AI key isn't working. AI is paused until an admin fixes it.",
    );
    this.name = 'AiBlockedError';
    this.code = code;
  }
}

export type ResolveAiInput = {
  userId: string;
  householdId: string;
  feature: AiFeature;
  /** Prefer a platform provider when using platform keys (import dual-client path). */
  preferredProvider?: AiProvider;
};

export type ResolvedAiClient = {
  client: AiClient;
  keySource: AiKeySource;
  provider: AiProvider;
  model: string;
  supportsWebSearch: boolean;
  userId: string;
  householdId: string;
  feature: AiFeature;
};

type KeyMaterial = {
  provider: AiProvider;
  keyStatus: string;
  secret: string;
};

async function assertMember(userId: string, householdId: string): Promise<void> {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const err = new Error('Not a member of this household');
    (err as { status?: number }).status = 403;
    throw err;
  }
}

async function loadKeyMaterial(householdId: string): Promise<KeyMaterial | null> {
  const admin = createServiceClient();
  const { data, error } = await admin.rpc('internal_get_household_ai_key_material', {
    p_household_id: householdId,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.secret !== 'string' || !row.secret.trim()) return null;
  const provider = row.provider as AiProvider;
  if (!(provider in AI_PROVIDERS)) return null;
  return {
    provider,
    keyStatus: typeof row.key_status === 'string' ? row.key_status : 'unchecked',
    secret: row.secret.trim(),
  };
}

async function memberAllowed(userId: string, householdId: string): Promise<boolean> {
  const admin = createServiceClient();
  const { data, error } = await admin.rpc('can_use_household_ai_key', {
    p_user_id: userId,
    p_household_id: householdId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

function platformModelFor(provider: AiProvider): string {
  const def = providerDefinition(provider);
  if (provider === 'deepseek') return process.env.DEEPSEEK_MODEL?.trim() || def.defaultModel;
  if (provider === 'openai') return process.env.OPENAI_MODEL?.trim() || def.defaultModel;
  if (provider === 'gemini') return process.env.GEMINI_MODEL?.trim() || def.defaultModel;
  if (provider === 'perplexity') return process.env.PERPLEXITY_MODEL?.trim() || def.defaultModel;
  return process.env.ANTHROPIC_MODEL?.trim() || def.defaultModel;
}

function platformResolved(
  input: ResolveAiInput,
  preferred?: AiProvider,
): ResolvedAiClient {
  const client = createPlatformAiClient(preferred);
  const def = providerDefinition(client.provider);
  return {
    client,
    keySource: 'platform',
    provider: client.provider,
    model: platformModelFor(client.provider),
    supportsWebSearch: def.supportsWebSearch,
    userId: input.userId,
    householdId: input.householdId,
    feature: input.feature,
  };
}

function isSystemPlatformCall(resolved: ResolvedAiClient): boolean {
  return resolved.feature === 'catalog_refresh' && resolved.keySource === 'platform';
}

/**
 * Household has no key → platform.
 * Key + allowed + valid → household.
 * Key + not allowed → no_access (no platform fallback).
 * Key + status not ok → key_paused (no platform fallback).
 */
export async function resolveAiClient(input: ResolveAiInput): Promise<ResolvedAiClient> {
  if (!isServiceRoleConfigured()) {
    return platformResolved(input, input.preferredProvider);
  }

  await assertMember(input.userId, input.householdId);

  let material: KeyMaterial | null = null;
  try {
    material = await loadKeyMaterial(input.householdId);
  } catch (err) {
    console.warn('[ai-resolve]', scrubErrorMessage(err));
    return platformResolved(input, input.preferredProvider);
  }

  if (!material) {
    return platformResolved(input, input.preferredProvider);
  }

  if (material.keyStatus !== 'valid') {
    await logAiUsage({
      householdId: input.householdId,
      userId: input.userId,
      feature: input.feature,
      provider: material.provider,
      keySource: 'household',
      model: providerDefinition(material.provider).defaultModel,
      status: 'blocked_paused',
    });
    throw new AiBlockedError('key_paused');
  }

  const allowed = await memberAllowed(input.userId, input.householdId);
  if (!allowed) {
    await logAiUsage({
      householdId: input.householdId,
      userId: input.userId,
      feature: input.feature,
      provider: material.provider,
      keySource: 'household',
      model: providerDefinition(material.provider).defaultModel,
      status: 'blocked_no_access',
    });
    throw new AiBlockedError('no_access');
  }

  const def = providerDefinition(material.provider);
  const client = createAiClientFromKey(material.provider, material.secret);
  return {
    client,
    keySource: 'household',
    provider: material.provider,
    model: def.defaultModel,
    supportsWebSearch: def.supportsWebSearch,
    userId: input.userId,
    householdId: input.householdId,
    feature: input.feature,
  };
}

/** Explicit platform path for crons / catalogue refresh. Never uses household keys. */
export function resolvePlatformAiClient(provider?: AiProvider): AiClient {
  return createPlatformAiClient(provider);
}

const VISION_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const;

function platformVisionKeyPresent(provider: (typeof VISION_PROVIDERS)[number]): boolean {
  if (provider === 'anthropic') return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  if (provider === 'openai') return Boolean(process.env.OPENAI_API_KEY?.trim());
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function firstPlatformVisionClient(input: ResolveAiInput): ResolvedAiClient | null {
  for (const provider of VISION_PROVIDERS) {
    if (!platformVisionKeyPresent(provider)) continue;
    return platformResolved(input, provider);
  }
  return null;
}

/**
 * Resolve a vision-capable client for photo extract.
 * Uses the household key when it supports vision; otherwise falls back to a platform vision provider.
 * Still respects no_access / key_paused from resolveAiClient.
 */
export async function resolveVisionAiClient(input: ResolveAiInput): Promise<ResolvedAiClient> {
  const preferred =
    input.preferredProvider && providerDefinition(input.preferredProvider).supportsVision
      ? input.preferredProvider
      : VISION_PROVIDERS.find(platformVisionKeyPresent);
  const resolved = await resolveAiClient({ ...input, preferredProvider: preferred });
  if (providerDefinition(resolved.provider).supportsVision) return resolved;
  const vision = firstPlatformVisionClient(input);
  if (vision) return vision;
  throw new Error(
    'Photo import needs Anthropic, OpenAI, or Gemini. DeepSeek and Perplexity cannot read photos.',
  );
}

export type AiCompleteResult = {
  text: string;
  resultsMayVary: boolean;
  webSearchUsed: boolean;
  keySource: AiKeySource;
  provider: AiProvider;
};

/**
 * Run one AI completion: web-search downgrade when needed, usage row, key pause on household failure.
 */
export async function completeResolved(
  resolved: ResolvedAiClient,
  input: AiCompleteInput,
): Promise<AiCompleteResult> {
  const wantsSearch = Boolean(input.webSearch) || featureWantsWebSearch(resolved.feature);
  let webSearchUsed = false;
  let resultsMayVary = false;
  let prompt = input;

  if (wantsSearch) {
    if (resolved.supportsWebSearch) {
      prompt = { ...input, webSearch: true };
      webSearchUsed = true;
    } else {
      prompt = { ...input, webSearch: false };
      resultsMayVary = true;
    }
  }

  try {
    const text = await resolved.client.complete(prompt);
    if (!isSystemPlatformCall(resolved)) {
      await logAiUsage({
        householdId: resolved.householdId,
        userId: resolved.userId,
        feature: resolved.feature,
        provider: resolved.provider,
        keySource: resolved.keySource,
        model: resolved.model,
        webSearchUsed,
        status: 'ok',
      });
    }
    return {
      text,
      resultsMayVary,
      webSearchUsed,
      keySource: resolved.keySource,
      provider: resolved.provider,
    };
  } catch (err) {
    if (resolved.keySource === 'household') {
      const status = classifyProviderKeyFailure(err);
      await markHouseholdKeyStatus(resolved.householdId, status);
      await logAiUsage({
        householdId: resolved.householdId,
        userId: resolved.userId,
        feature: resolved.feature,
        provider: resolved.provider,
        keySource: 'household',
        model: resolved.model,
        webSearchUsed,
        status: 'error',
      });
      throw new AiBlockedError('key_paused');
    }
    if (!isSystemPlatformCall(resolved)) {
      await logAiUsage({
        householdId: resolved.householdId,
        userId: resolved.userId,
        feature: resolved.feature,
        provider: resolved.provider,
        keySource: resolved.keySource,
        model: resolved.model,
        webSearchUsed,
        status: 'error',
      });
    }
    throw err;
  }
}

export type AiStatusBody = {
  keySource: AiKeySource | null;
  blocked: AiBlockedCode | null;
  hasKey: boolean;
  isAdmin: boolean;
};

export async function resolveAiStatus(userId: string, householdId: string): Promise<AiStatusBody> {
  if (!isServiceRoleConfigured()) {
    return { keySource: 'platform', blocked: null, hasKey: false, isAdmin: false };
  }

  await assertMember(userId, householdId);
  const admin = createServiceClient();

  const { data: member } = await admin
    .from('household_members')
    .select('role')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();
  const role = typeof member?.role === 'string' ? member.role : '';
  const isAdmin = role === 'owner' || role === 'admin';

  const { data: keyRow } = await admin
    .from('household_ai_keys')
    .select('key_status')
    .eq('household_id', householdId)
    .maybeSingle();

  if (!keyRow) {
    return { keySource: 'platform', blocked: null, hasKey: false, isAdmin };
  }

  const keyStatus = typeof keyRow.key_status === 'string' ? keyRow.key_status : 'unchecked';
  if (keyStatus !== 'valid') {
    return { keySource: null, blocked: 'key_paused', hasKey: true, isAdmin };
  }

  const allowed = await memberAllowed(userId, householdId);
  if (!allowed) {
    return { keySource: null, blocked: 'no_access', hasKey: true, isAdmin };
  }

  return { keySource: 'household', blocked: null, hasKey: true, isAdmin };
}

export function aiBlockedHttp(err: AiBlockedError): { status: number; body: { error: string; code: AiBlockedCode } } {
  return { status: 403, body: { error: scrubErrorMessage(err), code: err.code } };
}
