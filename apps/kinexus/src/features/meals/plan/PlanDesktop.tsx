import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DAYS, DAY_LABELS, mondayWeekStart, recipeForHouseholdView, slotHasMeal, type Day, type MealSlotKey } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { Chip, OfflineBanner } from '@/src/features/meals/meals-kit';
import {
  audienceLabel,
  planBoardCells,
  planDayMealViews,
  DayStrip,
  PlanActionTile,
  PlanMealCard,
  planMealCardMeta,
  WeekSwitcher,
  WhoPicksMenu,
  type PlanCellView,
  type PlanPersonFilter,
} from '@/src/features/meals/plan/PlanShared';
import { recipePhotoUrl } from '@/src/features/meals/RecipePhoto';
import type { PlanSlot, useMealsSync } from '@/src/features/meals/use-meals-sync';
import { isoDayNumber, todayDay, weekDayIso } from '@/src/features/meals/week-labels';
import { colors } from '@/src/features/shell/theme';

type Meals = ReturnType<typeof useMealsSync>;

export function PlanDesktop({
  meals,
  personNames,
  peopleOptions,
  personFilter,
  onPersonFilter,
  selectedDay,
  onSelectDay,
  showGenerate = true,
  canManage = false,
  onOpenSlot,
  onAllocateMeal,
  onPickMeal,
  onRemoveDay,
  onRestoreDay,
  onClearWeek,
  clearingWeek = false,
  clearError = null,
  onGenerate,
  onShopping,
  onAddSide,
  onAllocate,
  canEditCell,
}: {
  meals: Meals;
  personNames: Map<string, string>;
  peopleOptions: { id: string; name: string }[];
  personFilter: PlanPersonFilter;
  onPersonFilter: (next: PlanPersonFilter) => void;
  selectedDay: Day;
  onSelectDay: (day: Day) => void;
  showGenerate?: boolean;
  canManage?: boolean;
  onOpenSlot: (day: Day, slot: MealSlotKey, cell?: PlanSlot) => void;
  onAllocateMeal: () => void;
  onPickMeal: () => void;
  onRemoveDay: (day: Day) => void;
  onRestoreDay: (day: Day) => void;
  onClearWeek: () => void;
  clearingWeek?: boolean;
  clearError?: string | null;
  onGenerate: () => void;
  onShopping: () => void;
  onAddSide: (cell: PlanSlot) => void;
  onAllocate: (cell: PlanSlot, personId: string | null) => void;
  canEditCell: (cell: PlanSlot) => boolean;
}) {
  const thisWeek = meals.weekStart === mondayWeekStart();
  const today = todayDay();
  const dateNums = new Map(DAYS.map((day) => [day, isoDayNumber(weekDayIso(meals.weekStart, day))] as const));
  const { cells, removed, filled, kcal } = planDayMealViews(
    meals.activeSlots,
    meals.slotMap,
    meals.slots,
    selectedDay,
    personFilter,
  );
  const applied = planBoardCells(cells);
  const dayLabel = thisWeek && selectedDay === today ? 'Today' : DAY_LABELS[selectedDay];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>{thisWeek ? 'This week' : 'Meal plan'}</Text>
          <Text style={styles.title}>Plan</Text>
        </View>
        <View style={styles.headerActions}>
          {canManage ? <Btn label="Clear week" variant="danger" onPress={onClearWeek} busy={clearingWeek} /> : null}
          {showGenerate ? <Btn label="Generate" onPress={onGenerate} /> : null}
          <Btn label="Shopping" variant="secondary" onPress={onShopping} />
        </View>
      </View>
      <WeekSwitcher
        weekStart={meals.weekStart}
        onPrev={() => meals.shiftWeek(-1)}
        onNext={() => meals.shiftWeek(1)}
      />
      <DayStrip
        days={DAYS}
        selected={selectedDay}
        today={thisWeek ? today : null}
        dateNums={dateNums}
        onSelect={onSelectDay}
      />
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Show</Text>
        <Chip label="Everyone" active={personFilter === 'all'} onPress={() => onPersonFilter('all')} />
        {peopleOptions.map((person) => (
          <Chip
            key={person.id}
            label={person.name}
            active={personFilter === person.id}
            onPress={() => onPersonFilter(person.id)}
          />
        ))}
      </View>
      <OfflineBanner online={meals.online} pendingCount={meals.pendingCount} extra={meals.importBlockedReason} />
      <ErrorText message={clearError ?? meals.error} />
      <View style={styles.dayMeta}>
        <View style={styles.dayMetaCopy}>
          <Text style={styles.dayTitle}>{dayLabel}</Text>
          <Text style={styles.daySubtitle}>
            {removed
              ? "Not on this week's plan"
              : `${filled} meal${filled === 1 ? '' : 's'}${kcal ? ` · ${Math.round(kcal).toLocaleString()} kcal` : ''}`}
          </Text>
        </View>
        {canManage ? (
          removed ? (
            <Pressable onPress={() => onRestoreDay(selectedDay)} hitSlop={6}>
              <Text style={styles.dayAction}>Restore</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => onRemoveDay(selectedDay)} hitSlop={6}>
              <Text style={styles.dayActionMuted}>Remove day</Text>
            </Pressable>
          )
        ) : null}
      </View>
      {!removed || canManage ? (
        <View style={styles.grid}>
          {applied.map((view) => (
            <View key={view.key} style={styles.tile}>
              <MealCardFromView
                view={view}
                meals={meals}
                personNames={personNames}
                photoHeight={160}
                onPress={() => onOpenSlot(selectedDay, view.slotKey, view.cell)}
                onAddSide={onAddSide}
                onAllocate={onAllocate}
                canManage={canManage}
                people={peopleOptions}
                canEditCell={canEditCell}
              />
            </View>
          ))}
          {canManage ? (
            <View style={styles.tile}>
              <PlanActionTile onAllocate={onAllocateMeal} onPick={onPickMeal} />
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function MealCardFromView({
  view,
  meals,
  personNames,
  photoHeight,
  onPress,
  onAddSide,
  onAllocate,
  canManage,
  people,
  canEditCell,
}: {
  view: PlanCellView;
  meals: Meals;
  personNames: Map<string, string>;
  photoHeight: number;
  onPress: () => void;
  onAddSide: (cell: PlanSlot) => void;
  onAllocate: (cell: PlanSlot, personId: string | null) => void;
  canManage: boolean;
  people: { id: string; name: string }[];
  canEditCell: (cell: PlanSlot) => boolean;
}) {
  const cell = view.cell;
  const hasMeal = slotHasMeal(cell);
  const hasRecipe = Boolean(cell?.recipeId);
  const assignee = cell?.assignedPersonId ? personNames.get(cell.assignedPersonId) : null;
  const who = audienceLabel(cell?.audiencePersonIds, personNames);
  const recipe = recipeForHouseholdView(meals.recipes, cell?.recipeId);
  const sides = (cell?.sideRecipeIds ?? []).flatMap((id) => {
    const recipe = recipeForHouseholdView(meals.recipes, id);
    return recipe ? [{ id: recipe.id, name: recipe.name }] : [];
  });
  return (
    <PlanMealCard
      slot={view.slotKey}
      slotLabel={view.household ? undefined : `${slotTitleCase(view.slotKey)} · ${who}`}
      filled={hasRecipe}
      photoUrl={recipePhotoUrl(meals.recipes, cell?.recipeId)}
      emoji={cell?.emoji}
      blank={!hasRecipe}
      title={hasMeal ? (cell?.recipeName ?? 'Meal') : ''}
      meta={
        hasMeal
          ? planMealCardMeta({
              assignee: !canManage && assignee ? assignee : null,
              calories: cell?.calories,
              servings: cell?.targetServings,
              recipe,
            })
          : !canManage
            ? assignee
              ? `${assignee} picks`
              : 'Anyone can pick'
            : ''
      }
      photoHeight={photoHeight}
      onPress={onPress}
      onAddSide={cell && cell.id && hasRecipe && canEditCell(cell) ? () => onAddSide(cell) : undefined}
      sides={sides}
      footer={
        canManage && cell && !hasMeal ? (
          <WhoPicksMenu
            people={people}
            assignedPersonId={cell.assignedPersonId}
            onAllocate={(personId) => onAllocate(cell, personId)}
          />
        ) : undefined
      }
    />
  );
}

function slotTitleCase(slot: MealSlotKey): string {
  return slot.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 32, paddingBottom: 48, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  headerCopy: { flex: 1, minWidth: 0, gap: 4 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 40, fontWeight: '700' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  filterLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginRight: 4,
  },
  dayMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayMetaCopy: { flex: 1, minWidth: 0, gap: 2 },
  dayTitle: { color: colors.text, fontSize: 24, fontWeight: '700' },
  daySubtitle: { color: colors.textMuted, fontSize: 14 },
  dayAction: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  dayActionMuted: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  tile: { flexGrow: 1, flexBasis: 220, minWidth: 200, maxWidth: 320 },
});
