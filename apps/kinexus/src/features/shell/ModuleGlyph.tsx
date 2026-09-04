import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/src/features/shell/theme';

type Props = {
  short: string;
  active?: boolean;
  size?: number;
};

export function ModuleGlyph({ short, active = false, size = 28 }: Props) {
  return (
    <View
      style={[
        styles.glyph,
        {
          width: size,
          height: size,
          borderRadius: Math.max(radius.sm, size / 3.4),
          backgroundColor: active ? colors.accentSoft : colors.bgHover,
        },
      ]}>
      <Text style={[styles.label, { color: active ? colors.accent : colors.textMuted, fontSize: size * 0.36 }]}>
        {short}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
