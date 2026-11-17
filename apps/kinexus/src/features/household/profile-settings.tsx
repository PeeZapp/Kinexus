import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PublicProfileLink } from '@kinexus/domain';

import {
  fetchOwnProfileMeta,
  saveOwnProfileMeta,
} from '@/src/features/creators/creators-api';
import {
  Btn,
  Card,
  EditIconButton,
  ErrorText,
  Field,
  SettingsLockedRow,
} from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import { ProfileAvatar } from '@/src/features/shell/ProfileAvatar';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';
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
import { linkFacebookIdentity, reauthFacebookForAvatar, reauthGoogleForAvatar } from '@/src/lib/oauth';
import {
  currentUserHasLinkedFacebookIdentity,
  runFacebookAvatarOptIn,
} from '@/src/lib/profile-avatar-facebook';
import {
  currentUserHasLinkedGoogleIdentity,
  runGoogleAvatarOptIn,
} from '@/src/lib/profile-avatar-google';

const BIO_MAX = 280;
const LINKS_MAX = 5;
const AVATAR_HERO_SIZE = 104;
const CHECK_DEBOUNCE_MS = 400;

function emptyLink(): PublicProfileLink {
  return { url: '', label: '' };
}

function cleanLinks(links: PublicProfileLink[]): PublicProfileLink[] {
  const cleaned = links
    .map((link) => ({
      url: link.url.trim(),
      label: link.label?.trim() || undefined,
    }))
    .filter((link) => link.url);
  for (const link of cleaned) {
    if (!link.url.toLowerCase().startsWith('https://')) {
      throw new Error('Links must use https://');
    }
  }
  if (cleaned.length > LINKS_MAX) throw new Error('At most 5 links');
  return cleaned;
}

function linksSummary(links: PublicProfileLink[]): string {
  const urls = links.map((l) => l.url.trim()).filter(Boolean);
  if (urls.length === 0) return '';
  if (urls.length === 1) return urls[0]!;
  return `${urls.length} links`;
}

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

type AvatarChoice = AvatarPresetId | 'google' | 'facebook';

function savedAvatarChoice(identity: OwnIdentity): AvatarChoice {
  if (identity.avatarSource === 'facebook' && identity.avatarFacebookId) return 'facebook';
  if (identity.avatarSource === 'google' && identity.avatarGoogleUrl) return 'google';
  return resolveAvatarPresetId(identity.avatarUrl);
}

function AvatarPresetPicker({
  value,
  providerSelected,
  onChange,
  busy,
}: {
  value: AvatarPresetId;
  providerSelected: boolean;
  onChange: (id: AvatarPresetId) => void;
  busy?: boolean;
}) {
  return (
    <View style={styles.presetGrid}>
      {AVATAR_PRESETS.map((preset) => {
        const active = !providerSelected && preset.id === value;
        return (
          <Pressable
            key={preset.id}
            onPress={() => onChange(preset.id)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: Boolean(busy) }}
            accessibilityLabel={preset.label}
            style={[styles.presetCell, active && styles.presetCellActive, busy && styles.providerOptionDisabled]}>
            <Image source={preset.source} resizeMode="contain" style={styles.presetImage} />
          </Pressable>
        );
      })}
    </View>
  );
}

function UsernameEditSheet({
  visible,
  identity,
  onClose,
  onSaved,
}: {
  visible: boolean;
  identity: OwnIdentity;
  onClose: () => void;
  onSaved: (next: OwnIdentity) => void;
}) {
  return (
    <Sheet visible={visible} title="Username" onClose={onClose}>
      <View style={styles.sheetStack}>
        <UsernameEditor
          identity={identity}
          submitLabel="Save"
          onSaved={(next) => {
            onSaved(next);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

function DisplayNameEditSheet({
  visible,
  identity,
  onClose,
  onSaved,
}: {
  visible: boolean;
  identity: OwnIdentity;
  onClose: () => void;
  onSaved: (next: OwnIdentity) => void;
}) {
  const [draft, setDraft] = useState(identity.displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(identity.displayName ?? '');
    setError(null);
  }, [visible, identity.displayName]);

  const dirty = draft.trim() !== (identity.displayName ?? '').trim();

  async function onSave() {
    if (!dirty) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateOwnProfileFields(identity.id, {
        displayName: draft.trim() || null,
      });
      const next = await fetchOwnIdentity(identity.id);
      if (next) onSaved(next);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save display name');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Display name" onClose={onClose}>
      <View style={styles.sheetStack}>
        <Field
          label="Display name"
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!busy}
        />
        <Btn label="Save" onPress={() => void onSave()} busy={busy} disabled={!dirty} />
        <ErrorText message={error} />
      </View>
    </Sheet>
  );
}

function AvatarEditSheet({
  visible,
  identity,
  onClose,
  onIdentityChange,
}: {
  visible: boolean;
  identity: OwnIdentity;
  onClose: () => void;
  onIdentityChange: (next: OwnIdentity) => void;
}) {
  const [hasGoogleLinked, setHasGoogleLinked] = useState(false);
  const [hasFacebookLinked, setHasFacebookLinked] = useState(false);
  const [presetBusy, setPresetBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [facebookBusy, setFacebookBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const choice = savedAvatarChoice(identity);
  const googleSelected = choice === 'google';
  const facebookSelected = choice === 'facebook';
  const providerSelected = googleSelected || facebookSelected;
  const presetValue = providerSelected
    ? resolveAvatarPresetId(identity.avatarUrl)
    : (choice as AvatarPresetId);
  const anyBusy = presetBusy || googleBusy || facebookBusy;

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setNotice(null);
    let cancelled = false;
    void currentUserHasLinkedGoogleIdentity()
      .then((linked) => {
        if (!cancelled) setHasGoogleLinked(linked);
      })
      .catch(() => {
        if (!cancelled) setHasGoogleLinked(false);
      });
    void currentUserHasLinkedFacebookIdentity()
      .then((linked) => {
        if (!cancelled) setHasFacebookLinked(linked);
      })
      .catch(() => {
        if (!cancelled) setHasFacebookLinked(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, identity.id]);

  async function refreshIdentity() {
    const current = await fetchOwnIdentity(identity.id);
    if (current) onIdentityChange(current);
  }

  async function selectPreset(id: AvatarPresetId) {
    if (anyBusy) return;
    if (choice === id) return;
    setPresetBusy(true);
    setError(null);
    setNotice(null);
    try {
      await saveOwnAvatarPreset(identity.id, id);
      await refreshIdentity();
      setNotice('Saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save avatar');
      try {
        await refreshIdentity();
      } catch {
        // ignore
      }
    } finally {
      setPresetBusy(false);
    }
  }

  async function optInGooglePhoto() {
    if (!hasGoogleLinked || anyBusy || googleSelected) return;
    setGoogleBusy(true);
    setError(null);
    setNotice(null);
    const result = await runGoogleAvatarOptIn({
      expectedUserId: identity.id,
      reauth: reauthGoogleForAvatar,
    });
    try {
      await refreshIdentity();
    } catch {
      // ignore
    }
    if (!result.ok) {
      setError(result.error);
    } else {
      setNotice('Saved');
    }
    setGoogleBusy(false);
  }

  async function connectFacebook() {
    if (hasFacebookLinked || anyBusy) return;
    setFacebookBusy(true);
    setError(null);
    setNotice(null);
    const result = await linkFacebookIdentity(identity.id);
    if (!result.ok) {
      setError(result.error);
      setFacebookBusy(false);
      return;
    }
    setHasFacebookLinked(true);
    setNotice('Facebook connected');
    setFacebookBusy(false);
  }

  async function optInFacebookPhoto() {
    if (!hasFacebookLinked || anyBusy || facebookSelected) return;
    setFacebookBusy(true);
    setError(null);
    setNotice(null);
    const result = await runFacebookAvatarOptIn({
      expectedUserId: identity.id,
      reauth: reauthFacebookForAvatar,
    });
    try {
      await refreshIdentity();
    } catch {
      // ignore
    }
    if (!result.ok) {
      setError(result.error);
    } else {
      setNotice('Saved');
    }
    setFacebookBusy(false);
  }

  return (
    <Sheet visible={visible} title="Profile picture" onClose={onClose}>
      <View style={styles.sheetStack}>
        <View style={styles.avatarSheetPreview}>
          <ProfileAvatar
            avatarUrl={presetValue}
            avatarSource={
              googleSelected ? 'google' : facebookSelected ? 'facebook' : 'preset'
            }
            avatarGoogleUrl={googleSelected ? identity.avatarGoogleUrl : null}
            avatarFacebookId={facebookSelected ? identity.avatarFacebookId : null}
            size={72}
          />
        </View>
        <Text style={styles.fieldLabel}>Logos</Text>
        <AvatarPresetPicker
          value={presetValue}
          providerSelected={providerSelected}
          onChange={(id) => void selectPreset(id)}
          busy={anyBusy}
        />
        <Pressable
          onPress={() => void optInGooglePhoto()}
          disabled={!hasGoogleLinked || anyBusy || googleSelected}
          accessibilityRole="button"
          accessibilityState={{
            selected: googleSelected,
            disabled: !hasGoogleLinked || anyBusy || googleSelected,
          }}
          accessibilityLabel="Use my Google photo"
          style={[
            styles.providerOption,
            googleSelected && styles.presetCellActive,
            (!hasGoogleLinked || anyBusy) && styles.providerOptionDisabled,
          ]}>
          {googleBusy ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text
              style={[
                styles.providerOptionLabel,
                !hasGoogleLinked && styles.providerOptionLabelDisabled,
              ]}>
              Use my Google photo
            </Text>
          )}
        </Pressable>
        {hasFacebookLinked ? (
          <Pressable
            onPress={() => void optInFacebookPhoto()}
            disabled={anyBusy || facebookSelected}
            accessibilityRole="button"
            accessibilityState={{
              selected: facebookSelected,
              disabled: anyBusy || facebookSelected,
            }}
            accessibilityLabel="Use my Facebook photo"
            style={[
              styles.providerOption,
              facebookSelected && styles.presetCellActive,
              anyBusy && styles.providerOptionDisabled,
            ]}>
            {facebookBusy ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.providerOptionLabel}>Use my Facebook photo</Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void connectFacebook()}
            disabled={anyBusy}
            accessibilityRole="button"
            accessibilityState={{ disabled: anyBusy }}
            accessibilityLabel="Connect Facebook"
            style={[styles.providerOption, anyBusy && styles.providerOptionDisabled]}>
            {facebookBusy ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.providerOptionLabel}>Connect Facebook</Text>
            )}
          </Pressable>
        )}
        {notice ? <Text style={styles.ok}>{notice}</Text> : null}
        <ErrorText message={error} />
      </View>
    </Sheet>
  );
}

type PublicMeta = {
  bio: string;
  links: PublicProfileLink[];
  isHidden: boolean;
};

function usePublicProfileMeta() {
  const [meta, setMeta] = useState<PublicMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchOwnProfileMeta();
      setMeta({
        bio: next.bio ?? '',
        links:
          next.links.length > 0
            ? next.links.map((l) => ({ url: l.url, label: l.label ?? '' }))
            : [emptyLink()],
        isHidden: next.isHidden,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load public profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { meta, setMeta, loading, error, setError, reload };
}

function BioEditSheet({
  visible,
  meta,
  onClose,
  onSaved,
}: {
  visible: boolean;
  meta: PublicMeta;
  onClose: () => void;
  onSaved: (next: PublicMeta) => void;
}) {
  const [draft, setDraft] = useState(meta.bio);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(meta.bio);
    setError(null);
  }, [visible, meta.bio]);

  const dirty = draft.trim() !== meta.bio.trim();

  async function onSave() {
    if (!dirty) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cleaned = cleanLinks(meta.links);
      const saved = await saveOwnProfileMeta({
        bio: draft.trim() || null,
        links: cleaned,
        isHidden: meta.isHidden,
      });
      onSaved({
        bio: saved.bio ?? '',
        links:
          saved.links.length > 0
            ? saved.links.map((l) => ({ url: l.url, label: l.label ?? '' }))
            : [emptyLink()],
        isHidden: saved.isHidden,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save bio');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Bio" onClose={onClose}>
      <View style={styles.sheetStack}>
        <Field
          label={`Bio (${draft.length}/${BIO_MAX})`}
          value={draft}
          onChangeText={(value) => setDraft(value.slice(0, BIO_MAX))}
          placeholder="A short bio"
          multiline
          editable={!busy}
        />
        <Btn label="Save" onPress={() => void onSave()} busy={busy} disabled={!dirty} />
        <ErrorText message={error} />
      </View>
    </Sheet>
  );
}

function LinksEditSheet({
  visible,
  meta,
  onClose,
  onSaved,
}: {
  visible: boolean;
  meta: PublicMeta;
  onClose: () => void;
  onSaved: (next: PublicMeta) => void;
}) {
  const [links, setLinks] = useState<PublicProfileLink[]>(meta.links);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLinks(
      meta.links.length > 0 ? meta.links.map((l) => ({ url: l.url, label: l.label ?? '' })) : [emptyLink()],
    );
    setError(null);
  }, [visible, meta.links]);

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      const cleaned = cleanLinks(links);
      const saved = await saveOwnProfileMeta({
        bio: meta.bio.trim() || null,
        links: cleaned,
        isHidden: meta.isHidden,
      });
      onSaved({
        bio: saved.bio ?? '',
        links:
          saved.links.length > 0
            ? saved.links.map((l) => ({ url: l.url, label: l.label ?? '' }))
            : [emptyLink()],
        isHidden: saved.isHidden,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save links');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Links" onClose={onClose}>
      <View style={styles.sheetStack}>
        {links.map((link, index) => (
          <View key={`link-${index}`} style={styles.linkBlock}>
            <Field
              label="URL"
              value={link.url}
              onChangeText={(url) =>
                setLinks((current) => current.map((row, i) => (i === index ? { ...row, url } : row)))
              }
              placeholder="https://"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
            <Field
              label="Label"
              value={link.label ?? ''}
              onChangeText={(label) =>
                setLinks((current) => current.map((row, i) => (i === index ? { ...row, label } : row)))
              }
              placeholder="Optional"
              editable={!busy}
            />
            {links.length > 1 ? (
              <Btn
                label="Remove"
                variant="ghost"
                onPress={() => setLinks((current) => current.filter((_, i) => i !== index))}
                disabled={busy}
              />
            ) : null}
          </View>
        ))}
        {links.length < LINKS_MAX ? (
          <Btn
            label="Add link"
            variant="ghost"
            onPress={() => setLinks((current) => [...current, emptyLink()])}
            disabled={busy}
          />
        ) : null}
        <Btn label="Save" onPress={() => void onSave()} busy={busy} />
        <ErrorText message={error} />
      </View>
    </Sheet>
  );
}

function PublicProfileLockedSection() {
  const { meta, setMeta, loading, error, setError } = usePublicProfileMeta();
  const [bioOpen, setBioOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);

  async function onToggleHidden(next: boolean) {
    if (!meta || toggleBusy) return;
    const previous = meta.isHidden;
    setMeta({ ...meta, isHidden: next });
    setToggleBusy(true);
    setError(null);
    try {
      const cleaned = cleanLinks(meta.links);
      const saved = await saveOwnProfileMeta({
        bio: meta.bio.trim() || null,
        links: cleaned,
        isHidden: next,
      });
      setMeta({
        bio: saved.bio ?? '',
        links:
          saved.links.length > 0
            ? saved.links.map((l) => ({ url: l.url, label: l.label ?? '' }))
            : [emptyLink()],
        isHidden: saved.isHidden,
      });
    } catch (err) {
      setMeta({ ...meta, isHidden: previous });
      setError(err instanceof Error ? err.message : 'Could not update visibility');
    } finally {
      setToggleBusy(false);
    }
  }

  if (loading || !meta) {
    return (
      <View style={styles.stack}>
        <ActivityIndicator color={colors.accent} />
        <ErrorText message={error} />
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <SettingsLockedRow
        label="Bio"
        value={meta.bio}
        placeholder="Add bio"
        onPress={() => setBioOpen(true)}
      />
      <SettingsLockedRow
        label="Links"
        value={linksSummary(meta.links)}
        placeholder="Add links"
        onPress={() => setLinksOpen(true)}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Hide my public profile</Text>
        <Switch
          value={meta.isHidden}
          onValueChange={(value) => void onToggleHidden(value)}
          disabled={toggleBusy}
          trackColor={{ false: colors.border, true: colors.accentMuted }}
          thumbColor={meta.isHidden ? colors.accent : colors.textMuted}
        />
      </View>
      <ErrorText message={error} />
      <BioEditSheet
        visible={bioOpen}
        meta={meta}
        onClose={() => setBioOpen(false)}
        onSaved={setMeta}
      />
      <LinksEditSheet
        visible={linksOpen}
        meta={meta}
        onClose={() => setLinksOpen(false)}
        onSaved={setMeta}
      />
    </View>
  );
}

export function ProfileSection({ aside }: { aside?: ReactNode }) {
  const { mode } = useExperienceMode();
  const wide = mode === 'desktop';
  const { user, identity, loading, error, reload, setIdentity } = useOwnIdentity();
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);

  if (!user) return aside ? <>{aside}</> : null;

  if (user.isDevBypass) {
    return (
      <View style={styles.sectionRoot}>
        <Card>
          <Text style={styles.heading}>Profile</Text>
          <Text style={styles.body}>Sign in with a live account to manage your public profile.</Text>
        </Card>
        {aside}
      </View>
    );
  }

  if (loading && !identity) {
    return (
      <View style={styles.sectionRoot}>
        <Card>
          <Text style={styles.heading}>Profile</Text>
          <ActivityIndicator color={colors.accent} />
        </Card>
        {aside}
      </View>
    );
  }

  if (!identity) {
    return (
      <View style={styles.sectionRoot}>
        <Card>
          <Text style={styles.heading}>Profile</Text>
          <ErrorText message={error ?? 'Profile not found'} />
          <Btn label="Retry" variant="secondary" onPress={() => void reload()} />
        </Card>
        {aside}
      </View>
    );
  }

  const choice = savedAvatarChoice(identity);
  const googleSelected = choice === 'google';
  const facebookSelected = choice === 'facebook';
  const providerSelected = googleSelected || facebookSelected;
  const presetValue = providerSelected
    ? resolveAvatarPresetId(identity.avatarUrl)
    : (choice as AvatarPresetId);
  const hasUsername = Boolean(identity.username?.trim());

  const hero = (
    <View style={[styles.hero, wide && styles.heroWide]}>
      <Pressable
        onPress={() => setAvatarOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Edit profile picture"
        style={styles.avatarTap}>
        <ProfileAvatar
          avatarUrl={presetValue}
          avatarSource={
            googleSelected ? 'google' : facebookSelected ? 'facebook' : 'preset'
          }
          avatarGoogleUrl={googleSelected ? identity.avatarGoogleUrl : null}
          avatarFacebookId={facebookSelected ? identity.avatarFacebookId : null}
          size={wide ? 120 : AVATAR_HERO_SIZE}
        />
        <View style={styles.avatarEditBadge} pointerEvents="none">
          <Text style={styles.avatarEditGlyph}>✎</Text>
        </View>
      </Pressable>

      <View style={styles.heroIdentity}>
        <View style={styles.usernameRow}>
          <Pressable
            onPress={() => setUsernameOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={hasUsername ? 'Edit username' : 'Add username'}
            style={styles.usernamePress}>
            <Text
              style={[
                styles.usernameHeading,
                wide && styles.usernameHeadingWide,
                !hasUsername && styles.usernameEmpty,
              ]}
              numberOfLines={1}>
              {hasUsername ? identity.username : 'Add username'}
            </Text>
          </Pressable>
          {identity.isVerifiedCreator ? (
            <Text style={styles.verifiedBadge} accessibilityLabel="Verified creator">
              ✓
            </Text>
          ) : null}
          <EditIconButton
            label={hasUsername ? 'Edit username' : 'Add username'}
            onPress={() => setUsernameOpen(true)}
          />
        </View>
        <Text style={[styles.permanentId, wide && styles.permanentIdWide]} numberOfLines={1}>
          {identity.globalHandle}
        </Text>
      </View>
    </View>
  );

  const fields = (
    <View style={wide ? undefined : styles.lockedBlock}>
      <SettingsLockedRow
        label="Display name"
        value={identity.displayName}
        placeholder="Add display name"
        onPress={() => setDisplayOpen(true)}
      />
      <PublicProfileLockedSection />
      <ErrorText message={error} />
    </View>
  );

  const sheets = (
    <>
      <UsernameEditSheet
        visible={usernameOpen}
        identity={identity}
        onClose={() => setUsernameOpen(false)}
        onSaved={(next) => {
          setIdentity(next);
          void writePromptState(next.id, 'done');
        }}
      />
      <DisplayNameEditSheet
        visible={displayOpen}
        identity={identity}
        onClose={() => setDisplayOpen(false)}
        onSaved={setIdentity}
      />
      <AvatarEditSheet
        visible={avatarOpen}
        identity={identity}
        onClose={() => setAvatarOpen(false)}
        onIdentityChange={setIdentity}
      />
    </>
  );

  if (wide) {
    return (
      <View style={styles.sectionRoot}>
        <Card>{hero}</Card>
        <View style={styles.wideSplit}>
          <View style={styles.wideCol}>
            <Card>{fields}</Card>
          </View>
          <View style={styles.wideCol}>{aside}</View>
        </View>
        {sheets}
      </View>
    );
  }

  return (
    <View style={styles.sectionRoot}>
      <Card>
        {hero}
        {fields}
      </Card>
      {aside}
      {sheets}
    </View>
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
      <View style={styles.stack}>
        <Text style={styles.permanentId}>{identity.globalHandle}</Text>
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
  sheetStack: {
    gap: 12,
    paddingTop: space.sm,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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
  sectionRoot: {
    gap: 16,
    width: '100%',
  },
  wideSplit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    width: '100%',
  },
  wideCol: {
    flex: 1,
    minWidth: 0,
  },
  hero: {
    alignItems: 'center',
    gap: 14,
    paddingTop: 4,
    paddingBottom: 8,
  },
  heroWide: {
    paddingVertical: 20,
    gap: 16,
  },
  avatarTap: {
    position: 'relative',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(11, 16, 22, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditGlyph: {
    color: 'rgba(238, 243, 248, 0.55)',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  avatarSheetPreview: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  heroIdentity: {
    alignItems: 'center',
    gap: 4,
    width: '100%',
    paddingHorizontal: 8,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  usernamePress: {
    flexShrink: 1,
    minWidth: 0,
  },
  usernameHeading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    textAlign: 'center',
  },
  usernameHeadingWide: {
    fontSize: 28,
    lineHeight: 34,
  },
  usernameEmpty: {
    color: colors.accent,
  },
  verifiedBadge: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  permanentId: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  permanentIdWide: {
    fontSize: 14,
    lineHeight: 20,
  },
  lockedBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 4,
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
  providerOption: {
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
  providerOptionDisabled: {
    opacity: 0.45,
  },
  providerOptionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  providerOptionLabelDisabled: {
    color: colors.textMuted,
  },
  linkBlock: {
    gap: 8,
    paddingBottom: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
  },
  switchLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
