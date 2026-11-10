import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import type { HouseholdPerson } from '@kinexus/domain';

import { Btn } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import type { LinkShareState } from '@/src/features/share/LinkShareSheet';
import { SharePicker } from '@/src/features/stash/sheets';
import type { ListShareDraft } from '@/src/features/stash/use-stash-sync';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function ReadlistShareSheet({
  visible,
  preview,
  share,
  onShareChange,
  people,
  linkState,
  linkBusy,
  linkError,
  onClose,
  onSaveVisibility,
  onToggleLink,
  onResetLink,
}: {
  visible: boolean;
  preview: string;
  share: ListShareDraft;
  onShareChange: (share: ListShareDraft) => void;
  people: HouseholdPerson[];
  linkState: LinkShareState;
  linkBusy?: boolean;
  linkError?: string | null;
  onClose: () => void;
  onSaveVisibility: () => Promise<void>;
  onToggleLink: (enabled: boolean) => Promise<string | null>;
  onResetLink: () => Promise<string | null>;
}) {
  useExperienceMode();
  const [status, setStatus] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const working = Boolean(linkBusy || localBusy);
  const url = linkState.url;

  useEffect(() => {
    if (!visible) return;
    setStatus(null);
  }, [visible]);

  async function run(action: () => Promise<string | null>, okMessage: string) {
    if (working) return;
    setLocalBusy(true);
    setStatus(null);
    try {
      const nextUrl = await action();
      if (nextUrl) {
        await Clipboard.setStringAsync(nextUrl);
        setStatus(okMessage);
      } else {
        setStatus(null);
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not update share link');
    } finally {
      setLocalBusy(false);
    }
  }

  async function nativeShare() {
    if (!url || working) return;
    setLocalBusy(true);
    setStatus(null);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: preview, text: preview, url });
      } else {
        await Share.share({ message: `${preview}\n${url}`, url, title: preview });
      }
    } catch {
      // user cancelled
    } finally {
      setLocalBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Share readlist" onClose={onClose}>
      <View style={styles.stack}>
        <SharePicker share={share} onChange={onShareChange} people={people} />
        <Btn
          label="Save"
          variant="secondary"
          disabled={working || (share.visibility === 'people' && share.personIds.length === 0)}
          busy={working}
          onPress={() => {
            void (async () => {
              if (working) return;
              setLocalBusy(true);
              setStatus(null);
              try {
                await onSaveVisibility();
                setStatus('Visibility saved');
              } catch (err) {
                setStatus(err instanceof Error ? err.message : 'Could not save visibility');
              } finally {
                setLocalBusy(false);
              }
            })();
          }}
        />

        <Text style={styles.preview}>{preview}</Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: linkState.isShared }}
          disabled={working}
          onPress={() =>
            void run(
              () => onToggleLink(!linkState.isShared),
              linkState.isShared ? 'Sharing off' : 'Link copied',
            )
          }
          style={[styles.toggle, linkState.isShared && styles.toggleOn]}>
          <View style={[styles.knob, linkState.isShared && styles.knobOn]} />
          <Text style={[styles.toggleLabel, linkState.isShared && styles.toggleLabelOn]}>
            Anyone with the link can view
          </Text>
        </Pressable>
        {url ? (
          <Text style={styles.url} numberOfLines={2}>
            {url}
          </Text>
        ) : null}
        {linkError ? <Text style={styles.error}>{linkError}</Text> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}
        <Btn
          label="Copy link"
          variant="secondary"
          disabled={!linkState.isShared || !url || working}
          busy={working}
          onPress={() => {
            if (!url) return;
            void Clipboard.setStringAsync(url).then(() => setStatus('Link copied'));
          }}
        />
        <Btn label="Share" disabled={!linkState.isShared || !url || working} onPress={() => void nativeShare()} />
        <Btn
          label="Reset link"
          variant="ghost"
          disabled={!linkState.isShared || working}
          onPress={() => void run(() => onResetLink(), 'New link copied — old link revoked')}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  preview: { color: colors.text, fontSize: 16, fontWeight: '700' },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  toggleOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  knobOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  toggleLabel: { flex: 1, color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  toggleLabelOn: { color: colors.accent },
  url: { color: colors.textDim, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  status: { color: colors.textMuted, fontSize: 13 },
});
