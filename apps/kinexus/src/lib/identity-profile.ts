import { normalizeAvatarPresetWrite } from '@/src/lib/identity-avatar';
import { supabase } from '@/src/lib/supabase';

export { buildEnsureProfilePatch, type EnsureProfilePatch } from '@/src/lib/identity-own';

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** Household/display fields only — never username or global_handle. */
export async function updateOwnProfileFields(
  userId: string,
  patch: { displayName?: string | null; avatarUrl?: string | null },
): Promise<void> {
  if (!supabase) throw new Error('Sign in to update your profile');
  const body: { display_name?: string | null; avatar_url?: string | null } = {};
  if ('displayName' in patch) {
    const trimmed = patch.displayName?.trim() ?? '';
    body.display_name = trimmed.length > 0 ? trimmed : null;
  }
  if ('avatarUrl' in patch) {
    // Server also enforces allowlist; client rejects URLs/data URLs early.
    // Never write avatar_source / avatar_google_url from the client.
    body.avatar_url = normalizeAvatarPresetWrite(patch.avatarUrl);
  }
  if (Object.keys(body).length === 0) return;
  const { error } = await supabase.from('profiles').update(body).eq('id', userId);
  throwIfError(error);
}
