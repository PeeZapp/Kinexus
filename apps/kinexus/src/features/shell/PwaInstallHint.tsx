import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '@/src/features/shell/theme';
import { getPwaInstallPlatform, isStandalonePwa } from '@/src/lib/pwa';
import { useExperienceMode } from '@/src/lib/experience-mode';

const DISMISS_KEY = 'kinexus.pwaHint.dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function PwaInstallHint() {
  // Shown on mobile web only; hidden once installed or dismissed.
  const { mode, isNative, isPreview } = useExperienceMode();
  const [visible, setVisible] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const platform = Platform.OS === 'web' ? getPwaInstallPlatform() : 'other';

  const dismiss = useCallback(() => {
    setVisible(false);
    setInstallEvent(null);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore quota / private-mode failures.
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || isNative || isPreview || mode !== 'mobile' || isStandalonePwa()) {
      setVisible(false);
      return;
    }
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') {
        setVisible(false);
        return;
      }
    } catch {
      return;
    }
    setVisible(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      dismiss();
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [dismiss, isNative, isPreview, mode]);

  async function onInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') dismiss();
  }

  if (!visible) return null;

  const copy =
    platform === 'ios'
      ? 'Install for family testing: tap Share, then Add to Home Screen.'
      : installEvent
        ? 'Install Kinexus on this phone for app-like access while we test.'
        : 'Install for family testing: open the browser menu and choose Add to Home screen.';

  return (
    <View style={styles.banner}>
      <Text style={styles.copy}>{copy}</Text>
      <View style={styles.actions}>
        {installEvent ? (
          <Pressable onPress={() => void onInstall()} style={styles.installBtn} hitSlop={8}>
            <Text style={styles.installLabel}>Install</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={dismiss} hitSlop={8}>
          <Text style={styles.dismiss}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    gap: 10,
  },
  copy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  installBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  installLabel: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: '700',
  },
  dismiss: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
