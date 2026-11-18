import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, radius, space } from '@/src/features/shell/theme';
import { ErrorBanner } from '@/src/features/shell/states';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  ...rest
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        style={[styles.input, multiline && styles.inputMultiline]}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        scrollEnabled={multiline ? false : undefined}
        textAlignVertical={multiline ? 'top' : undefined}
        {...rest}
      />
    </View>
  );
}

type BtnProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
};

export function Btn({ label, onPress, disabled, busy, variant = 'primary' }: BtnProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'danger' && styles.btnDanger,
        variant === 'ghost' && styles.btnGhost,
        (disabled || busy) && styles.btnDisabled,
        pressed && styles.pressed,
      ]}>
      {busy ? (
        <ActivityIndicator color={variant === 'primary' ? colors.bg : colors.text} />
      ) : (
        <Text
          style={[
            styles.btnLabel,
            variant === 'primary' && styles.btnLabelPrimary,
            variant === 'danger' && styles.btnLabelDanger,
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  return <ErrorBanner message={message} />;
}

export function Pill({
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
      style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
      hitSlop={4}
      style={({ pressed }) => [styles.backLink, pressed && styles.backLinkPressed]}>
      <Text style={styles.backChevron}>←</Text>
      <Text style={styles.backLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Locked settings summary row — tap opens an edit sheet. */
export function SettingsLockedRow({
  label,
  value,
  placeholder = 'None',
  onPress,
}: {
  label: string;
  value?: string | null;
  placeholder?: string;
  onPress: () => void;
}) {
  const trimmed = value?.trim() ?? '';
  const empty = !trimmed;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${label}`}
      style={({ pressed }) => [styles.lockedRow, pressed && styles.pressed]}>
      <View style={styles.lockedRowText}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={[styles.lockedValue, empty && styles.lockedPlaceholder]} numberOfLines={2}>
          {empty ? placeholder : trimmed}
        </Text>
      </View>
      <Text style={styles.lockedEdit} accessibilityElementsHidden>
        ✎
      </Text>
    </Pressable>
  );
}

export function EditIconButton({
  onPress,
  label,
  faint,
}: {
  onPress: () => void;
  label: string;
  faint?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.editIconBtn,
        faint && styles.editIconBtnFaint,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.editIconGlyph, faint && styles.editIconGlyphFaint]}>✎</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 12,
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    minWidth: 0,
    width: '100%',
  },
  inputMultiline: {
    minHeight: 120,
    paddingTop: 12,
  },
  btn: {
    maxWidth: '100%',
    minWidth: 0,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
  },
  btnSecondary: {
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDanger: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  btnLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  btnLabelPrimary: {
    color: colors.bg,
  },
  btnLabelDanger: {
    color: colors.danger,
  },
  pressed: {
    opacity: 0.86,
  },
  pill: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  backLink: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentMuted,
  },
  backLinkPressed: { opacity: 0.72 },
  backChevron: { color: colors.accent, fontSize: 16, fontWeight: '700', lineHeight: 20 },
  backLabel: { color: colors.accent, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  pillLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  pillLabelActive: {
    color: colors.accent,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lockedRowText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  lockedValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  lockedPlaceholder: {
    color: colors.textDim,
    fontWeight: '500',
  },
  lockedEdit: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  editIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIconBtnFaint: {
    backgroundColor: 'rgba(11, 16, 22, 0.45)',
  },
  editIconGlyph: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 18,
  },
  editIconGlyphFaint: {
    color: 'rgba(238, 243, 248, 0.55)',
  },
});
