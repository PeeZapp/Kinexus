import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/src/features/shell/theme';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const;

type Part = 'day' | 'month' | 'year';

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseIso(value: string | null | undefined): { day: number; month: number; year: number } | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (!year || month < 1 || month > 12 || day < 1) return null;
  if (day > daysInMonth(year, month)) return null;
  return { day, month, year };
}

function toIso(day: number, month: number, year: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function DropdownField({
  label,
  valueLabel,
  open,
  onPress,
  flex,
}: {
  label: string;
  valueLabel: string;
  open: boolean;
  onPress: () => void;
  flex?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${label}: ${valueLabel}`}
      style={({ pressed }) => [
        styles.field,
        flex != null && { flex },
        open && styles.fieldOpen,
        pressed && styles.pressed,
      ]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldValueRow}>
        <Text style={styles.fieldValue} numberOfLines={1}>
          {valueLabel}
        </Text>
        <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
      </View>
    </Pressable>
  );
}

export function IsoDatePicker({
  label,
  value,
  onChange,
  optional = false,
  minYear: minYearProp,
  maxYear: maxYearProp,
  yearOrder = 'desc',
}: {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
  /** When true, empty is allowed and a Clear control is shown. */
  optional?: boolean;
  minYear?: number;
  maxYear?: number;
  yearOrder?: 'asc' | 'desc';
}) {
  const now = new Date();
  const maxYear = maxYearProp ?? now.getFullYear() + 10;
  const minYear = minYearProp ?? now.getFullYear() - 120;
  const seed = parseIso(value) ?? {
    day: now.getDate(),
    month: now.getMonth() + 1,
    year: Math.min(Math.max(now.getFullYear(), minYear), maxYear),
  };

  const years = useMemo(() => {
    const list: { value: number; label: string }[] = [];
    if (yearOrder === 'asc') {
      for (let year = minYear; year <= maxYear; year += 1) {
        list.push({ value: year, label: String(year) });
      }
    } else {
      for (let year = maxYear; year >= minYear; year -= 1) {
        list.push({ value: year, label: String(year) });
      }
    }
    return list;
  }, [maxYear, minYear, yearOrder]);

  const parsed = parseIso(value);
  const [day, setDay] = useState(seed.day);
  const [month, setMonth] = useState(seed.month);
  const [year, setYear] = useState(seed.year);
  const [open, setOpen] = useState<Part | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const next = parseIso(value);
    if (next) {
      setDay(next.day);
      setMonth(next.month);
      setYear(next.year);
      return;
    }
    if (!optional) {
      const fallback = toIso(seed.day, seed.month, seed.year);
      onChangeRef.current(fallback);
    }
    // seed is derived from value/now; only re-seed when value or optional changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, optional, minYear, maxYear]);

  const maxDay = daysInMonth(year, month);
  const dayOptions = useMemo(
    () => Array.from({ length: maxDay }, (_, i) => ({ value: i + 1, label: String(i + 1) })),
    [maxDay],
  );
  const safeDay = Math.min(day, maxDay);
  const monthLabel = MONTHS.find((row) => row.value === month)?.label ?? String(month);
  const unset = optional && !parsed;

  const openOptions =
    open === 'day'
      ? dayOptions
      : open === 'month'
        ? MONTHS.map((row) => ({ value: row.value, label: row.label }))
        : open === 'year'
          ? years
          : [];

  const openSelected = open === 'day' ? safeDay : open === 'month' ? month : year;

  function commit(nextDay: number, nextMonth: number, nextYear: number) {
    const clamped = Math.min(nextDay, daysInMonth(nextYear, nextMonth));
    setDay(clamped);
    setMonth(nextMonth);
    setYear(nextYear);
    onChange(toIso(clamped, nextMonth, nextYear));
  }

  function toggle(part: Part) {
    setOpen((current) => (current === part ? null : part));
  }

  function pick(next: number) {
    if (open === 'day') commit(next, month, year);
    else if (open === 'month') commit(safeDay, next, year);
    else if (open === 'year') commit(safeDay, month, next);
    setOpen(null);
  }

  function clear() {
    setOpen(null);
    onChange(null);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional && parsed ? (
          <Pressable onPress={clear} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Clear ${label}`}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.row}>
        <DropdownField
          label="Day"
          valueLabel={unset ? '—' : String(safeDay)}
          open={open === 'day'}
          onPress={() => toggle('day')}
          flex={0.85}
        />
        <DropdownField
          label="Month"
          valueLabel={unset ? '—' : monthLabel}
          open={open === 'month'}
          onPress={() => toggle('month')}
          flex={1.4}
        />
        <DropdownField
          label="Year"
          valueLabel={unset ? '—' : String(year)}
          open={open === 'year'}
          onPress={() => toggle('year')}
          flex={1}
        />
      </View>

      {open ? (
        <ScrollView style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {openOptions.map((option) => {
            const active = !unset && option.value === openSelected;
            return (
              <Pressable
                key={option.value}
                onPress={() => pick(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.option,
                  active && styles.optionActive,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  clear: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  field: {
    minWidth: 0,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    minHeight: 56,
    justifyContent: 'center',
  },
  fieldOpen: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  pressed: {
    opacity: 0.86,
  },
  fieldLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  fieldValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fieldValue: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
    maxHeight: 240,
  },
  option: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionActive: {
    backgroundColor: colors.accentSoft,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  optionLabelActive: {
    color: colors.accent,
  },
});
