import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DAYS, mondayWeekStart, type Day, type MealSlotKey } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { OfflineBanner } from '@/src/features/meals/meals-kit';
import { DayPlanHeader, PlanMealCard, WeekSwitcher, dayPlanSlots } from '@/src/features/meals/plan/PlanShared';
import { recipePhotoUrl } from '@/src/features/meals/RecipePhoto';
import type { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { isoDayNumber, todayDay, weekDayIso } from '@/src/features/meals/week-labels';
import { colors, radius, space } from '@/src/features/shell/theme';

type Meals = ReturnType<typeof useMealsSync>;

export function PlanDesktop({
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
  const thisWeek = meals.weekStart === mondayWeekStart();
  const today = todayDay();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>{thisWeek ? 'This week' : 'Meal plan'}</Text>
          <Text style={styles.title}>Plan</Text>
        </View>
        <View style={styles.headerActions}>
          {showGenerate ? <Btn label="Generate" onPress={onGenerate} /> : null}
          <Btn label="Shopping" variant="secondary" onPress={onShopping} />
        </View>
      </View>
      <WeekSwitcher
        weekStart={meals.weekStart}
        onPrev={() => meals.shiftWeek(-1)}
        onNext={() => meals.shiftWeek(1)}
      />
      <OfflineBanner online={meals.online} pendingCount={meals.pendingCount} extra={meals.importBlockedReason} />
      <ErrorText message={meals.error} />
      <View style={styles.days}>
        {DAYS.map((day) => {
          const iso = weekDayIso(meals.weekStart, day);
          const highlight = thisWeek && day === today;
          const { visible, addable, removed } = dayPlanSlots(meals.activeSlots, meals.slotMap, day);
          const expanded = !removed && expandedDays.includes(day);
          const filled = visible.filter((slot) => meals.slotMap.get(`${day}_${slot}`)?.recipeId).length;
          const kcal = visible.reduce((sum, slot) => sum + (meals.slotMap.get(`${day}_${slot}`)?.calories ?? 0), 0);
          return (
            <View key={day} style={[styles.day, highlight && styles.dayToday, removed && styles.dayRemoved]}>
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
                      <View key={slot} style={styles.mealWrap}>
                        <PlanMealCard
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
                          photoHeight={200}
                          onPress={() => onOpenSlot(day, slot)}
                        />
                      </View>
                    );
                  })}
                  {canManage && addable.length > 0 ? (
                    <Pressable onPress={() => onAddSlot(day)} style={styles.addSlot}>
                      <Text style={styles.addSlotLabel}>Add slot</Text>
                    </Pressable>
                  ) : null}
                  {canManage && visible.length > 0 ? (
                    <Pressable onPress={() => onRemoveSlot(day)} style={styles.addSlot}>
                      <Text style={styles.addSlotLabel}>Remove slot</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 32, paddingBottom: 48, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  headerCopy: { flex: 1, minWidth: 0, gap: 4 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 40, fontWeight: '700' },
  days: { gap: 28, width: '100%' },
  day: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dayToday: { borderColor: colors.accent },
  dayRemoved: { opacity: 0.72 },
  meals: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, padding: space.md, paddingTop: 4 },
  mealWrap: { flexGrow: 1, flexBasis: 240, minWidth: 220, maxWidth: 420 },
  addSlot: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 160,
    minHeight: 200,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  addSlotLabel: { color: colors.accent, fontSize: 14, fontWeight: '700' },
});
