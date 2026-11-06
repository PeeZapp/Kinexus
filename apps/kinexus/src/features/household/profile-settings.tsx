import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Btn, Card, ErrorText, Field } from '@/src/features/household/ui';
import { ProfileAvatar } from '@/src/features/shell/ProfileAvatar';
import { PublicName } from '@/src/features/shell/PublicName';
import { colors, radius } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { AVATAR_PRESETS } from '@/src/features/shell/avatar-presets';
import {
  checkUsernameAvailable,
  fetchOwnIdentity,
  normalizeUsernameDraft,
  resolveAvatarPresetId,
  saveOwnAvatarPreset,
  setUsername,
  updateOwnProfileFields,
  usernameClientError,
  usernameCooldownEndsAt,
  usernameReasonMessage,
  type AvatarPresetId,
  type OwnIdentity,
  type UsernameCheckResult,
} from '@/src/lib/identity';
import { reauthGoogleForAvatar } from '@/src/lib/oauth';
import {
  currentUserHasLinkedGoogleIdentity,
  runGoogleAvatarOptIn,
} from '@/src/lib/profile-avatar-google';

const CHECK_DEBOUNCE_MS = 400;

function promptStorageKey(userId: string) {
  return `kinexus.usernameSetup.${userId}`;
}

async function readPromptState(userId: string): Promise<'open' | 'skipped' | 'done'> {
  try {
    const raw = await AsyncStorage.getItem(promptStorageKey(userId));
    if (raw === 'skipped' || raw === 'done') return raw;
  } catch {
    // ignore
  }
  return 'open';
}

async function writePromptState(userId: string, state: 'skipped' | 'done') {
  try {
    await AsyncStorage.setItem(promptStorageKey(userId), state);
  } catch {
    // ignore
  }
}

function useOwnIdentity() {
  const { user } = useAuth();
  const [identity, setIdentity] = useState<OwnIdentity | null>(null);
  const [loading, setLoading] = useState(Boolean(user && !user.isDevBypass));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user || user.isDevBypass) {
      setIdentity(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await fetchOwnIdentity(user.id);
      setIdentity(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { user, identity, loading, error, reload, setIdentity };
}

function useUsernameDraft(savedUsername: string | null | undefined, cooldownEnds: Date | null) {
  const [draft, setDraft] = useState(savedUsername ?? '');
  const [clientReason, setClientReason] = useState<string | null>(null);
  const [availability, setAvailability] = useState<UsernameCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    setDraft(savedUsername ?? '');
    setClientReason(null);
    setAvailability(null);
    setServerError(null);
  }, [savedUsername]);

  useEffect(() => {
    const normalized = normalizeUsernameDraft(draft);
    const saved = savedUsername ?? '';
    setServerError(null);

    if (!normalized) {
      setClientReason(null);
      setAvailability(null);
      setChecking(false);
      return;
    }

    if (normalized === saved) {
      setClientReason(null);
      setAvailability({ ok: true, reason: null, suggestions: [], retryAt: null });
      setChecking(false);
      return;
    }

    const local = usernameClientError(normalized);
    if (local) {
      setClientReason(local);
      setAvailability(null);
      setChecking(false);
      return;
    }

    setClientReason(null);
    const seq = ++seqRef.current;
    setChecking(true);
    const timer = setTimeout(() => {
      void checkUsernameAvailable(normalized)
        .then((result) => {
          if (seq !== seqRef.current) return;
          setAvailability(result);
        })
        .catch((err) => {
          if (seq !== seqRef.current) return;
          setAvailability(null);
          setServerError(err instanceof Error ? err.message : 'Could not check username');
        })
        .finally(() => {
          if (seq === seqRef.current) setChecking(false);
        });
    }, CHECK_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [draft, savedUsername]);

  const normalized = normalizeUsernameDraft(draft);
  const saved = savedUsername ?? '';
  const dirty = normalized !== saved;
  const localMessage = usernameReasonMessage(clientReason);
  const availabilityMessage =
    availability && !availability.ok
      ? usernameReasonMessage(availability.reason, availability.retryAt)
      : null;
  const cooldownMessage = cooldownEnds
    ? `You can change this again on ${cooldownEnds.toLocaleDateString()}`
    : null;

  const statusMessage =
    localMessage ||
    availabilityMessage ||
    serverError ||
    (checking ? 'Checking…' : null) ||
    (availability?.ok && dirty ? 'Available' : null);

  const canSubmit =
    dirty &&
    !checking &&
    !clientReason &&
    !serverError &&
    (normalized === '' || availability?.ok === true) &&
    !cooldownEnds;

  return {
    draft,
    setDraft,
    dirty,
    canSubmit,
    checking,
    statusMessage,
    statusOk: Boolean(availability?.ok && dirty && !clientReason && !serverError),
    suggestions: availability?.suggestions ?? [],
    cooldownMessage,
    applySuggestion: (value: string) => setDraft(value),
    resetServerError: () => setServerError(null),
    setServerError,
  };
}

function UsernameEditor({
  identity,
  onSaved,
  submitLabel = 'Save username',
  showClear = true,
}: {
  identity: OwnIdentity;
  onSaved: (next: OwnIdentity) => void;
  submitLabel?: string;
  showClear?: boolean;
}) {
  const cooldownEnds = usernameCooldownEndsAt(identity.usernameChangedAt);
  const editor = useUsernameDraft(identity.username, cooldownEnds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!editor.canSubmit) return;
    setBusy(true);
    setError(null);
    editor.resetServerError();
    try {
      const result = await setUsername(editor.draft.trim() ? editor.draft : null);
      if (!result.ok) {
        const message = usernameReasonMessage(result.reason, result.retryAt) ?? 'Could not save username';
        setError(message);
        editor.setServerError(message);
        return;
      }
      const next = await fetchOwnIdentity(identity.id);
      if (next) onSaved(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save username');
    } finally {
      setBusy(false);
    }
  }

  async function onClear() {
    if (!identity.username) return;
    setBusy(true);
    setError(null);
    try {
      const result = await setUsername(null);
      if (!result.ok) {
        setError(usernameReasonMessage(result.reason, result.retryAt) ?? 'Could not clear username');
        return;
      }
      const next = await fetchOwnIdentity(identity.id);
      if (next) onSaved(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear username');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.stack}>
      <Field
        label="Username"
        value={editor.draft}
        onChangeText={editor.setDraft}
        placeholder="optional"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
      />
      {editor.cooldownMessage ? <Text style={styles.meta}>{editor.cooldownMessage}</Text> : null}
      {editor.statusMessage ? (
        <Text style={editor.statusOk ? styles.ok : styles.meta}>{editor.statusMessage}</Text>
      ) : null}
      {editor.suggestions.length > 0 ? (
        <View style={styles.suggestionRow}>
          {editor.suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => editor.applySuggestion(suggestion)}
              style={styles.suggestion}>
              <Text style={styles.suggestionLabel}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Btn
        label={submitLabel}
        onPress={() => void onSubmit()}
        busy={busy}
        disabled={!editor.canSubmit}
      />
      {showClear && identity.username ? (
        <Btn
          label="Clear username"
          variant="ghost"
          onPress={() => void onClear()}
          busy={busy}
          disabled={Boolean(cooldownEnds)}
        />
      ) : null}
      <ErrorText message={error} />
    </View>
  );
}

type AvatarChoice = AvatarPresetId | 'google';

function savedAvatarChoice(identity: OwnIdentity): AvatarChoice {
  if (identity.avatarSource === 'google' && identity.avatarGoogleUrl) return 'google';
  return resolveAvatarPresetId(identity.avatarUrl);
}

function AvatarPresetPicker({
  value,
  googleSelected,
  onChange,
}: {
  value: AvatarPresetId;
  googleSelected: boolean;
  onChange: (id: AvatarPresetId) => void;
}) {
  return (
    <View style={styles.presetGrid}>
      {AVATAR_PRESETS.map((preset) => {
        const active = !googleSelected && preset.id === value;
        return (
          <Pressable
            key={preset.id}
            onPress={() => onChange(preset.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={preset.label}
            style={[styles.presetCell, active && styles.presetCellActive]}>
            <Image source={preset.source} resizeMode="contain" style={styles.presetImage} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProfileSection() {
  const { user, identity, loading, error, reload, setIdentity } = useOwnIdentity();
  const [displayName, setDisplayName] = useState('');
  const [avatarChoice, setAvatarChoice] = useState<AvatarChoice>(resolveAvatarPresetId(null));
  const [hasGoogleLinked, setHasGoogleLinked] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(identity?.displayName ?? user?.displayName ?? '');
    if (identity) setAvatarChoice(savedAvatarChoice(identity));
  }, [
    identity?.displayName,
    identity?.avatarUrl,
    identity?.avatarSource,
    identity?.avatarGoogleUrl,
    identity?.id,
    user?.displayName,
  ]);

  useEffect(() => {
    if (!user || user.isDevBypass) {
      setHasGoogleLinked(false);
      return;
    }
    let cancelled = false;
    void currentUserHasLinkedGoogleIdentity()
      .then((linked) => {
        if (!cancelled) setHasGoogleLinked(linked);
      })
      .catch(() => {
        if (!cancelled) setHasGoogleLinked(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  if (user.isDevBypass) {
    return (
      <Card>
        <Text style={styles.heading}>Profile</Text>
        <Text style={styles.body}>Sign in with a live account to manage your public profile.</Text>
      </Card>
    );
  }

  if (loading && !identity) {
    return (
      <Card>
        <Text style={styles.heading}>Profile</Text>
        <ActivityIndicator color={colors.accent} />
      </Card>
    );
  }

  if (!identity) {
    return (
      <Card>
        <Text style={styles.heading}>Profile</Text>
        <ErrorText message={error ?? 'Profile not found'} />
        <Btn label="Retry" variant="secondary" onPress={() => void reload()} />
      </Card>
    );
  }

  const savedChoice = savedAvatarChoice(identity);
  const displayDirty = displayName.trim() !== (identity.displayName ?? '').trim();
  const avatarDirty = avatarChoice !== savedChoice;
  const googleSelected = avatarChoice === 'google';
  const presetValue = googleSelected
    ? resolveAvatarPresetId(identity.avatarUrl)
    : (avatarChoice as AvatarPresetId);

  async function optInGooglePhoto() {
    if (!hasGoogleLinked || googleBusy) return;
    setGoogleBusy(true);
    setProfileError(null);
    setProfileNotice(null);
    const result = await runGoogleAvatarOptIn({
      expectedUserId: identity!.id,
      reauth: reauthGoogleForAvatar,
    });
    try {
      const current = await fetchOwnIdentity(identity!.id);
      if (current) {
        setIdentity(current);
        setAvatarChoice(savedAvatarChoice(current));
      } else {
        setAvatarChoice(resolveAvatarPresetId(identity!.avatarUrl));
      }
    } catch {
      setAvatarChoice(resolveAvatarPresetId(identity!.avatarUrl));
    }
    if (!result.ok) {
      setProfileError(result.error);
    } else {
      setProfileNotice('Saved');
    }
    setGoogleBusy(false);
  }

  async function saveProfileFields() {
    setProfileBusy(true);
    setProfileError(null);
    setProfileNotice(null);
    try {
      if (displayDirty) {
        await updateOwnProfileFields(identity!.id, {
          displayName: displayName.trim() || null,
        });
      }
      if (avatarDirty && avatarChoice !== 'google') {
        await saveOwnAvatarPreset(identity!.id, avatarChoice);
      }
      const next = await fetchOwnIdentity(identity!.id);
      if (next) {
        setIdentity(next);
        setAvatarChoice(savedAvatarChoice(next));
      }
      setProfileNotice('Saved');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not save profile');
      try {
        const current = await fetchOwnIdentity(identity!.id);
        if (current) {
          setIdentity(current);
          setAvatarChoice(savedAvatarChoice(current));
        }
      } catch {
        // ignore — never block household/profile recovery
      }
    } finally {
      setProfileBusy(false);
    }
  }

  return (
    <Card>
      <Text style={styles.heading}>Profile</Text>
      <View style={styles.previewRow}>
        <ProfileAvatar
          avatarUrl={presetValue}
          avatarSource={googleSelected ? 'google' : 'preset'}
          avatarGoogleUrl={googleSelected ? identity.avatarGoogleUrl : null}
          size={56}
        />
        <View style={styles.previewText}>
          <PublicName
            user={{
              globalHandle: identity.globalHandle,
              username: identity.username,
              isVerifiedCreator: identity.isVerifiedCreator,
            }}
          />
        </View>
      </View>

      <View style={styles.stack}>
        <Text style={styles.fieldLabel}>Your permanent ID</Text>
        <Text style={styles.handle}>{identity.globalHandle}</Text>
      </View>

      <UsernameEditor
        identity={identity}
        onSaved={(next) => {
          setIdentity(next);
          void writePromptState(next.id, 'done');
        }}
      />

      <Field
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        autoCorrect={false}
      />

      <Text style={styles.fieldLabel}>Avatar</Text>
      <AvatarPresetPicker
        value={presetValue}
        googleSelected={googleSelected}
        onChange={setAvatarChoice}
      />
      <Pressable
        onPress={() => void optInGooglePhoto()}
        disabled={!hasGoogleLinked || googleBusy || googleSelected}
        accessibilityRole="button"
        accessibilityState={{
          selected: googleSelected,
          disabled: !hasGoogleLinked || googleBusy || googleSelected,
        }}
        accessibilityLabel="Use my Google photo"
        style={[
          styles.googleOption,
          googleSelected && styles.presetCellActive,
          (!hasGoogleLinked || googleBusy) && styles.googleOptionDisabled,
        ]}>
        {googleBusy ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text
            style={[
              styles.googleOptionLabel,
              !hasGoogleLinked && styles.googleOptionLabelDisabled,
            ]}>
            Use my Google photo
          </Text>
        )}
      </Pressable>

      <Btn
        label="Save profile"
        variant="secondary"
        onPress={() => void saveProfileFields()}
        busy={profileBusy}
        disabled={!displayDirty && !avatarDirty}
      />
      {profileNotice ? <Text style={styles.ok}>{profileNotice}</Text> : null}
      <ErrorText message={profileError ?? error} />
    </Card>
  );
}

export function UsernameSetupPrompt({ onChanged }: { onChanged?: () => void }) {
  const { user, identity, loading, setIdentity } = useOwnIdentity();
  const [promptState, setPromptState] = useState<'loading' | 'open' | 'skipped' | 'done'>('loading');

  useEffect(() => {
    if (!user || user.isDevBypass) {
      setPromptState('done');
      return;
    }
    let cancelled = false;
    void readPromptState(user.id).then((state) => {
      if (!cancelled) setPromptState(state);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || user.isDevBypass || loading || !identity) return null;
  if (identity.username) return null;
  if (promptState !== 'open') return null;

  return (
    <Card>
      <Text style={styles.heading}>Set a username</Text>
      <Text style={styles.body}>Optional. You can change this later in Profile.</Text>
      <View style={styles.stack}>
        <Text style={styles.fieldLabel}>Your permanent ID</Text>
        <Text style={styles.handle}>{identity.globalHandle}</Text>
      </View>
      <UsernameEditor
        identity={identity}
        submitLabel="Save"
        showClear={false}
        onSaved={(next) => {
          setIdentity(next);
          setPromptState('done');
          void writePromptState(next.id, 'done');
          onChanged?.();
        }}
      />
      <Btn
        label="Skip"
        variant="ghost"
        onPress={() => {
          setPromptState('skipped');
          void writePromptState(user.id, 'skipped');
          onChanged?.();
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  stack: {
    gap: 8,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  handle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  ok: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestion: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  suggestionLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewText: {
    flex: 1,
    minWidth: 0,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetCell: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetCellActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  presetImage: {
    width: 28,
    height: 28,
  },
  googleOption: {
    marginTop: 4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  googleOptionDisabled: {
    opacity: 0.45,
  },
  googleOptionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  googleOptionLabelDisabled: {
    color: colors.textMuted,
  },
});
