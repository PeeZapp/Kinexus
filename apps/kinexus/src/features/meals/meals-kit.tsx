import { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function OfflineBanner({ online, pendingCount, extra }: { online: boolean; pendingCount: number; extra?: string | null }) {
  if (online && pendingCount === 0) return null;
  return (
    <View style={[styles.banner, !online && styles.bannerOffline]}>
      <Text style={styles.bannerTitle}>{online ? 'Syncing' : 'Offline'}</Text>
      <Text style={styles.bannerBody}>
        {!online
          ? `Slot edits queue locally. ${extra ?? ''}`.trim()
          : `${pendingCount} slot change(s) waiting to sync.`}
      </Text>
    </View>
  );
}

export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  return (
    <Modal visible={visible} transparent animationType={desktop ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          style={[styles.sheetCard, desktop ? styles.sheetDesktop : styles.sheetMobile]}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.sheetClose}>Close</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.sheetBody}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentMuted,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
    gap: 4,
  },
  bannerOffline: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warning,
  },
  bannerTitle: { color: colors.warning, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  bannerBody: { color: colors.text, fontSize: 13, lineHeight: 18 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetCard: {
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
    borderWidth: 1,
    width: '100%',
    maxHeight: '88%',
  },
  sheetDesktop: {
    maxWidth: 520,
    marginBottom: 48,
    borderRadius: radius.lg,
    alignSelf: 'center',
    justifyContent: 'flex-start',
  },
  sheetMobile: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: 8,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  sheetClose: { color: colors.accent, fontWeight: '700' },
  sheetBody: { paddingHorizontal: space.md, paddingBottom: space.lg },
  chip: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipLabelActive: { color: colors.accent },
});
