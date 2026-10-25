import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/src/features/shell/theme';

export function GenerateMealFooter({
  sides,
  onOpenSide,
  onRemoveSide,
  onAddSide,
  onSwap,
  onRandom,
  roomy = false,
}: {
  sides: readonly { id: string; name: string }[];
  onOpenSide: (id: string) => void;
  onRemoveSide: (id: string) => void;
  onAddSide: () => void;
  onSwap: () => void;
  onRandom: () => void;
  roomy?: boolean;
}) {
  return (
    <View>
      {sides.length > 0 ? (
        <View style={styles.sides}>
          {sides.map((side) => (
            <View key={side.id} style={styles.side}>
              <View style={styles.rail} />
              <Pressable
                onPress={() => onOpenSide(side.id)}
                style={({ pressed }) => [styles.sideMain, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`View ${side.name}`}>
                <Text style={[styles.sideName, roomy && styles.sideNameRoomy]} numberOfLines={2}>
                  {side.name}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onRemoveSide(side.id)}
                hitSlop={4}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${side.name}`}>
                <Text style={styles.remove}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.actions}>
        <View style={styles.pair}>
          <ActionButton label="Pick" onPress={onSwap} roomy={roomy} fill />
          <ActionButton label="⇄" onPress={onRandom} accessibilityLabel="Random" roomy={roomy} mark />
        </View>
        <ActionButton label="Add side" onPress={onAddSide} accessibilityLabel="Add side dish" roomy={roomy} />
      </View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  accessibilityLabel,
  roomy,
  fill = false,
  mark = false,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  roomy?: boolean;
  fill?: boolean;
  mark?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.button,
        fill && styles.buttonFill,
        mark && styles.markButton,
        roomy && styles.buttonRoomy,
        mark && roomy && styles.markButtonRoomy,
        pressed && styles.buttonPressed,
      ]}>
      <Text style={[styles.buttonLabel, mark && styles.markLabel, roomy && !mark && styles.buttonLabelRoomy]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sides: {
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    backgroundColor: colors.bgHover,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  rail: { width: 3, alignSelf: 'stretch', backgroundColor: colors.accent },
  sideMain: { flex: 1, minWidth: 0, justifyContent: 'center', paddingLeft: 8, paddingVertical: 6 },
  sideName: { color: colors.text, fontSize: 12, fontWeight: '700', lineHeight: 16 },
  sideNameRoomy: { fontSize: 14, lineHeight: 18 },
  iconBtn: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  remove: { color: colors.textMuted, fontSize: 18, lineHeight: 18 },
  pressed: { opacity: 0.65 },
  actions: {
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  pair: { flexDirection: 'row', gap: 6 },
  button: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  buttonFill: { flexGrow: 1, flexBasis: 0, minWidth: 0 },
  markButton: {
    width: 32,
    flexGrow: 0,
    flexBasis: 'auto',
    paddingHorizontal: 0,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  buttonRoomy: { minHeight: 40, paddingVertical: 10 },
  markButtonRoomy: { width: 40 },
  buttonPressed: { backgroundColor: colors.bg },
  buttonLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  buttonLabelRoomy: { fontSize: 14 },
  markLabel: { color: colors.accent, fontSize: 16, fontWeight: '800', lineHeight: 18 },
});
