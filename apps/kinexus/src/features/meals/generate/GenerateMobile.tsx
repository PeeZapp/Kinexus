import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DAY_LABELS, MEAL_SLOTS } from '@kinexus/domain';

import { Btn, Card, ErrorText } from '@/src/features/household/ui';
import { Chip } from '@/src/features/meals/meals-kit';
import { GoalsEditor, SlotPicker } from '@/src/features/meals/generate/controls';
import type { GenerateViewProps } from '@/src/features/meals/generate/GenerateDesktop';
import { WeekSwitcher } from '@/src/features/meals/plan/PlanShared';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { weekApplyLabel } from '@/src/features/meals/week-labels';
import { EmptyState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';

export function GenerateMobile(props: GenerateViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Generate</Text>
      <WeekSwitcher weekStart={props.weekStart} onPrev={props.onPrevWeek} onNext={props.onNextWeek} />
      <Text style={styles.lede}>{props.recipeCount} recipes after dietary filters</Text>
      <Card>
        <SlotPicker selected={props.selected} onToggle={props.onToggleSlot} />
      </Card>
      <Card>
        <GoalsEditor goals={props.goals} onChange={props.onChangeGoals} desktop={false} />
      </Card>
      <Card>
        <Text style={styles.label}>Household dietary</Text>
        <Text style={styles.hint}>{props.dietarySummary}</Text>
      </Card>
      <Btn
        label={`Fill ${props.fillableCount} slots`}
        onPress={props.onGenerate}
        disabled={props.selected.size === 0}
      />
      <ErrorText message={props.error} />
      {props.preview ? (
        <>
          <View style={styles.stats}>
            <Chip label={`~${props.avgCal} kcal`} active />
            <Chip label={`~${props.avgProt}g protein`} active />
          </View>
          <Btn label={weekApplyLabel(props.weekStart)} onPress={props.onApply} busy={props.applying} />
          {props.planDays.map((day) => (
            <View key={day} style={styles.day}>
              <Text style={styles.dayName}>{DAY_LABELS[day]}</Text>
              {props.preview
                ?.filter((row) => row.day === day)
                .map((row) => (
                  <View key={row.slot} style={styles.row}>
                    <RecipePhoto uri={row.recipe.imageUrl} emoji={row.recipe.emoji} size={52} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.slotKey}>{MEAL_SLOTS.find((s) => s.key === row.slot)?.label}</Text>
                      <Text style={styles.recipe}>{row.recipe.name}</Text>
                      <View style={styles.cellActions}>
                        <Pressable onPress={() => props.onOpenRecipe(row.recipe.id, row.day, row.slot)}>
                          <Text style={styles.swap}>View</Text>
                        </Pressable>
                        <Pressable onPress={() => props.onSwap(row.day, row.slot)}>
                          <Text style={styles.swap}>Swap</Text>
                        </Pressable>
                        <Pressable onPress={() => props.onRandom(row.day, row.slot)}>
                          <Text style={styles.swap}>Random</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
            </View>
          ))}
        </>
      ) : (
        <EmptyState
          title="No preview yet"
          body="Nothing is saved until you apply the preview. Pick slots, generate, swap, then apply."
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  lede: { color: colors.textMuted },
  label: { color: colors.text, fontSize: 16, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  day: { gap: 8 },
  dayName: { color: colors.text, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 56,
    gap: 10,
  },
  slotKey: { color: colors.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  recipe: { color: colors.text, fontWeight: '700' },
  cellActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  swap: { color: colors.accent, fontWeight: '700' },
});
