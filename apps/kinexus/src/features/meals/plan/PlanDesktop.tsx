import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DAYS, DAY_LABELS, MEAL_SLOTS, mondayWeekStart, type Day, type MealSlotKey } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { OfflineBanner } from '@/src/features/meals/meals-kit';
import { RecipePhoto, recipePhotoUrl } from '@/src/features/meals/RecipePhoto';
import type { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { isoDayNumber, todayDay, weekDayIso, weekHeading } from '@/src/features/meals/week-labels';
import { colors, radius } from '@/src/features/shell/theme';

type Meals = ReturnType<typeof useMealsSync>;

export function PlanDesktop({
  meals,
  onOpenSlot,
  onGenerate,
  onShopping,
}: {
  meals: Meals;
  onOpenSlot: (day: Day, slot: MealSlotKey) => void;
  onGenerate: () => void;
  onShopping: () => void;
}) {
  const thisWeek = meals.weekStart === mondayWeekStart();
  const today = todayDay();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>This week</Text>
      <Text style={styles.title}>Plan</Text>
      <View style={styles.toolbar}>
        <Btn label="Prev" variant="secondary" onPress={() => meals.shiftWeek(-1)} />
        <Text style={styles.week}>{weekHeading(meals.weekStart)}</Text>
        <Btn label="Next" variant="secondary" onPress={() => meals.shiftWeek(1)} />
        <Btn label="Generate" onPress={onGenerate} />
        <Btn label="Shopping" variant="secondary" onPress={onShopping} />
      </View>
      <OfflineBanner online={meals.online} pendingCount={meals.pendingCount} extra={meals.importBlockedReason} />
      <ErrorText message={meals.error} />
      <ScrollView horizontal style={styles.gridWrap} contentContainerStyle={styles.grid}>
        <View style={styles.slotCol}>
          <View style={styles.dayHead} />
          {meals.activeSlots.map((slot) => (
            <Text key={slot} style={styles.slotLabel}>
              {MEAL_SLOTS.find((s) => s.key === slot)?.label ?? slot}
            </Text>
          ))}
        </View>
        {DAYS.map((day) => {
          const iso = weekDayIso(meals.weekStart, day);
          const highlight = thisWeek && day === today;
          const kcal = meals.activeSlots.reduce((sum, slot) => {
            const cell = meals.slotMap.get(`${day}_${slot}`);
            return sum + (cell?.hidden ? 0 : (cell?.calories ?? 0));
          }, 0);
          return (
            <View key={day} style={[styles.dayCol, highlight && styles.dayToday]}>
              <View style={styles.dayHead}>
                <Text style={styles.dayName}>{DAY_LABELS[day]}</Text>
                <Text style={styles.dayNum}>{isoDayNumber(iso)}</Text>
                {kcal > 0 ? <Text style={styles.kcal}>{Math.round(kcal)} kcal</Text> : null}
              </View>
              {meals.activeSlots.map((slot) => {
                const cell = meals.slotMap.get(`${day}_${slot}`);
                if (cell?.hidden) {
                  return (
                    <Pressable key={slot} onPress={() => void meals.hideSlot(day, slot, false)} style={styles.hiddenCell}>
                      <Text style={styles.hiddenLabel}>Hidden · show</Text>
                    </Pressable>
                  );
                }
                const filled = Boolean(cell?.recipeId);
                return (
                  <Pressable
                    key={slot}
                    onPress={() => onOpenSlot(day, slot)}
                    style={[styles.cell, filled && styles.cellFilled]}>
                    {filled ? (
                      <View style={styles.cellPhoto}>
                        <RecipePhoto
                          uri={recipePhotoUrl(meals.recipes, cell?.recipeId)}
                          emoji={cell?.emoji}
                          size="fill"
                          radius={0}
                        />
                      </View>
                    ) : (
                      <Text style={styles.cellEmoji}>＋</Text>
                    )}
                    <Text numberOfLines={2} style={styles.cellName}>
                      {cell?.recipeName ?? 'Add'}
                    </Text>
                    {cell?.calories ? <Text style={styles.cellKcal}>{cell.calories} kcal</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 48, paddingBottom: 48, gap: 14 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 40, fontWeight: '700' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  week: { color: colors.text, fontWeight: '700', minWidth: 200, flexGrow: 1 },
  gridWrap: { marginHorizontal: -8 },
  grid: { flexDirection: 'row', gap: 8, paddingRight: 16, alignItems: 'flex-start' },
  slotCol: { width: 100, gap: 8 },
  slotLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    height: 132,
    paddingTop: 56,
  },
  dayCol: {
    width: 148,
    gap: 8,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayToday: { borderColor: colors.accent },
  dayHead: { minHeight: 64, gap: 2, paddingBottom: 4 },
  dayName: { color: colors.text, fontWeight: '700' },
  dayNum: { color: colors.textMuted, fontSize: 12 },
  kcal: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  cell: {
    minHeight: 132,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingBottom: 8,
    gap: 4,
  },
  cellFilled: { borderColor: colors.accent },
  cellPhoto: { height: 72, width: '100%' },
  cellEmoji: { fontSize: 18, paddingHorizontal: 8, paddingTop: 8 },
  cellName: { color: colors.text, fontSize: 13, fontWeight: '600', paddingHorizontal: 8 },
  cellKcal: { color: colors.textDim, fontSize: 11, paddingHorizontal: 8 },
  hiddenCell: {
    minHeight: 100,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenLabel: { color: colors.textDim, fontSize: 12 },
});
