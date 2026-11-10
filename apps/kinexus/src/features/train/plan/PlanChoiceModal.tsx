import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppModal } from '@/src/features/shell/AppModal';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export type PlanChoiceOption<T extends string> = {
  key: T;
  label: string;
  detail: string;
};

export function PlanChoiceModal<T extends string>({
  visible,
  title,
  options,
  emptyLabel,
  onClose,
  onChoose,
}: {
  visible: boolean;
  title: string;
  options: readonly PlanChoiceOption<T>[];
  emptyLabel?: string;
  onClose: () => void;
  onChoose: (choice: T) => void;
}) {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';

  return (
    <AppModal visible={visible} transparent animationType={desktop ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable
          onPress={() => undefined}
          accessibilityViewIsModal
          style={[styles.card, desktop ? styles.cardDesktop : styles.cardMobile]}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {options.map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                onPress={() => onChoose(option.key)}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionDetail}>{option.detail}</Text>
              </Pressable>
            ))}
            {options.length === 0 && emptyLabel ? <Text style={styles.empty}>{emptyLabel}</Text> : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 10, 14, 0.72)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderWidth: 1,
    gap: space.md,
    padding: space.lg,
    maxHeight: '78%',
  },
  cardMobile: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: space.xl,
  },
  cardDesktop: {
    maxWidth: 420,
    marginBottom: 48,
    borderRadius: radius.xl,
    alignSelf: 'center',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  close: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  listScroll: { flexGrow: 0 },
  list: { gap: 10, paddingBottom: 4 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 4,
  },
  optionPressed: {
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSoft,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  optionDetail: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 8,
  },
});
