import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DAYS, DAY_LABELS, MEAL_SLOTS, type Day, type GeneratedSlot, type MealSlotKey, type NutritionGoals } from '@kinexus/domain';

import { Btn, Card, ErrorText } from '@/src/features/household/ui';
import { Chip } from '@/src/features/meals/meals-kit';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { GoalsEditor, SlotPicker } from '@/src/features/meals/generate/controls';
import { weekHeading } from '@/src/features/meals/week-labels';
import { EmptyState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';

export type GenerateViewProps = {
  weekStart: string;
  selected: Set<MealSlotKey>;
  onToggleSlot: (slot: MealSlotKey) => void;
  goals: NutritionGoals;
  onChangeGoals: (next: NutritionGoals) => void;
  dietarySummary: string;
  recipeCount: number;
  onGenerate: () => void;
  preview: GeneratedSlot[] | null;
  avgCal: number;
  avgProt: number;
  onSwap: (day: Day, slot: MealSlotKey) => void;
  onApply: () => void;
  applying: boolean;
  error: string | null;
  onOpenRecipe: (id: string) => void;
};

export function GenerateDesktop(props: GenerateViewProps) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>Fill the week</Text>
      <Text style={styles.title}>Generate plan</Text>
      <Text style={styles.lede}>
        {weekHeading(props.weekStart)} · {props.recipeCount} recipes after dietary filters
      </Text>
      <View style={styles.cols}>
        <View style={styles.col}>
          <Card>
            <SlotPicker selected={props.selected} onToggle={props.onToggleSlot} />
          </Card>
          <Card>
            <GoalsEditor goals={props.goals} onChange={props.onChangeGoals} desktop />
          </Card>
          <Card>
            <Text style={styles.label}>Household dietary</Text>
            <Text style={styles.hint}>{props.dietarySummary}</Text>
          </Card>
          <Btn
            label={`Fill ${props.selected.size * 7} slots`}
            onPress={props.onGenerate}
            disabled={props.selected.size === 0}
          />
        </View>
        <View style={styles.colWide}>
          <ErrorText message={props.error} />
          {props.preview ? (
            <>
              <View style={styles.stats}>
                <Chip label={`~${props.avgCal} kcal / day`} active />
                <Chip label={`~${props.avgProt}g protein / day`} active />
              </View>
              <Btn label="Apply to this week" onPress={props.onApply} busy={props.applying} />
              <View style={styles.previewGrid}>
                {DAYS.map((day) => (
                  <View key={day} style={styles.previewDay}>
                    <Text style={styles.dayName}>{DAY_LABELS[day]}</Text>
                    {props.preview
                      ?.filter((row) => row.day === day)
                      .map((row) => (
                        <Pressable
                          key={row.slot}
                          onPress={() => props.onSwap(row.day, row.slot)}
                          style={styles.previewCell}>
                          <View style={styles.previewPhoto}>
                            <RecipePhoto uri={row.recipe.imageUrl} emoji={row.recipe.emoji} size="fill" radius={0} />
                          </View>
                          <View style={styles.previewCopy}>
                            <Text style={styles.slotKey}>{MEAL_SLOTS.find((s) => s.key === row.slot)?.label}</Text>
                            <Text style={styles.recipe} numberOfLines={2}>
                              {row.recipe.name}
                            </Text>
                            <Text style={styles.meta}>
                              {row.recipe.calories ?? '—'} / {row.targetCalories} kcal
                            </Text>
                            <Text style={styles.swap}>Tap to swap</Text>
                          </View>
                        </Pressable>
                      ))}
                  </View>
                ))}
              </View>
            </>
          ) : (
            <EmptyState
              title="No preview yet"
              body="Pick slots, check dietary notes, then fill the week. Swap anything you dislike. Nothing is saved until you apply."
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 48, paddingBottom: 48, gap: 14 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 40, fontWeight: '700' },
  lede: { color: colors.textMuted, fontSize: 15 },
  cols: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  col: { width: 360, gap: 12 },
  colWide: { flex: 1, gap: 12, minWidth: 420 },
  label: { color: colors.text, fontSize: 18, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  previewDay: {
    width: '31%',
    minWidth: 180,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.sm,
    gap: 8,
  },
  dayName: { color: colors.text, fontWeight: '800' },
  previewCell: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  previewPhoto: { height: 88, width: '100%' },
  previewCopy: { padding: 8, gap: 2 },
  slotKey: { color: colors.textDim, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  recipe: { color: colors.text, fontWeight: '700', fontSize: 13 },
  meta: { color: colors.textMuted, fontSize: 11 },
  swap: { color: colors.accent, fontSize: 11, fontWeight: '700' },
});
