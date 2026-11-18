import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AiBlockedBanner } from '@/src/features/ai/AiBlockedBanner';
import { OptionTiles } from '@/src/features/household/option-tiles';
import { Btn, Card, ErrorText } from '@/src/features/household/ui';
import { colors, radius, space } from '@/src/features/shell/theme';
import {
  AI_PROVIDER_OPTIONS,
  getHouseholdAiKey,
  getHouseholdAiKeyAccess,
  removeHouseholdAiKey,
  setHouseholdAiKey,
  setHouseholdAiKeyAccess,
  type HouseholdAiKeyAccessRow,
  type HouseholdAiKeyMeta,
} from '@/src/lib/ai-keys-api';
import { useAiStatus } from '@/src/lib/ai-status-context';
import { confirmAction } from '@/src/lib/confirm';
import { useHousehold } from '@/src/lib/household';

export function AiKeySettings({ fill = false }: { fill?: boolean } = {}) {
  const { activeHousehold, canManageHousehold } = useHousehold();
  const { refresh } = useAiStatus();
  const householdId = activeHousehold?.id;
  const isAdmin = canManageHousehold;

  const [meta, setMeta] = useState<HouseholdAiKeyMeta | null>(null);
  const [members, setMembers] = useState<HouseholdAiKeyAccessRow[]>([]);
  const [keyDraft, setKeyDraft] = useState('');
  const [provider, setProvider] = useState<string | null>(null);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!householdId) return;
    const next = await getHouseholdAiKey(householdId);
    setMeta(next);
    if (isAdmin && next.hasKey) {
      const access = await getHouseholdAiKeyAccess(householdId);
      setMembers(access.members);
    } else {
      setMembers([]);
    }
  }, [householdId, isAdmin]);

  useEffect(() => {
    if (!householdId) return;
    let cancel = false;
    setError(null);
    void reload()
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : 'Could not load AI key settings.');
      });
    return () => {
      cancel = true;
    };
  }, [householdId, reload]);

  if (!householdId) return null;

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await setHouseholdAiKey({
        householdId: householdId!,
        key: keyDraft,
        ...(provider ? { provider } : {}),
      });
      setKeyDraft('');
      setProvider(null);
      setShowProviderPicker(false);
      setReplacing(false);
      await reload();
      await refresh().catch(() => undefined);
    } catch (err) {
      const needsProvider = err instanceof Error && 'needsProvider' in err && Boolean((err as { needsProvider?: boolean }).needsProvider);
      if (needsProvider) {
        setShowProviderPicker(true);
        setError('Choose a provider for this key.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not save that key.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    const ok = await confirmAction('Remove household AI key?', 'Members will stop using this key.');
    if (!ok) return;
    setError(null);
    setBusy(true);
    try {
      await removeHouseholdAiKey(householdId!);
      setReplacing(false);
      setKeyDraft('');
      await reload();
      await refresh().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that key.');
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(userId: string, allowed: boolean) {
    setError(null);
    setMembers((current) => current.map((row) => (row.userId === userId ? { ...row, allowed } : row)));
    try {
      await setHouseholdAiKeyAccess({ householdId: householdId!, userId, allowed });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update access.');
      await reload().catch(() => undefined);
    }
  }

  if (!isAdmin) {
    const line = !meta?.hasKey
      ? null
      : meta.allowed
        ? "Your household's AI key: on for you"
        : "Your household's AI key: off for you — ask an admin";
    if (!line) return null;
    return (
      <View style={styles.stack}>
        <AiBlockedBanner dismissible={false} />
        <Card>
          <Text style={styles.heading}>AI</Text>
          <Text style={styles.line}>{line}</Text>
          <ErrorText message={error} />
        </Card>
      </View>
    );
  }

  const showForm = !meta?.hasKey || replacing;

  return (
    <View style={[styles.stack, fill ? styles.fill : styles.stackMobile]}>
      <AiBlockedBanner dismissible={false} />
    <Card style={fill ? styles.cardFill : styles.cardMobile}>
      <Text style={styles.heading}>AI key</Text>
      <ErrorText message={error} />

      {meta?.hasKey && !replacing ? (
        <View style={styles.saved}>
          <Text style={styles.line}>
            {meta.providerLabel ?? 'AI'} ····{meta.last4}
          </Text>
          <View style={styles.row}>
            <Btn label="Replace" variant="secondary" disabled={busy} onPress={() => setReplacing(true)} />
            <Btn label="Remove" variant="danger" busy={busy} disabled={busy} onPress={() => void onRemove()} />
          </View>
        </View>
      ) : null}

      {showForm ? (
        <View style={styles.form}>
          <TextInput
            value={keyDraft}
            onChangeText={setKeyDraft}
            placeholder="API key"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
          />
          {showProviderPicker ? (
            <OptionTiles
              label="Provider"
              rows={AI_PROVIDER_OPTIONS.map((opt) => ({
                key: opt.id,
                label: opt.label,
                active: provider === opt.id,
                onPress: () => setProvider(opt.id),
              }))}
            />
          ) : null}
          <View style={styles.row}>
            <Btn label="Save" busy={busy} disabled={busy || !keyDraft.trim()} onPress={() => void save()} />
            {replacing ? (
              <Btn
                label="Cancel"
                variant="ghost"
                disabled={busy}
                onPress={() => {
                  setReplacing(false);
                  setKeyDraft('');
                  setShowProviderPicker(false);
                  setProvider(null);
                }}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      {meta?.hasKey ? (
        <View style={styles.access}>
          <Text style={styles.accessHeading}>Who can use it</Text>
          {members.map((row) => (
            <View key={row.userId} style={styles.memberRow}>
              <Text style={styles.memberName}>{row.displayName}</Text>
              <Switch
                value={row.allowed}
                onValueChange={(value) => void onToggle(row.userId, value)}
                trackColor={{ false: colors.border, true: colors.accentMuted }}
                thumbColor={row.allowed ? colors.accent : colors.textMuted}
              />
            </View>
          ))}
        </View>
      ) : null}
    </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  fill: { flex: 1 },
  stackMobile: { alignSelf: 'stretch', width: '100%', minWidth: 0, maxWidth: '100%' },
  cardFill: { flexGrow: 1, alignSelf: 'stretch', width: '100%', minWidth: 0, maxWidth: '100%' },
  cardMobile: { alignSelf: 'stretch', width: '100%', minWidth: 0, maxWidth: '100%' },
  heading: { color: colors.text, fontSize: 17, fontWeight: '700' },
  line: { color: colors.text, fontSize: 14 },
  saved: { gap: 10 },
  form: { gap: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.bgElevated,
    fontSize: 15,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  access: { gap: 8, marginTop: space.sm },
  accessHeading: { color: colors.text, fontSize: 15, fontWeight: '700' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 40,
  },
  memberName: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
});
