import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { CORE_SLOTS, OPTIONAL_SLOTS, MEAL_SLOTS, type MealSlotKey, type NutritionGoals } from '@kinexus/domain';

import { Field } from '@/src/features/household/ui';
import { Chip } from '@/src/features/meals/meals-kit';
import { colors, radius, space } from '@/src/features/shell/theme';

import { GOAL_PRESETS } from './presets';

export function SlotPicker({
  selected,
  onToggle,
}: {
  selected: ReadonlySet<MealSlotKey>;
  onToggle: (slot: MealSlotKey) => void;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>Meals to fill</Text>
      <Text style={styles.hint}>Unselected breakfast/lunch/dinner still count as assumed calories. Snacks do not.</Text>
      <Text style={styles.sub}>Core</Text>
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
      <Text style={styles.sub}>Optional</Text>
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
    </View>
  );
}

export function GoalsEditor({
  goals,
  onChange,
  desktop,
}: {
  goals: NutritionGoals;
  onChange: (next: NutritionGoals) => void;
  desktop: boolean;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>Daily goals</Text>
      <Text style={styles.hint}>Used by generate-plan. This is not a food log.</Text>
      <View style={styles.row}>
        {GOAL_PRESETS.map((preset) => (
          <Chip key={preset.id} label={preset.name} onPress={() => onChange(preset.goals)} />
        ))}
      </View>
      <View style={desktop ? styles.goalGrid : styles.goalStack}>
        <GoalField label="Calories" value={goals.calories} onChange={(n) => onChange({ ...goals, calories: n })} min={800} max={4500} step={50} desktop={desktop} />
        <GoalField label="Protein g" value={goals.protein} onChange={(n) => onChange({ ...goals, protein: n })} min={40} max={300} step={5} desktop={desktop} />
        <GoalField label="Carbs g" value={goals.carbs} onChange={(n) => onChange({ ...goals, carbs: n })} min={20} max={500} step={5} desktop={desktop} />
        <GoalField label="Fat g" value={goals.fat} onChange={(n) => onChange({ ...goals, fat: n })} min={20} max={200} step={5} desktop={desktop} />
      </View>
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
        <Text style={styles.sub}>{label}</Text>
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
  block: { gap: 10 },
  label: { color: colors.text, fontSize: 18, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  sub: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  goalStack: { gap: 12 },
  goalField: { flexGrow: 1, minWidth: desktopMin(), gap: 6 },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between' },
  goalValue: { color: colors.accent, fontWeight: '800' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepLabel: { color: colors.text, fontSize: 22, fontWeight: '700' },
});

function desktopMin() {
  return 200;
}
void space;
