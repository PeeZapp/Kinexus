import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { normalizeFoodTags } from '@kinexus/domain';

import { Btn, Field } from '@/src/features/household/ui';
import { colors, radius, space } from '@/src/features/shell/theme';

function lowerSet(values: readonly string[]): Set<string> {
  return new Set(values.map((v) => v.toLowerCase()));
}

export type FoodTagOption = {
  id: string;
  label: string;
  emoji: string;
};

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

function OptionGrid({
  rows,
  disabled,
}: {
  rows: readonly { key: string; label: string; active: boolean; onPress?: () => void }[];
  disabled?: boolean;
}) {
  if (rows.length === 0) return <Text style={styles.empty}>None</Text>;
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <SelectTile
          key={row.key}
          label={row.label}
          active={row.active}
          disabled={disabled}
          onPress={row.onPress}
        />
      ))}
    </View>
  );
}

export function StringTagEditor({
  label,
  placeholder,
  value,
  onChange,
  suggestions,
  disabled,
}: {
  label: string;
  placeholder?: string;
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: readonly string[];
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const chosen = useMemo(() => lowerSet(value), [value]);
  const suggestionRows = useMemo(
    () =>
      (suggestions ?? []).map((item) => ({
        key: item,
        label: item,
        active: chosen.has(item.toLowerCase()),
        onPress: disabled
          ? undefined
          : () => {
              if (chosen.has(item.toLowerCase())) {
                onChange(value.filter((v) => v.toLowerCase() !== item.toLowerCase()));
              } else {
                onChange(normalizeFoodTags([...value, item]));
              }
            },
      })),
    [chosen, disabled, onChange, suggestions, value],
  );
  const customRows = useMemo(() => {
    const suggestionKeys = new Set((suggestions ?? []).map((item) => item.toLowerCase()));
    return value
      .filter((item) => !suggestionKeys.has(item.toLowerCase()))
      .map((item) => ({
        key: `custom-${item}`,
        label: item,
        active: true,
        onPress: disabled ? undefined : () => onChange(value.filter((v) => v !== item)),
      }));
  }, [disabled, onChange, suggestions, value]);

  const add = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    onChange(normalizeFoodTags([...value, trimmed]));
    setDraft('');
  };

  return (
    <View style={styles.block}>
      {customRows.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Yours</Text>
          <OptionGrid rows={customRows} disabled={disabled} />
        </View>
      ) : null}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{label}</Text>
        <OptionGrid rows={suggestionRows} disabled={disabled} />
      </View>
      <Field
        label={`Add ${label.toLowerCase()}`}
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        autoCapitalize="words"
        autoCorrect={false}
        editable={!disabled}
        returnKeyType="done"
        onSubmitEditing={() => add(draft)}
      />
      <View style={styles.inline}>
        <Btn label="Add" onPress={() => add(draft)} disabled={disabled || !draft.trim()} />
      </View>
    </View>
  );
}

export function OptionTagEditor({
  label,
  options,
  value,
  onChange,
  allowCustom,
  customFieldLabel,
  customPlaceholder,
  disabled,
  emptyLabel,
}: {
  label: string;
  options: readonly FoodTagOption[];
  value: string[];
  onChange: (next: string[]) => void;
  allowCustom?: boolean;
  customFieldLabel?: string;
  customPlaceholder?: string;
  disabled?: boolean;
  emptyLabel?: string;
}) {
  const [draft, setDraft] = useState('');
  const active = useMemo(() => lowerSet(value), [value]);
  const optionIds = useMemo(() => new Set(options.map((o) => o.id.toLowerCase())), [options]);
  const customValues = useMemo(
    () => value.filter((v) => !optionIds.has(v.toLowerCase())),
    [optionIds, value],
  );

  const toggle = (id: string) => {
    if (active.has(id.toLowerCase())) {
      onChange(value.filter((v) => v.toLowerCase() !== id.toLowerCase()));
    } else {
      onChange(normalizeFoodTags([...value, id]));
    }
  };

  const addCustom = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    onChange(normalizeFoodTags([...value, trimmed]));
    setDraft('');
  };

  const optionRows = options.map((opt) => ({
    key: opt.id,
    label: `${opt.emoji} ${opt.label}`,
    active: active.has(opt.id.toLowerCase()),
    onPress: disabled ? undefined : () => toggle(opt.id),
  }));

  const customRows = customValues.map((item) => ({
    key: `custom-${item}`,
    label: item,
    active: true,
    onPress: disabled ? undefined : () => onChange(value.filter((v) => v !== item)),
  }));

  const noneRow =
    emptyLabel != null
      ? [
          {
            key: 'none',
            label: emptyLabel,
            active: value.length === 0,
            onPress: disabled ? undefined : () => onChange([]),
          },
        ]
      : [];

  return (
    <View style={styles.block}>
      {customRows.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Yours</Text>
          <OptionGrid rows={customRows} disabled={disabled} />
        </View>
      ) : null}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{label}</Text>
        <OptionGrid rows={[...noneRow, ...optionRows]} disabled={disabled} />
      </View>
      {allowCustom ? (
        <>
          <Field
            label={customFieldLabel ?? `Add ${label.toLowerCase()}`}
            value={draft}
            onChangeText={setDraft}
            placeholder={customPlaceholder}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!disabled}
            returnKeyType="done"
            onSubmitEditing={() => addCustom(draft)}
          />
          <View style={styles.inline}>
            <Btn label="Add" onPress={() => addCustom(draft)} disabled={disabled || !draft.trim()} />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  section: { gap: 8 },
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
  tilePressed: { opacity: 0.82 },
  tileLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  tileLabelActive: { color: colors.accent },
  empty: { color: colors.textMuted, fontSize: 14 },
  inline: { alignSelf: 'flex-start' },
});
