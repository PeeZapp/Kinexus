import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DAYS, DAY_LABELS, MEAL_SLOTS, mondayWeekStart, type Day, type MealSlotKey } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { OfflineBanner } from '@/src/features/meals/meals-kit';
import { RecipePhoto, recipePhotoUrl } from '@/src/features/meals/RecipePhoto';
import type { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { isoDayNumber, todayDay, weekDayIso, weekHeading } from '@/src/features/meals/week-labels';
import { colors, radius, space } from '@/src/features/shell/theme';

type Meals = ReturnType<typeof useMealsSync>;

export function PlanMobile({
  meals,
  expandedDay,
  setExpandedDay,
  onOpenSlot,
  onGenerate,
  onShopping,
}: {
  meals: Meals;
  expandedDay: Day | null;
  setExpandedDay: (day: Day | null) => void;
  onOpenSlot: (day: Day, slot: MealSlotKey) => void;
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
      <View style={styles.weekRow}>
        <Btn label="Prev" variant="secondary" onPress={() => meals.shiftWeek(-1)} />
        <Text style={styles.week}>{weekHeading(meals.weekStart)}</Text>
        <Btn label="Next" variant="secondary" onPress={() => meals.shiftWeek(1)} />
      </View>
      <View style={styles.actions}>
        <Btn label="Generate plan" onPress={onGenerate} />
        <Btn label="Shopping list" variant="secondary" onPress={onShopping} />
      </View>
      <OfflineBanner online={meals.online} pendingCount={meals.pendingCount} extra={meals.importBlockedReason} />
      <ErrorText message={meals.error} />
      {DAYS.map((day) => {
        const iso = weekDayIso(meals.weekStart, day);
        const open = expandedDay === day;
        const highlight = thisWeek && day === today;
        const visibleSlots = meals.activeSlots.filter((slot) => !meals.slotMap.get(`${day}_${slot}`)?.hidden);
        const filled = visibleSlots.filter((slot) => meals.slotMap.get(`${day}_${slot}`)?.recipeId).length;
        const kcal = visibleSlots.reduce((sum, slot) => sum + (meals.slotMap.get(`${day}_${slot}`)?.calories ?? 0), 0);
        const hiddenSlots = meals.activeSlots.filter((slot) => meals.slotMap.get(`${day}_${slot}`)?.hidden);
        return (
          <View key={day} style={[styles.dayCard, highlight && styles.dayToday]}>
            <Pressable onPress={() => setExpandedDay(open ? null : day)} style={styles.dayHead}>
              <View style={[styles.dateBadge, highlight && styles.dateBadgeToday]}>
                <Text style={[styles.dateDow, highlight && styles.dateTodayText]}>{DAY_LABELS[day].slice(0, 3)}</Text>
                <Text style={[styles.dateNum, highlight && styles.dateTodayText]}>{isoDayNumber(iso)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dayName}>{DAY_LABELS[day]}</Text>
                <Text style={styles.dayMeta}>
                  {filled} / {visibleSlots.length} meals
                  {kcal ? ` · ${Math.round(kcal)} kcal` : ''}
                </Text>
              </View>
              <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
            </Pressable>
            {open ? (
              <View style={styles.slots}>
                {visibleSlots.map((slot) => {
                  const cell = meals.slotMap.get(`${day}_${slot}`);
                  return (
                    <Pressable key={slot} onPress={() => onOpenSlot(day, slot)} style={styles.slotRow}>
                      <RecipePhoto
                        uri={recipePhotoUrl(meals.recipes, cell?.recipeId)}
                        emoji={cell?.emoji}
                        size={48}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.slotKey}>{MEAL_SLOTS.find((s) => s.key === slot)?.label ?? slot}</Text>
                        <Text style={styles.slotName}>{cell?.recipeName ?? 'Tap to add'}</Text>
                      </View>
                      {cell?.calories ? <Text style={styles.slotKcal}>{cell.calories}</Text> : null}
                    </Pressable>
                  );
                })}
                {hiddenSlots.map((slot) => (
                  <Pressable key={slot} onPress={() => void meals.hideSlot(day, slot, false)} style={styles.hiddenRow}>
                    <Text style={styles.hiddenLabel}>
                      Show {MEAL_SLOTS.find((s) => s.key === slot)?.label ?? slot}
                    </Text>
                  </Pressable>
                ))}
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
  content: { paddingHorizontal: space.md, paddingTop: space.sm, gap: 12 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  week: { color: colors.text, fontWeight: '700', flex: 1, textAlign: 'center', fontSize: 13 },
  actions: { gap: 8 },
  dayCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  dayToday: { borderColor: colors.accent },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: space.sm },
  dateBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadgeToday: { backgroundColor: colors.accent },
  dateDow: { color: colors.textDim, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  dateNum: { color: colors.text, fontSize: 16, fontWeight: '800' },
  dateTodayText: { color: colors.bg },
  dayName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  dayMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  chevron: { color: colors.textDim, fontSize: 16 },
  slots: { borderTopWidth: 1, borderTopColor: colors.border, padding: space.sm, gap: 8 },
  slotRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    gap: 8,
  },
  slotKey: { color: colors.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  slotName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  slotKcal: { color: colors.textMuted, fontSize: 12 },
  hiddenRow: { paddingVertical: 8, paddingHorizontal: 4 },
  hiddenLabel: { color: colors.accent, fontWeight: '700', fontSize: 13 },
});
