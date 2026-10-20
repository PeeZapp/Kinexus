import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { colors } from '@/src/features/shell/theme';

/** Short caption under recipe heroes — photos may be AI or stock stand-ins. */
export function RecipeImageDisclaimer({
  visible,
  style,
}: {
  visible?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  if (!visible) return null;
  return <Text style={[styles.text, style]}>Image is illustrative only</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
});
