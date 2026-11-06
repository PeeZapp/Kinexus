import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Sheet } from '@/src/features/meals/meals-kit';
import { Btn } from '@/src/features/household/ui';
import { colors, radius } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export type LinkShareState = {
  isShared: boolean;
  shareToken: string | null;
  url: string | null;
};

export function LinkShareSheet({
  visible,
  title,
  preview,
  state,
  busy,
  error,
  onClose,
  onToggle,
  onReset,
}: {
  visible: boolean;
  title: string;
  preview: string;
  state: LinkShareState;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onToggle: (enabled: boolean) => Promise<string | null>;
  onReset: () => Promise<string | null>;
}) {
  useExperienceMode();
  const [status, setStatus] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const working = Boolean(busy || localBusy);
  const url = state.url;

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
    <Sheet visible={visible} title={title} onClose={onClose}>
      <View style={styles.stack}>
        <Text style={styles.preview}>{preview}</Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: state.isShared }}
          disabled={working}
          onPress={() => void run(() => onToggle(!state.isShared), state.isShared ? 'Sharing off' : 'Link copied')}
          style={[styles.toggle, state.isShared && styles.toggleOn]}>
          <View style={[styles.knob, state.isShared && styles.knobOn]} />
          <Text style={[styles.toggleLabel, state.isShared && styles.toggleLabelOn]}>Anyone with the link can view</Text>
        </Pressable>
        {url ? <Text style={styles.url} numberOfLines={2}>{url}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}
        <Btn
          label="Copy link"
          variant="secondary"
          disabled={!state.isShared || !url || working}
          busy={working}
          onPress={() => {
            if (!url) return;
            void Clipboard.setStringAsync(url).then(() => setStatus('Link copied'));
          }}
        />
        <Btn label="Share" disabled={!state.isShared || !url || working} onPress={() => void nativeShare()} />
        <Btn
          label="Reset link"
          variant="ghost"
          disabled={!state.isShared || working}
          onPress={() => void run(() => onReset(), 'New link copied — old link revoked')}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
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
