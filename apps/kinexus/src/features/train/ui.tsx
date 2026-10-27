import { useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { instructionSteps } from '@/src/features/train/format';
import { colors, radius, space } from '@/src/features/shell/theme';

export function TrainPage({ children }: { children: ReactNode }) {
  return (
    <View style={styles.page}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

export function TrainButton({
  label,
  onPress,
  tone = 'accent',
  disabled = false,
  fill = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'ghost' | 'danger';
  disabled?: boolean;
  fill?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        tone === 'ghost' && styles.buttonGhost,
        tone === 'danger' && styles.buttonDanger,
        fill && styles.fill,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text
        style={[
          styles.buttonLabel,
          tone === 'ghost' && styles.buttonLabelGhost,
          tone === 'danger' && styles.buttonLabelDanger,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TextAction({
  label,
  onPress,
  tone = 'muted',
}: {
  label: string;
  onPress: () => void;
  tone?: 'muted' | 'danger' | 'accent';
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={styles.textAction}>
      <Text
        style={[
          styles.textActionLabel,
          tone === 'danger' && styles.textActionDanger,
          tone === 'accent' && styles.textActionAccent,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Choice({
  label,
  active,
  onPress,
  block = false,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  block?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.choice, block && styles.choiceBlock, active && styles.choiceActive]}>
      <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segmentItem, active && styles.segmentItemOn]}>
            <Text style={[styles.segmentLabel, active && styles.segmentLabelOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  value,
  onChangeText,
  placeholder,
  keyboard,
  title = false,
  fill = false,
  compact = false,
  editable = true,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboard?: 'default' | 'numeric';
  title?: boolean;
  fill?: boolean;
  compact?: boolean;
  editable?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textDim}
      keyboardType={keyboard === 'numeric' ? 'decimal-pad' : 'default'}
      editable={editable}
      style={[styles.field, fill && styles.fieldFill, compact && styles.fieldCompact, title && styles.fieldTitle, !editable && styles.fieldLocked]}
    />
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textDim}
      autoCapitalize="none"
      autoCorrect={false}
      clearButtonMode="while-editing"
      style={styles.search}
    />
  );
}

export function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  if (!onPress) return <View style={styles.card}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export function ExerciseSteps({ instructions }: { instructions: string[] }) {
  const steps = instructionSteps(instructions);
  if (steps.length === 0) return null;
  return (
    <View style={styles.steps}>
      {steps.map((step, index) => (
        <View key={`${index}-${step.slice(0, 24)}`} style={styles.step}>
          <View style={styles.stepNo}>
            <Text style={styles.stepNoLabel}>{index + 1}</Text>
          </View>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

export function MediaFrame({ uri }: { uri: string }) {
  return (
    <View style={styles.media}>
      <Image source={{ uri }} style={styles.mediaImage} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

export function MediaGallery({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  if (urls.length === 1) return <MediaFrame uri={urls[0]!} />;
  return (
    <View style={styles.mediaPair}>
      {urls.map((uri, index) => (
        <View key={uri} style={styles.mediaPairItem}>
          <Image source={{ uri }} style={styles.mediaImage} resizeMode="contain" accessibilityIgnoresInvertColors />
          <View style={styles.mediaIndex}>
            <Text style={styles.mediaIndexLabel}>{index + 1}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function Check({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={on ? 'Completed set' : 'Mark set complete'}
      hitSlop={6}
      style={[styles.check, on && styles.checkOn]}>
      <Text style={[styles.checkMark, on && styles.checkMarkOn]}>{on ? '✓' : ''}</Text>
    </Pressable>
  );
}

export function NoteLine({
  label,
  value,
  editable,
  maxLength = 160,
  onSave,
}: {
  label: string;
  value: string;
  editable: boolean;
  maxLength?: number;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [expanded, setExpanded] = useState(false);
  const [lines, setLines] = useState(1);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  if (!value && !editable) return null;

  if (editing) {
    return (
      <View style={styles.noteEdit}>
        <TextInput
          value={draft}
          onChangeText={(text) => setDraft(text.slice(0, maxLength))}
          placeholder={label}
          placeholderTextColor={colors.textDim}
          style={styles.noteInput}
          autoFocus
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Save ${label}`}
          onPress={() => {
            onSave(draft.trim().slice(0, maxLength));
            setEditing(false);
            setExpanded(false);
          }}
          style={styles.noteIcon}>
          <Text style={styles.noteSave}>✓</Text>
        </Pressable>
      </View>
    );
  }

  if (!value) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${label}`}
        onPress={() => {
          setDraft('');
          setEditing(true);
        }}
        style={styles.noteAdd}>
        <Text style={styles.notePencil}>✎</Text>
        <Text style={styles.noteAddLabel}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.noteSaved}>
      <Text style={styles.noteKind}>{label}</Text>
      <View style={styles.noteCopy}>
        <Text
          style={[styles.noteText, styles.noteMeasure]}
          pointerEvents="none"
          onTextLayout={(event) => {
            const count = event.nativeEvent.lines.length;
            setLines((current) => (current === count ? current : count));
          }}>
          {value}
        </Text>
        <Text style={styles.noteText} numberOfLines={expanded ? undefined : 1}>
          {value}
        </Text>
      </View>
      {lines > 1 && !expanded ? <TextAction label="More" tone="accent" onPress={() => setExpanded(true)} /> : null}
      {expanded && lines > 1 ? <TextAction label="Less" onPress={() => setExpanded(false)} /> : null}
      {editable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${label}`}
          onPress={() => {
            setDraft(value);
            setEditing(true);
          }}
          hitSlop={6}
          style={styles.noteIcon}>
          <Text style={styles.notePencil}>✎</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.sm },
  column: { flex: 1, width: '100%', gap: space.sm },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGhost: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  buttonDanger: { backgroundColor: 'transparent' },
  buttonLabel: { color: colors.bg, fontWeight: '700', fontSize: 15 },
  buttonLabelGhost: { color: colors.text },
  buttonLabelDanger: { color: colors.danger },
  fill: { alignSelf: 'stretch', flexGrow: 1 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.4 },
  textAction: { minHeight: 32, justifyContent: 'center' },
  textActionLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  textActionDanger: { color: colors.danger },
  textActionAccent: { color: colors.accent },
  choice: {
    backgroundColor: colors.bgCard,
    borderRadius: 999,
    paddingHorizontal: 12,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceBlock: { alignSelf: 'stretch', borderRadius: radius.md, minHeight: 44, alignItems: 'flex-start', paddingHorizontal: 14 },
  choiceActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  choiceLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  choiceLabelActive: { color: colors.text },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentItemOn: { backgroundColor: colors.accentSoft },
  segmentLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  segmentLabelOn: { color: colors.accent },
  field: {
    backgroundColor: colors.bgCard,
    color: colors.text,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    minHeight: 44,
    minWidth: 64,
    fontSize: 16,
  },
  fieldFill: { flex: 1, minWidth: 0 },
  fieldCompact: { width: 72, minWidth: 72, maxWidth: 72, textAlign: 'center', flexGrow: 0 },
  fieldLocked: { opacity: 0.7 },
  fieldTitle: {
    fontSize: 22,
    fontWeight: '700',
    minHeight: 52,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
  },
  search: {
    backgroundColor: colors.bgCard,
    color: colors.text,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    minHeight: 44,
    fontSize: 16,
  },
  pill: {
    backgroundColor: colors.bgHover,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  steps: { gap: 14 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNoLabel: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  stepText: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 22 },
  media: {
    height: 240,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mediaPair: { flexDirection: 'row', gap: 8 },
  mediaPairItem: {
    flex: 1,
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mediaIndex: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaIndexLabel: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  mediaImage: { width: '100%', height: '100%' },
  check: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { fontSize: 16, fontWeight: '700', color: 'transparent' },
  checkMarkOn: { color: colors.bg },
  badge: {
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeLabel: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  noteEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteInput: {
    flex: 1,
    minWidth: 0,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  noteSaved: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  noteKind: { color: colors.textDim, fontSize: 11, fontWeight: '700', paddingTop: 2, width: 36 },
  noteCopy: { flex: 1, minWidth: 0, position: 'relative' },
  noteText: { color: colors.text, fontSize: 14, lineHeight: 18 },
  noteMeasure: { position: 'absolute', opacity: 0, left: 0, right: 0 },
  noteAdd: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  noteAddLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  noteIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  notePencil: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  noteSave: { color: colors.accent, fontSize: 16, fontWeight: '800' },
});
