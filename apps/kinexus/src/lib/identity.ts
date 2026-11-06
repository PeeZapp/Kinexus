import { rpc } from '@kinexus/db';
import { containsProfanity } from '@kinexus/domain';

import {
  OWN_IDENTITY_SELECT_BASE,
  OWN_IDENTITY_SELECT_WITH_GOOGLE,
  isMissingColumnError,
  mapOwnIdentity,
  type OwnIdentity,
  type ProfileIdentityRow,
} from '@/src/lib/identity-own';
import { updateOwnProfileFields } from '@/src/lib/identity-profile';
import { supabase } from '@/src/lib/supabase';

export {
  AVATAR_PRESET_IDS,
  AVATAR_PRESET_LABELS,
  DEFAULT_AVATAR_PRESET,
  isAvatarPresetId,
  normalizeAvatarPresetWrite,
  resolveAvatarDisplay,
  resolveAvatarPresetId,
  type AvatarPresetId,
} from '@/src/lib/identity-avatar';

export { updateOwnProfileFields } from '@/src/lib/identity-profile';

export {
  OWN_IDENTITY_SELECT,
  OWN_IDENTITY_SELECT_BASE,
  OWN_IDENTITY_SELECT_WITH_GOOGLE,
  mapOwnIdentity,
  type AvatarSource,
  type OwnIdentity,
} from '@/src/lib/identity-own';

const USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const USERNAME_RE = /^[a-z0-9._]+$/;

export type UsernameReason =
  | 'invalid_format'
  | 'reserved'
  | 'profanity'
  | 'handle_collision'
  | 'taken'
  | 'cooldown'
  | 'unauthenticated'
  | 'not_found'
  | string;

export type UsernameCheckResult = {
  ok: boolean;
  reason: UsernameReason | null;
  suggestions: string[];
  retryAt: string | null;
};

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function mapUsernameResult(raw: unknown): UsernameCheckResult {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const retryAt = typeof row.retry_at === 'string' ? row.retry_at : null;
  return {
    ok: row.ok === true,
    reason: typeof row.reason === 'string' ? row.reason : null,
    suggestions: asStringArray(row.suggestions),
    retryAt,
  };
}

/** Normalize draft the same way the server lowercases/trims. */
export function normalizeUsernameDraft(value: string): string {
  return value.trim().toLowerCase();
}

export function usernameFormatError(value: string): 'invalid_format' | null {
  const u = normalizeUsernameDraft(value);
  if (!u) return null;
  if (u.length < 3 || u.length > 24) return 'invalid_format';
  if (!USERNAME_RE.test(u)) return 'invalid_format';
  if (u.startsWith('.') || u.endsWith('.') || u.includes('..')) return 'invalid_format';
  return null;
}

export function usernameClientError(value: string): UsernameReason | null {
  const format = usernameFormatError(value);
  if (format) return format;
  const u = normalizeUsernameDraft(value);
  if (u && containsProfanity(u)) return 'profanity';
  return null;
}

export function usernameCooldownEndsAt(changedAt: string | null | undefined): Date | null {
  if (!changedAt) return null;
  const changed = new Date(changedAt).getTime();
  if (Number.isNaN(changed)) return null;
  const ends = changed + USERNAME_COOLDOWN_MS;
  return ends > Date.now() ? new Date(ends) : null;
}

export function usernameReasonMessage(
  reason: UsernameReason | null | undefined,
  retryAt?: string | null,
): string | null {
  if (!reason) return null;
  switch (reason) {
    case 'invalid_format':
      return 'Use 3–24 characters: letters, numbers, . or _';
    case 'reserved':
      return 'That username is reserved';
    case 'profanity':
      return 'That username isn’t allowed';
    case 'handle_collision':
      return 'That looks like a permanent ID';
    case 'taken':
      return 'That username is taken';
    case 'cooldown': {
      const when = retryAt ? new Date(retryAt) : null;
      if (when && !Number.isNaN(when.getTime())) {
        return `You can change this again on ${when.toLocaleDateString()}`;
      }
      return 'You can change your username once every 30 days';
    }
    case 'unauthenticated':
      return 'Sign in to set a username';
    case 'not_found':
      return 'Profile not found';
    default:
      return 'Could not update username';
  }
}

export async function fetchOwnIdentity(userId: string): Promise<OwnIdentity | null> {
  if (!supabase) return null;

  const withGoogle = await supabase
    .from('profiles')
    .select(OWN_IDENTITY_SELECT_WITH_GOOGLE as never)
    .eq('id', userId)
    .maybeSingle();

  if (!withGoogle.error) {
    if (!withGoogle.data) return null;
    return mapOwnIdentity(withGoogle.data as unknown as ProfileIdentityRow);
  }

  // Google columns not migrated yet — fall back so profile/household stay loadable.
  if (!isMissingColumnError(withGoogle.error)) {
    throwIfError(withGoogle.error);
  }

  const base = await supabase
    .from('profiles')
    .select(OWN_IDENTITY_SELECT_BASE as never)
    .eq('id', userId)
    .maybeSingle();
  throwIfError(base.error);
  if (!base.data) return null;
  return mapOwnIdentity(base.data as unknown as ProfileIdentityRow);
}

export async function checkUsernameAvailable(username: string): Promise<UsernameCheckResult> {
  if (!supabase) {
    return { ok: false, reason: 'unauthenticated', suggestions: [], retryAt: null };
  }
  const { data, error } = await supabase.rpc(rpc.checkUsernameAvailable as never, {
    p_username: normalizeUsernameDraft(username),
  } as never);
  throwIfError(error);
  return mapUsernameResult(data);
}

export async function setUsername(username: string | null): Promise<UsernameCheckResult> {
  if (!supabase) {
    return { ok: false, reason: 'unauthenticated', suggestions: [], retryAt: null };
  }
  const payload =
    username == null || normalizeUsernameDraft(username) === ''
      ? null
      : normalizeUsernameDraft(username);
  const { data, error } = await supabase.rpc(rpc.setUsername as never, {
    p_username: payload,
  } as never);
  throwIfError(error);
  return mapUsernameResult(data);
}

export async function saveOwnAvatarPreset(
  userId: string,
  presetId: string | null,
): Promise<void> {
  await updateOwnProfileFields(userId, { avatarUrl: presetId });
}
