import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  isListShareTarget,
  shareTargetLabel,
  shareTargetPrimaryActionLabel,
  type ShareTarget,
  type ShareTargetGuess,
} from '@kinexus/domain';

import { Btn } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import {
  readLastUsedShareList,
  resolveLastUsedList,
  shareListKind,
  type LastUsedShareList,
  type ShareListKind,
} from '@/src/features/share/share-target-last-list';
import { colors, space } from '@/src/features/shell/theme';

export type ShareTargetPickerLists = Partial<Record<ShareListKind, readonly LastUsedShareList[]>>;

export type ShareTargetPickerProps = {
  visible: boolean;
  guess: ShareTargetGuess;
  lists: ShareTargetPickerLists;
  busy?: boolean;
  onCancel: () => void;
  onPick: (input: { target: ShareTarget; list: LastUsedShareList | null }) => void;
};

function previewLine(guess: ShareTargetGuess): string {
  const host = guess.preview.host;
  const title = guess.preview.title;
  if (host && title) return `${host} · ${title}`;
  if (host) return host;
  if (title) return title;
  if (guess.url) return guess.url;
  if (guess.text) {
    const first = guess.text.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    return first ?? 'Shared text';
  }
  return 'Shared item';
}

export function ShareTargetPicker({ visible, guess, lists, busy, onCancel, onPick }: ShareTargetPickerProps) {
  const primary = guess.targets[0] ?? 'recipe';
  const others = guess.targets.slice(1);
  const [list, setList] = useState<LastUsedShareList | null>(null);
  const [changingList, setChangingList] = useState(false);
  const [preferred, setPreferred] = useState<Partial<Record<ShareListKind, LastUsedShareList | null>>>({});

  useEffect(() => {
    if (!visible) return;
    setChangingList(false);
  }, [primary, visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      const next: Partial<Record<ShareListKind, LastUsedShareList | null>> = {};
      for (const kind of ['watchlist', 'readlist', 'wishlist'] as const) {
        next[kind] = await readLastUsedShareList(kind);
      }
      if (!cancelled) setPreferred(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const availableLists = useMemo(() => {
    const kind = shareListKind(primary);
    if (!kind) return [] as LastUsedShareList[];
    return [...(lists[kind] ?? [])];
  }, [lists, primary]);

  useEffect(() => {
    const kind = shareListKind(primary);
    if (!kind) {
      setList(null);
      return;
    }
    setList(resolveLastUsedList(availableLists, preferred[kind] ?? null));
  }, [availableLists, preferred, primary]);

  function pick(target: ShareTarget) {
    const kind = shareListKind(target);
    const nextList =
      target === primary && list
        ? list
        : kind
          ? resolveLastUsedList([...(lists[kind] ?? [])], preferred[kind] ?? null)
          : null;
    onPick({ target, list: nextList });
  }

  return (
    <Sheet visible={visible} title="Share to Kinexus" onClose={onCancel}>
      <View style={styles.stack}>
        <Text style={styles.preview} numberOfLines={2}>
          {previewLine(guess)}
        </Text>

        <Btn
          label={shareTargetPrimaryActionLabel(primary)}
          onPress={() => pick(primary)}
          busy={busy}
          disabled={busy || (isListShareTarget(primary) && !list && availableLists.length > 0)}
        />

        {isListShareTarget(primary) && list ? (
          <View style={styles.listRow}>
            <Text style={styles.listMeta} numberOfLines={1}>
              {list.name}
            </Text>
            {availableLists.length > 1 ? (
              <Pressable onPress={() => setChangingList((open) => !open)} hitSlop={8}>
                <Text style={styles.change}>{changingList ? 'Done' : 'Change list'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {changingList && availableLists.length > 1 ? (
          <View style={styles.listChoices}>
            {availableLists.map((row) => (
              <Pressable
                key={row.id}
                onPress={() => {
                  setList(row);
                  setChangingList(false);
                }}
                style={styles.listChoice}
              >
                <Text style={[styles.listChoiceLabel, row.id === list?.id && styles.listChoiceActive]}>
                  {row.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.others}>
          {others.map((target) => (
            <Pressable key={target} onPress={() => pick(target)} style={styles.otherRow} disabled={busy}>
              <Text style={styles.otherLabel}>{shareTargetLabel(target)}</Text>
            </Pressable>
          ))}
        </View>

        <Btn label="Cancel" variant="ghost" onPress={onCancel} disabled={busy} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  preview: { color: colors.text, fontSize: 16, fontWeight: '600' },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  listMeta: { flex: 1, color: colors.textMuted, fontSize: 14 },
  change: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  listChoices: { gap: space.xs },
  listChoice: { paddingVertical: space.xs },
  listChoiceLabel: { color: colors.textMuted, fontSize: 15 },
  listChoiceActive: { color: colors.text, fontWeight: '600' },
  others: { gap: space.xs, paddingTop: space.xs },
  otherRow: { paddingVertical: space.sm },
  otherLabel: { color: colors.textMuted, fontSize: 15 },
});
