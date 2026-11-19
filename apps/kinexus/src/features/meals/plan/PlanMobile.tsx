import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DAYS, DAY_LABELS, mondayWeekStart, recipeForHouseholdView, slotHasMeal, type Day, type MealSlotKey } from '@kinexus/domain';

import { OfflineBanner } from '@/src/features/meals/meals-kit';
import {
  audienceLabel,
  planBoardCells,
  planDayMealViews,
  DayStrip,
  PlanActionTile,
  PlanMealCard,
  planMealCardMeta,
  WhoPicksMenu,
  type PlanCellView,
  type PlanPersonFilter,
} from '@/src/features/meals/plan/PlanShared';
import { recipePhotoUrl } from '@/src/features/meals/RecipePhoto';
import type { PlanSlot, useMealsSync } from '@/src/features/meals/use-meals-sync';
import { isoDayNumber, todayDay, weekDayIso } from '@/src/features/meals/week-labels';
import { FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { colors, radius, space } from '@/src/features/shell/theme';

type Meals = ReturnType<typeof useMealsSync>;

export function PlanMobile({
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
  const insets = useSafeAreaInsets();
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
  const { openMenu, toggleMenu, pick } = useFilterMenus();
  const showingLabel =
    personFilter === 'all' ? 'Everyone' : peopleOptions.find((person) => person.id === personFilter)?.name ?? 'Everyone';
  const dayLine = removed
    ? `${dayLabel} · Not on plan`
    : `${dayLabel} · ${filled} meal${filled === 1 ? '' : 's'}${kcal ? ` · ${Math.round(kcal).toLocaleString()} kcal` : ''}`;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <DayStrip
        compact
        days={DAYS}
        selected={selectedDay}
        today={thisWeek ? today : null}
        dateNums={dateNums}
        onSelect={onSelectDay}
      />
      <View style={styles.actionRow}>
        {showGenerate ? (
          <Pressable
            onPress={onGenerate}
            style={({ pressed }) => [styles.actionBtn, styles.actionGen, pressed && styles.hudPressed]}
            accessibilityRole="button"
            accessibilityLabel="Generate plan">
            <Text style={styles.actionGenLabel} numberOfLines={1}>
              Generate
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onShopping}
          style={({ pressed }) => [styles.actionBtn, styles.actionSecondary, pressed && styles.hudPressed]}
          accessibilityRole="button"
          accessibilityLabel="Shopping list">
          <Text style={styles.actionSecondaryLabel} numberOfLines={1}>
            Shopping
          </Text>
        </Pressable>
        {canManage ? (
          <Pressable
            onPress={onClearWeek}
            style={({ pressed }) => [styles.actionBtn, styles.actionDanger, pressed && styles.hudPressed]}
            accessibilityRole="button"
            accessibilityLabel="Clear week"
            disabled={clearingWeek}>
            <Text style={styles.actionDangerLabel} numberOfLines={1}>
              {clearingWeek ? 'Clearing…' : 'Clear week'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <OfflineBanner online={meals.online} pendingCount={meals.pendingCount} extra={meals.importBlockedReason} />
      {clearError || meals.error ? (
        <Text style={styles.compactError} numberOfLines={1}>
          {clearError ?? meals.error}
        </Text>
      ) : null}
      <View style={styles.dayMeta}>
        <View style={styles.dayMetaCopy}>
          <Text style={styles.dayLine} numberOfLines={1}>
            {dayLine}
          </Text>
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
        <FilterDropdown<PlanPersonFilter>
          id="showing"
          label="Showing"
          value={personFilter}
          valueLabel={showingLabel}
          open={openMenu === 'showing'}
          options={[
            { value: 'all', label: 'Everyone' },
            ...peopleOptions.map((person) => ({ value: person.id, label: person.name })),
          ]}
          onToggle={toggleMenu}
          onSelect={pick(onPersonFilter)}
          style={styles.dayMetaDropdown}
        />
      </View>
      {!removed || canManage ? (
        <View style={styles.stack}>
          {applied.map((view) => (
            <MealCardFromView
              key={view.key}
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
          ))}
          {canManage ? (
            <PlanActionTile onAllocate={onAllocateMeal} onPick={onPickMeal} />
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
  const syncFailure = meals.slotSyncFailures.find(
    (row) =>
      (cell?.id && row.slotId === cell.id) ||
      (row.day === cell?.day && row.slotKey === view.slotKey && !row.slotId),
  );
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
      syncError={Boolean(syncFailure)}
      onRetrySync={() => {
        void meals.retrySlotSync();
      }}
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
  content: { paddingHorizontal: space.md, paddingTop: 4, gap: 8 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    minHeight: 44,
  },
  actionBtn: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '30%',
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionGen: {
    backgroundColor: colors.accent,
  },
  actionGenLabel: { color: colors.bg, fontSize: 13, fontWeight: '700' },
  actionSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  actionSecondaryLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  actionDanger: {
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.bgHover,
  },
  actionDangerLabel: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  hudPressed: { opacity: 0.78 },
  compactError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  dayMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 30,
  },
  dayMetaCopy: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: 4,
  },
  dayMetaDropdown: {
    flexGrow: 0,
    flexShrink: 1,
    maxWidth: '48%',
    minWidth: 132,
    zIndex: 30,
  },
  dayLine: { color: colors.text, fontSize: 13, fontWeight: '700' },
  dayAction: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  dayActionMuted: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  stack: { gap: 12 },
});
