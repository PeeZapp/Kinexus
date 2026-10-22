import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  CORE_SLOTS,
  DAYS,
  DAY_LABELS,
  OPTIONAL_SLOTS,
  MEAL_SLOTS,
  type Day,
  type MealPrepStyle,
  type MealSlotKey,
  type NutritionGoals,
} from '@kinexus/domain';

import { Field } from '@/src/features/household/ui';
import { Chip } from '@/src/features/meals/meals-kit';
import { colors, radius, space } from '@/src/features/shell/theme';

import { GOAL_PRESETS, goalsMatch } from './presets';

export type GenerateMode = 'weekly' | 'meal_prep';

function Section({
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

export function GenerateModePicker({
  mode,
  onChange,
}: {
  mode: GenerateMode;
  onChange: (mode: GenerateMode) => void;
}) {
  return (
    <View style={styles.segmentTrack}>
      {(
        [
          { id: 'weekly', label: 'Weekly' },
          { id: 'meal_prep', label: 'Meal prep' },
        ] as const
      ).map((opt) => {
        const active = mode === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[styles.segment, active && styles.segmentActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}>
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
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

export function MealPrepControls({
  style,
  onChangeStyle,
  cookDay,
  onChangeCookDay,
  dishCount,
  onChangeDishCount,
  daysToCover,
  onChangeDaysToCover,
  maxDaysToCover,
}: {
  style: MealPrepStyle;
  onChangeStyle: (style: MealPrepStyle) => void;
  cookDay: Day;
  onChangeCookDay: (day: Day) => void;
  dishCount: number;
  onChangeDishCount: (count: number) => void;
  daysToCover: number;
  onChangeDaysToCover: (days: number) => void;
  maxDaysToCover: number;
}) {
  const dayOptions = [3, 5, 7].filter((n) => n <= maxDaysToCover);
  if (dayOptions.length === 0 || dayOptions[dayOptions.length - 1] !== maxDaysToCover) {
    dayOptions.push(maxDaysToCover);
  }

  return (
    <>
      <Section label="Style">
        <View style={styles.row}>
          <Chip
            label="Week portions"
            active={style === 'week_portions'}
            onPress={() => onChangeStyle('week_portions')}
          />
          <Chip
            label="Freezer batch"
            active={style === 'freezer_batch'}
            onPress={() => onChangeStyle('freezer_batch')}
          />
        </View>
      </Section>
      <Section label="Cook day">
        <View style={styles.row}>
          {DAYS.map((day) => (
            <Chip
              key={day}
              label={DAY_LABELS[day].slice(0, 3)}
              active={cookDay === day}
              onPress={() => onChangeCookDay(day)}
            />
          ))}
        </View>
      </Section>
      <Section label="Dishes">
        <View style={styles.row}>
          {[1, 2, 3].map((n) => (
            <Chip key={n} label={String(n)} active={dishCount === n} onPress={() => onChangeDishCount(n)} />
          ))}
        </View>
      </Section>
      <Section label="Cover">
        <View style={styles.row}>
          {dayOptions.map((n) => (
            <Chip
              key={n}
              label={n === maxDaysToCover ? `${n} days` : String(n)}
              active={daysToCover === n}
              onPress={() => onChangeDaysToCover(n)}
            />
          ))}
        </View>
      </Section>
    </>
  );
}

export function ServesPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  const count = value ?? null;
  return (
    <Section label="Serves">
      <View style={styles.row}>
        <Chip label="As written" active={count == null} onPress={() => onChange(null)} />
        <Pressable
          onPress={() => count != null && onChange(Math.max(1, count - 1))}
          disabled={count == null || count <= 1}
          accessibilityRole="button"
          accessibilityLabel="Fewer serves"
          style={[styles.stepBtn, (count == null || count <= 1) && styles.stepBtnDisabled]}>
          <Text style={styles.stepBtnLabel}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{count ?? '—'}</Text>
        <Pressable
          onPress={() => onChange(count == null ? 2 : Math.min(24, count + 1))}
          disabled={count != null && count >= 24}
          accessibilityRole="button"
          accessibilityLabel="More serves"
          style={[styles.stepBtn, count != null && count >= 24 && styles.stepBtnDisabled]}>
          <Text style={styles.stepBtnLabel}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.meta}>Scale every recipe to this many serves.</Text>
    </Section>
  );
}

export function WeeklyBudgetField({
  value,
  onChange,
  lines,
}: {
  value: string;
  onChange: (next: string) => void;
  lines: readonly string[];
}) {
  return (
    <Section label="Budget">
      <View style={styles.budgetRow}>
        <Text style={styles.budgetPrefix}>$</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="optional"
          placeholderTextColor={colors.textDim}
          keyboardType="decimal-pad"
          accessibilityLabel="Weekly food budget"
          style={styles.budgetInput}
        />
      </View>
      {lines.map((line) => (
        <Text key={line} style={styles.meta}>
          {line}
        </Text>
      ))}
    </Section>
  );
}

export function SlotPicker({
  selected,
  onToggle,
}: {
  selected: ReadonlySet<MealSlotKey>;
  onToggle: (slot: MealSlotKey) => void;
}) {
  return (
    <Section label="Meals">
      <View style={styles.row}>
        {CORE_SLOTS.map((slot) => (
          <Chip
            key={slot}
            label={MEAL_SLOTS.find((s) => s.key === slot)?.label ?? slot}
            active={selected.has(slot)}
            onPress={() => onToggle(slot)}
          />
        ))}
      </View>
      <View style={styles.row}>
        {OPTIONAL_SLOTS.map((slot) => (
          <Chip
            key={slot}
            label={MEAL_SLOTS.find((s) => s.key === slot)?.label ?? slot}
            active={selected.has(slot)}
            onPress={() => onToggle(slot)}
          />
        ))}
      </View>
    </Section>
  );
}

export function GoalsEditor({
  goals,
  onChange,
  desktop,
  defaultOpen = false,
}: {
  goals: NutritionGoals;
  onChange: (next: NutritionGoals) => void;
  desktop: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const activePreset = GOAL_PRESETS.find((preset) => goalsMatch(goals, preset.goals));

  return (
    <View style={[styles.section, styles.sectionLast]}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.goalsToggle} accessibilityRole="button">
        <View style={styles.goalsToggleCopy}>
          <Text style={styles.sectionLabel}>Daily goals</Text>
          <Text style={styles.meta}>
            {activePreset ? activePreset.name : 'Custom'} · {goals.calories} kcal · {goals.protein}g protein
          </Text>
        </View>
        <Text style={styles.chevron}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.goalsBody}>
          <View style={styles.row}>
            {GOAL_PRESETS.map((preset) => (
              <Chip
                key={preset.id}
                label={preset.name}
                active={goalsMatch(goals, preset.goals)}
                onPress={() => onChange(preset.goals)}
              />
            ))}
          </View>
          <View style={desktop ? styles.goalGrid : styles.goalStack}>
            <GoalField
              label="Calories"
              value={goals.calories}
              onChange={(n) => onChange({ ...goals, calories: n })}
              min={800}
              max={4500}
              step={50}
              desktop={desktop}
            />
            <GoalField
              label="Protein"
              value={goals.protein}
              onChange={(n) => onChange({ ...goals, protein: n })}
              min={40}
              max={300}
              step={5}
              desktop={desktop}
            />
            <GoalField
              label="Carbs"
              value={goals.carbs}
              onChange={(n) => onChange({ ...goals, carbs: n })}
              min={20}
              max={500}
              step={5}
              desktop={desktop}
            />
            <GoalField
              label="Fat"
              value={goals.fat}
              onChange={(n) => onChange({ ...goals, fat: n })}
              min={20}
              max={200}
              step={5}
              desktop={desktop}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function GoalField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  desktop,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  desktop: boolean;
}) {
  const webRange = desktop && Platform.OS === 'web';
  return (
    <View style={styles.goalField}>
      <View style={styles.goalHead}>
        <Text style={styles.goalLabel}>{label}</Text>
        <Text style={styles.goalValue}>{value}</Text>
      </View>
      {webRange ? (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#3ECFBF' }}
        />
      ) : (
        <View style={styles.stepRow}>
          <Pressable onPress={() => onChange(Math.max(min, value - step))} style={styles.stepBtn}>
            <Text style={styles.stepLabel}>−</Text>
          </Pressable>
          <Field label="" value={String(value)} onChangeText={(t) => onChange(Number(t) || min)} keyboardType="numeric" />
          <Pressable onPress={() => onChange(Math.min(max, value + step))} style={styles.stepBtn}>
            <Text style={styles.stepLabel}>+</Text>
          </Pressable>
        </View>
      )}
    </View>
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
  meta: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  segmentActive: {
    backgroundColor: colors.bgHover,
  },
  segmentLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: colors.text,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minWidth: 140,
  },
  budgetPrefix: {
    color: colors.textDim,
    fontSize: 15,
    fontWeight: '600',
    marginRight: 4,
  },
  budgetInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 10,
    minWidth: 72,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepBtnLabel: { color: colors.text, fontSize: 18, fontWeight: '700', lineHeight: 22 },
  stepValue: {
    minWidth: 28,
    textAlign: 'center',
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  goalsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  goalsToggleCopy: { flex: 1, minWidth: 0, gap: 3 },
  chevron: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '600',
    width: 20,
    textAlign: 'center',
  },
  goalsBody: { gap: 12, marginTop: 12 },
  goalGrid: { gap: 10 },
  goalStack: { gap: 12 },
  goalField: { gap: 4 },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  goalLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  goalValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepLabel: { color: colors.text, fontSize: 20, fontWeight: '600' },
});

void space;
