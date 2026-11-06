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

/** Preset/username profile read — no Google-only columns (avatar_source / avatar_google_url). */
export const OWN_IDENTITY_SELECT =
  'id, global_handle, username, username_changed_at, display_name, avatar_url, is_verified_creator';

export type OwnIdentity = {
  id: string;
  globalHandle: string;
  username: string | null;
  usernameChangedAt: string | null;
  displayName: string | null;
  /** Stored profiles.avatar_url: allowlisted preset id, legacy URL, or null. */
  avatarUrl: string | null;
  isVerifiedCreator: boolean;
};

export type ProfileIdentityRow = {
  id: string;
  global_handle: string;
  username: string | null;
  username_changed_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified_creator: boolean | null;
};

export function mapOwnIdentity(row: ProfileIdentityRow): OwnIdentity {
  return {
    id: row.id,
    globalHandle: row.global_handle,
    username: row.username,
    usernameChangedAt: row.username_changed_at,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isVerifiedCreator: Boolean(row.is_verified_creator),
  };
}
