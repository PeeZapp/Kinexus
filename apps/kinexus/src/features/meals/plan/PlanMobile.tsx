import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DAYS, mondayWeekStart, type Day, type MealSlotKey } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { OfflineBanner } from '@/src/features/meals/meals-kit';
import { DayPlanHeader, PlanMealCard, WeekSwitcher, dayPlanSlots } from '@/src/features/meals/plan/PlanShared';
import { recipePhotoUrl } from '@/src/features/meals/RecipePhoto';
import type { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { isoDayNumber, todayDay, weekDayIso } from '@/src/features/meals/week-labels';
import { colors, radius, space } from '@/src/features/shell/theme';

type Meals = ReturnType<typeof useMealsSync>;

export function PlanMobile({
  meals,
  personNames,
  expandedDays,
  showGenerate = true,
  canManage = false,
  onToggleDay,
  onOpenSlot,
  onAddSlot,
  onRemoveSlot,
  onRemoveDay,
  onRestoreDay,
  onGenerate,
  onShopping,
}: {
  meals: Meals;
  personNames: Map<string, string>;
  expandedDays: readonly Day[];
  showGenerate?: boolean;
  canManage?: boolean;
  onToggleDay: (day: Day) => void;
  onOpenSlot: (day: Day, slot: MealSlotKey) => void;
  onAddSlot: (day: Day) => void;
  onRemoveSlot: (day: Day) => void;
  onRemoveDay: (day: Day) => void;
  onRestoreDay: (day: Day) => void;
  onGenerate: () => void;
  onShopping: () => void;
}) {
  const insets = useSafeAreaInsets();
  const thisWeek = meals.weekStart === mondayWeekStart();
  const today = todayDay();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <WeekSwitcher
        weekStart={meals.weekStart}
        onPrev={() => meals.shiftWeek(-1)}
        onNext={() => meals.shiftWeek(1)}
      />
      <View style={styles.actions}>
        {showGenerate ? <Btn label="Generate plan" onPress={onGenerate} /> : null}
        <Btn label="Shopping list" variant="secondary" onPress={onShopping} />
      </View>
      <OfflineBanner online={meals.online} pendingCount={meals.pendingCount} extra={meals.importBlockedReason} />
      <ErrorText message={meals.error} />
      {DAYS.map((day) => {
        const iso = weekDayIso(meals.weekStart, day);
        const highlight = thisWeek && day === today;
        const { visible, addable, removed } = dayPlanSlots(meals.activeSlots, meals.slotMap, day);
        const expanded = !removed && expandedDays.includes(day);
        const filled = visible.filter((slot) => meals.slotMap.get(`${day}_${slot}`)?.recipeId).length;
        const kcal = visible.reduce((sum, slot) => sum + (meals.slotMap.get(`${day}_${slot}`)?.calories ?? 0), 0);
        return (
          <View key={day} style={[styles.dayCard, highlight && styles.dayToday, removed && styles.dayRemoved]}>
            <DayPlanHeader
              day={day}
              dateNum={isoDayNumber(iso)}
              highlight={highlight}
              expanded={expanded}
              removed={removed}
              meta={`${filled} / ${visible.length} meals${kcal ? ` · ${Math.round(kcal).toLocaleString()} kcal` : ''}`}
              canManage={canManage}
              onToggle={() => onToggleDay?.(day)}
              onRemove={() => onRemoveDay?.(day)}
              onRestore={() => onRestoreDay?.(day)}
            />
            {expanded ? (
              <View style={styles.meals}>
                {visible.map((slot) => {
                  const cell = meals.slotMap.get(`${day}_${slot}`);
                  const hasRecipe = Boolean(cell?.recipeId);
                  const assignee = cell?.assignedPersonId ? personNames.get(cell.assignedPersonId) : null;
                  return (
                    <PlanMealCard
                      key={slot}
                      slot={slot}
                      filled={hasRecipe}
                      photoUrl={recipePhotoUrl(meals.recipes, cell?.recipeId)}
                      emoji={cell?.emoji}
                      title={hasRecipe ? (cell?.recipeName ?? 'Meal') : assignee ? `${assignee} picks` : 'Add meal'}
                      meta={
                        assignee && hasRecipe
                          ? `${assignee}${cell?.calories ? ` · ${cell.calories} kcal` : ''}`
                          : cell?.calories
                            ? `${cell.calories} kcal`
                            : ''
                      }
                      photoHeight={168}
                      onPress={() => onOpenSlot(day, slot)}
                    />
                  );
                })}
                {canManage && addable.length > 0 ? (
                  <Pressable onPress={() => onAddSlot(day)} style={styles.addRow}>
                    <Text style={styles.addLabel}>Add slot</Text>
                  </Pressable>
                ) : null}
                {canManage && visible.length > 0 ? (
                  <Pressable onPress={() => onRemoveSlot(day)} style={styles.addRow}>
                    <Text style={styles.addLabel}>Remove slot</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.md, paddingTop: space.sm, gap: 20 },
  actions: { gap: 8 },
  dayCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  dayToday: { borderColor: colors.accent },
  dayRemoved: { opacity: 0.72 },
  meals: { borderTopWidth: 1, borderTopColor: colors.border, padding: space.sm, gap: 16 },
  addRow: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: { color: colors.accent, fontWeight: '700', fontSize: 13 },
});
