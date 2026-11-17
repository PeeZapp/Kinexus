import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/src/features/shell/theme';

export type OptionTileRow = {
  key: string;
  label: string;
  active: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

export function OptionTiles({
  rows,
  label,
}: {
  rows: readonly OptionTileRow[];
  label?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.block}>
      {label ? <Text style={styles.sectionLabel}>{label}</Text> : null}
      <View style={styles.grid}>
        {rows.map((row) => (
          <SelectTile
            key={row.key}
            label={row.label}
            active={row.active}
            disabled={row.disabled || !row.onPress}
            onPress={row.onPress}
          />
        ))}
      </View>
    </View>
  );
}

function SelectTile({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: Boolean(disabled) }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        active && styles.tileActive,
        pressed && !disabled && styles.tilePressed,
      ]}>
      <Text style={[styles.tileLabel, active && styles.tileLabelActive]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    maxWidth: '48.5%',
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  tileActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  tilePressed: {
    opacity: 0.82,
  },
  tileLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  tileLabelActive: {
    color: colors.accent,
  },
});
