import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DAY_LABELS, MEAL_SLOTS, mondayWeekStart, type Day, type GeneratedSlot, type MealSlotKey, type NutritionGoals } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { Chip } from '@/src/features/meals/meals-kit';
import { GoalsEditor, SlotPicker } from '@/src/features/meals/generate/controls';
import { WeekSwitcher, slotTitle } from '@/src/features/meals/plan/PlanShared';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { isoDayNumber, todayDay, weekApplyLabel, weekDayIso } from '@/src/features/meals/week-labels';
import { colors, radius, space } from '@/src/features/shell/theme';

export type GenerateViewProps = {
  weekStart: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  selected: Set<MealSlotKey>;
  onToggleSlot: (slot: MealSlotKey) => void;
  goals: NutritionGoals;
  onChangeGoals: (next: NutritionGoals) => void;
  dietarySummary: string;
  recipeCount: number;
  planDays: readonly Day[];
  hiddenSlotKeys: ReadonlySet<string>;
  fillableCount: number;
  onGenerate: () => void;
  preview: GeneratedSlot[] | null;
  avgCal: number;
  avgProt: number;
  onSwap: (day: Day, slot: MealSlotKey) => void;
  onRandom: (day: Day, slot: MealSlotKey) => void;
  onApply: () => void;
  applying: boolean;
  error: string | null;
  onOpenRecipe: (id: string, day: Day, slot: MealSlotKey) => void;
};

export function GenerateDesktop(props: GenerateViewProps) {
  const thisWeek = props.weekStart === mondayWeekStart();
  const today = todayDay();
  const slotKeys = MEAL_SLOTS.map((slot) => slot.key).filter((key) => props.selected.has(key));
  const previewByKey = new Map((props.preview ?? []).map((row) => [`${row.day}_${row.slot}`, row] as const));

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Fill the week</Text>
          <Text style={styles.title}>Generate plan</Text>
        </View>
        <View style={styles.headerActions}>
          <Btn
            label={`Fill ${props.fillableCount} slots`}
            onPress={props.onGenerate}
            disabled={props.selected.size === 0}
          />
          {props.preview ? (
            <Btn label={weekApplyLabel(props.weekStart)} onPress={props.onApply} busy={props.applying} />
          ) : null}
        </View>
      </View>
      <WeekSwitcher weekStart={props.weekStart} onPrev={props.onPrevWeek} onNext={props.onNextWeek} />
      <Text style={styles.lede}>
        {props.recipeCount} recipes after dietary filters · {props.dietarySummary}
      </Text>
      <View style={styles.controls}>
        <View style={styles.panel}>
          <SlotPicker selected={props.selected} onToggle={props.onToggleSlot} />
        </View>
        <View style={styles.panel}>
          <GoalsEditor goals={props.goals} onChange={props.onChangeGoals} desktop />
        </View>
      </View>
      <ErrorText message={props.error} />
      {props.preview ? (
        <View style={styles.stats}>
          <Chip label={`~${props.avgCal} kcal / day`} active />
          <Chip label={`~${props.avgProt}g protein / day`} active />
        </View>
      ) : (
        <Text style={styles.hint}>
          Nothing is saved until you apply. Fill the week, then accept the plan or swap any slot.
        </Text>
      )}
      <View style={styles.week}>
        {props.planDays.map((day) => {
          const iso = weekDayIso(props.weekStart, day);
          const highlight = thisWeek && day === today;
          const kcal = slotKeys.reduce((sum, slot) => {
            return sum + (previewByKey.get(`${day}_${slot}`)?.recipe.calories ?? 0);
          }, 0);
          return (
            <View key={day} style={[styles.day, highlight && styles.dayToday]}>
              <View style={styles.dayHead}>
                <Text style={[styles.dow, highlight && styles.dowToday]}>
                  {highlight ? 'Today' : DAY_LABELS[day].slice(0, 3)}
                </Text>
                <Text style={[styles.dateNum, highlight && styles.dateToday]}>{isoDayNumber(iso)}</Text>
                <Text style={styles.kcal}>{kcal > 0 ? `${Math.round(kcal).toLocaleString()} kcal` : ' '}</Text>
              </View>
              {slotKeys
                .filter((slot) => !props.hiddenSlotKeys.has(`${day}_${slot}`))
                .map((slot) => {
                const row = previewByKey.get(`${day}_${slot}`);
                return (
                  <View key={slot} style={[styles.meal, row ? styles.mealFilled : styles.mealEmpty]}>
                    {row ? (
                      <>
                        <Pressable
                          onPress={() => props.onOpenRecipe(row.recipe.id, row.day, row.slot)}
                          style={styles.mealHit}>
                          <View style={styles.mealPhoto}>
                            <RecipePhoto uri={row.recipe.imageUrl} emoji={row.recipe.emoji} size="fill" radius={0} />
                          </View>
                          <View style={styles.mealBody}>
                            <Text style={styles.slotLabel}>{slotTitle(slot)}</Text>
                            <Text style={styles.mealName}>{row.recipe.name}</Text>
                            <Text style={styles.mealKcal}>
                              {row.recipe.calories != null ? `${row.recipe.calories} kcal` : ' '}
                            </Text>
                          </View>
                        </Pressable>
                        <View style={styles.cellActions}>
                          <Pressable onPress={() => props.onSwap(day, slot)} hitSlop={6}>
                            <Text style={styles.swap}>Swap</Text>
                          </Pressable>
                          <Pressable onPress={() => props.onRandom(day, slot)} hitSlop={6}>
                            <Text style={styles.swap}>Random</Text>
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <View style={styles.mealBody}>
                        <Text style={[styles.slotLabel, styles.slotEmpty]}>{slotTitle(slot)}</Text>
                        <Text style={styles.mealName}>{props.preview ? 'Not filled' : 'Will fill'}</Text>
                        <Text style={styles.mealKcal}> </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 32, paddingBottom: 48, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  headerCopy: { flex: 1, minWidth: 0, gap: 4 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 40, fontWeight: '700' },
  lede: { color: colors.textMuted, fontSize: 15 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  controls: { flexDirection: 'row', alignItems: 'stretch', gap: 16, width: '100%' },
  panel: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 12,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  week: { flexDirection: 'row', alignItems: 'stretch', gap: 10, width: '100%' },
  day: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    gap: 8,
  },
  dayToday: { borderColor: colors.accent },
  dayHead: { height: 72, paddingHorizontal: 6, paddingTop: 4, justifyContent: 'flex-start' },
  dow: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  dowToday: { color: colors.accent },
  dateNum: { color: colors.text, fontSize: 28, fontWeight: '700', lineHeight: 32 },
  dateToday: { color: colors.accent },
  kcal: { color: colors.textDim, fontSize: 11, fontWeight: '600', height: 16 },
  meal: {
    flexGrow: 1,
    flexShrink: 0,
    minHeight: 88,
    minWidth: 0,
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  mealPhoto: { height: 72, width: '100%' },
  mealHit: { flexGrow: 1 },
  mealFilled: { borderColor: colors.border },
  mealEmpty: { borderStyle: 'dashed' },
  mealBody: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8, gap: 4, flex: 1, justifyContent: 'center' },
  slotLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  slotEmpty: { color: colors.accent },
  mealName: { color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 18, width: '100%' },
  mealKcal: { color: colors.textDim, fontSize: 11, minHeight: 14 },
  cellActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 8, paddingBottom: 10 },
  swap: { color: colors.accent, fontSize: 11, fontWeight: '700' },
});
