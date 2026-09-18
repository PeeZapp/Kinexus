import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  addableMealSlotKeys,
  DAY_LABELS,
  dayIsRemovedFromPlan,
  hiddenMealSlotKeysForDay,
  MEAL_SLOTS,
  visibleMealSlotKeys,
  type Day,
  type MealSlotKey,
} from '@kinexus/domain';

import { Sheet } from '@/src/features/meals/meals-kit';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { weekRangeLabel } from '@/src/features/meals/week-labels';
import { colors, radius, space } from '@/src/features/shell/theme';

export function slotTitle(slot: MealSlotKey): string {
  return MEAL_SLOTS.find((s) => s.key === slot)?.label ?? slot;
}

export function dayPlanSlots(
  activeSlots: readonly MealSlotKey[],
  slotMap: ReadonlyMap<string, { hidden?: boolean }>,
  day: Day,
): { visible: MealSlotKey[]; addable: MealSlotKey[]; removed: boolean } {
  const hiddenOnDay = hiddenMealSlotKeysForDay(slotMap, day);
  const visible = visibleMealSlotKeys(activeSlots, hiddenOnDay);
  return {
    visible,
    addable: addableMealSlotKeys(visible),
    removed: dayIsRemovedFromPlan(activeSlots, slotMap, day),
  };
}

export function WeekSwitcher({
  weekStart,
  onPrev,
  onNext,
}: {
  weekStart: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.weekBar}>
      <Pressable onPress={onPrev} style={styles.weekBtn} hitSlop={8}>
        <Text style={styles.weekBtnText}>‹</Text>
      </Pressable>
      <Text style={styles.weekLabel}>{weekRangeLabel(weekStart)}</Text>
      <Pressable onPress={onNext} style={styles.weekBtn} hitSlop={8}>
        <Text style={styles.weekBtnText}>›</Text>
      </Pressable>
    </View>
  );
}

export function DayPlanHeader({
  day,
  dateNum,
  highlight,
  expanded,
  removed,
  meta,
  canManage,
  onToggle,
  onRemove,
  onRestore,
}: {
  day: Day;
  dateNum: string;
  highlight: boolean;
  expanded: boolean;
  removed: boolean;
  meta: string;
  canManage: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onRestore: () => void;
}) {
  const name = highlight ? 'Today' : DAY_LABELS[day];
  return (
    <View style={styles.dayHead}>
      <Pressable
        onPress={removed ? undefined : onToggle}
        disabled={removed}
        style={styles.dayHeadHit}
        accessibilityRole="button"
        accessibilityState={{ expanded: removed ? undefined : expanded }}>
        <View style={[styles.dateBadge, highlight && styles.dateBadgeToday]}>
          <Text style={[styles.dateDow, highlight && styles.dateTodayText]}>{DAY_LABELS[day].slice(0, 3)}</Text>
          <Text style={[styles.dateNum, highlight && styles.dateTodayText]}>{dateNum}</Text>
        </View>
        <View style={styles.dayCopy}>
          <Text style={[styles.dayName, highlight && styles.dayNameToday]}>{name}</Text>
          <Text style={styles.dayMeta}>{removed ? "Not on this week's plan" : meta}</Text>
        </View>
        {removed ? null : <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>}
      </Pressable>
      {canManage ? (
        removed ? (
          <Pressable onPress={onRestore} style={styles.dayAction} hitSlop={6}>
            <Text style={styles.dayActionLabel}>Restore</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onRemove} style={styles.dayAction} hitSlop={6}>
            <Text style={styles.dayActionMuted}>Remove day</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

export function PlanMealCard({
  slot,
  filled,
  photoUrl,
  emoji,
  title,
  meta,
  photoHeight,
  onPress,
}: {
  slot: MealSlotKey;
  filled: boolean;
  photoUrl?: string;
  emoji?: string | null;
  title: string;
  meta: string;
  photoHeight: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.meal, !filled && styles.mealEmpty]}>
      <View style={[styles.mealPhoto, { height: photoHeight }]}>
        <RecipePhoto uri={filled ? photoUrl : undefined} emoji={filled ? emoji : '＋'} size="fill" radius={0} />
      </View>
      <View style={styles.mealBody}>
        <Text style={[styles.slotLabel, !filled && styles.slotEmpty]}>{slotTitle(slot)}</Text>
        <Text style={styles.mealName}>{title}</Text>
        <Text style={styles.mealMeta}>{meta || ' '}</Text>
      </View>
    </Pressable>
  );
}

export function DaySlotSheet({
  day,
  action,
  options,
  onClose,
  onPick,
}: {
  day: Day | null;
  action: 'add' | 'remove';
  options: readonly MealSlotKey[];
  onClose: () => void;
  onPick: (slot: MealSlotKey) => void;
}) {
  if (!day) return null;
  const adding = action === 'add';
  const title = adding ? 'Add slot' : 'Remove slot';
  return (
    <Sheet visible title={`${title} · ${DAY_LABELS[day]}`} onClose={onClose}>
      <Text style={styles.addHint}>
        {adding
          ? 'Add lunch, a snack, or dessert to this day so you can plan it by hand.'
          : 'Take a meal slot off this day. You can add it back later.'}
      </Text>
      <View style={styles.addList}>
        {options.map((slot) => (
          <Pressable key={slot} onPress={() => onPick(slot)} style={styles.addOption}>
            <Text style={styles.addOptionLabel}>{slotTitle(slot)}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    alignSelf: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  weekBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgHover,
  },
  weekBtnText: { color: colors.text, fontSize: 22, fontWeight: '600', marginTop: -2 },
  weekLabel: { color: colors.text, fontWeight: '700', fontSize: 14, minWidth: 168, textAlign: 'center' },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: space.sm },
  dayHeadHit: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadgeToday: { backgroundColor: colors.accent },
  dateDow: { color: colors.textDim, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  dateNum: { color: colors.text, fontSize: 18, fontWeight: '800' },
  dateTodayText: { color: colors.bg },
  dayCopy: { flex: 1, minWidth: 0 },
  dayName: { color: colors.text, fontSize: 18, fontWeight: '700' },
  dayNameToday: { color: colors.accent },
  dayMeta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  chevron: { color: colors.textDim, fontSize: 18, paddingHorizontal: 4 },
  dayAction: { paddingVertical: 8, paddingHorizontal: 8 },
  dayActionLabel: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  dayActionMuted: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  meal: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  mealEmpty: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  mealPhoto: { width: '100%' },
  mealBody: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 4 },
  slotLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  slotEmpty: { color: colors.accent },
  mealName: { color: colors.text, fontSize: 17, fontWeight: '700', lineHeight: 22 },
  mealMeta: { color: colors.textDim, fontSize: 13, minHeight: 18 },
  addHint: { color: colors.textMuted, marginBottom: 12, lineHeight: 20 },
  addList: { gap: 8 },
  addOption: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  addOptionLabel: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
