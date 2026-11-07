import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DAY_LABELS, type Day } from '@kinexus/domain';

import { Chip } from '@/src/features/meals/meals-kit';
import { colors } from '@/src/features/shell/theme';

export function Section({
  label,
  children,
  last,
}: {
  label?: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.section, last && styles.sectionLast]}>
      {label ? <Text style={styles.sectionLabel}>{label}</Text> : null}
      {children}
    </View>
  );
}

export function GenerateAudiencePicker({
  people,
  selectedIds,
  onChange,
}: {
  people: readonly { id: string; name: string }[];
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
}) {
  if (people.length === 0) return null;
  const family = selectedIds.length === 0;
  return (
    <Section label="For">
      <View style={styles.row}>
        <Chip label="Family" active={family} onPress={() => onChange([])} />
        {people.map((person) => {
          const active = selectedIds.includes(person.id);
          return (
            <Chip
              key={person.id}
              label={person.name}
              active={active}
              onPress={() => {
                if (family) {
                  onChange([person.id]);
                  return;
                }
                onChange(active ? selectedIds.filter((id) => id !== person.id) : [...selectedIds, person.id]);
              }}
            />
          );
        })}
      </View>
    </Section>
  );
}

export function DayPicker({
  availableDays,
  selected,
  onToggle,
  onSelectAll,
}: {
  availableDays: readonly Day[];
  selected: ReadonlySet<Day>;
  onToggle: (day: Day) => void;
  onSelectAll: () => void;
}) {
  if (availableDays.length === 0) return null;
  const allSelected = availableDays.every((day) => selected.has(day));
  return (
    <Section label="Days">
      <View style={styles.row}>
        <Chip label="All" active={allSelected} onPress={onSelectAll} />
        {availableDays.map((day) => (
          <Chip
            key={day}
            label={DAY_LABELS[day].slice(0, 3)}
            active={selected.has(day)}
            onPress={() => onToggle(day)}
          />
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
