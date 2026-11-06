/** Columns filled by ensureProfile — never avatar_url (preset-only). */
export type EnsureProfilePatch = {
  display_name?: string;
  email?: string | null;
};

/**
 * Blank-fill display_name / email only.
 * Never copies OAuth picture URLs into profiles.avatar_url (preset trigger rejects them).
 */
export function buildEnsureProfilePatch(
  existing: {
    display_name: string | null;
    email?: string | null;
    avatar_url?: string | null;
  },
  user: { displayName?: string; email?: string; avatarUrl?: string },
): EnsureProfilePatch {
  const patch: EnsureProfilePatch = {};
  if (!existing.display_name && user.displayName) patch.display_name = user.displayName;
  if (!existing.email && user.email) patch.email = user.email;
  void existing.avatar_url;
  void user.avatarUrl;
  return patch;
}

/** Base profile read — safe when Google avatar columns are not migrated yet. */
export const OWN_IDENTITY_SELECT_BASE =
  'id, global_handle, username, username_changed_at, display_name, avatar_url, is_verified_creator';

/** Google photo columns only (20261106140000) — fallback before Facebook migration. */
export const OWN_IDENTITY_SELECT_WITH_GOOGLE = `${OWN_IDENTITY_SELECT_BASE}, avatar_source, avatar_google_url`;

/** Google + Facebook photo columns (20261106170000). */
export const OWN_IDENTITY_SELECT_WITH_PROVIDERS = `${OWN_IDENTITY_SELECT_WITH_GOOGLE}, avatar_facebook_id`;

/** @deprecated Prefer OWN_IDENTITY_SELECT_BASE / fetchOwnIdentity resilient path. */
export const OWN_IDENTITY_SELECT = OWN_IDENTITY_SELECT_BASE;

export type AvatarSource = 'preset' | 'google' | 'facebook';

export type OwnIdentity = {
  id: string;
  globalHandle: string;
  username: string | null;
  usernameChangedAt: string | null;
  displayName: string | null;
  /** Stored profiles.avatar_url: allowlisted preset id, legacy URL, or null. */
  avatarUrl: string | null;
  /** Server-managed; absent/unknown → preset. */
  avatarSource: AvatarSource;
  /** Server-managed Google photo URL when avatarSource is google. */
  avatarGoogleUrl: string | null;
  /** Server-managed Facebook user id when avatarSource is facebook (no CDN URL). */
  avatarFacebookId: string | null;
  isVerifiedCreator: boolean;
};

export type ProfileIdentityRow = {
  id: string;
  global_handle: string;
  username: string | null;
  username_changed_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_source?: string | null;
  avatar_google_url?: string | null;
  avatar_facebook_id?: string | null;
  is_verified_creator: boolean | null;
};

export function mapAvatarSource(value: string | null | undefined): AvatarSource {
  if (value === 'google') return 'google';
  if (value === 'facebook') return 'facebook';
  return 'preset';
}

export function mapOwnIdentity(row: ProfileIdentityRow): OwnIdentity {
  const avatarSource = mapAvatarSource(row.avatar_source);
  const googleUrl =
    typeof row.avatar_google_url === 'string' && row.avatar_google_url.startsWith('https://')
      ? row.avatar_google_url
      : null;
  const facebookId =
    typeof row.avatar_facebook_id === 'string' && row.avatar_facebook_id.trim()
      ? row.avatar_facebook_id.trim()
      : null;

  if (avatarSource === 'facebook' && facebookId) {
    return {
      id: row.id,
      globalHandle: row.global_handle,
      username: row.username,
      usernameChangedAt: row.username_changed_at,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      avatarSource: 'facebook',
      avatarGoogleUrl: null,
      avatarFacebookId: facebookId,
      isVerifiedCreator: Boolean(row.is_verified_creator),
    };
  }

  if (avatarSource === 'google' && googleUrl) {
    return {
      id: row.id,
      globalHandle: row.global_handle,
      username: row.username,
      usernameChangedAt: row.username_changed_at,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      avatarSource: 'google',
      avatarGoogleUrl: googleUrl,
      avatarFacebookId: null,
      isVerifiedCreator: Boolean(row.is_verified_creator),
    };
  }

  return {
    id: row.id,
    globalHandle: row.global_handle,
    username: row.username,
    usernameChangedAt: row.username_changed_at,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    avatarSource: 'preset',
    avatarGoogleUrl: null,
    avatarFacebookId: null,
    isVerifiedCreator: Boolean(row.is_verified_creator),
  };
}

export function isMissingColumnError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42703') return true;
  const message = error.message ?? '';
  return /avatar_source|avatar_google_url|avatar_facebook_id|column .* does not exist/i.test(message);
}
