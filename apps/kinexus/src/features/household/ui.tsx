import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors, radius, space } from '@/src/features/shell/theme';
import { ErrorBanner } from '@/src/features/shell/states';

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 12,
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
  },
  inputMultiline: {
    minHeight: 120,
    paddingTop: 12,
  },
  btn: {
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
  pillLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  pillLabelActive: {
    color: colors.accent,
  },
});
