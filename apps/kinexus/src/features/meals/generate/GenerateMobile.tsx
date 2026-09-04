import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DAYS, DAY_LABELS, MEAL_SLOTS, type Day } from '@kinexus/domain';

import { Btn, Card, ErrorText } from '@/src/features/household/ui';
import { Chip } from '@/src/features/meals/meals-kit';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { GoalsEditor, SlotPicker } from '@/src/features/meals/generate/controls';
import type { GenerateViewProps } from '@/src/features/meals/generate/GenerateDesktop';
import { weekHeading } from '@/src/features/meals/week-labels';
import { EmptyState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';

export function GenerateMobile(props: GenerateViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>{weekHeading(props.weekStart)}</Text>
      <Text style={styles.title}>Generate</Text>
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
        label={`Fill ${props.selected.size * 7} slots`}
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
          <Btn label="Apply to this week" onPress={props.onApply} busy={props.applying} />
          {DAYS.map((day) => (
            <View key={day} style={styles.day}>
              <Text style={styles.dayName}>{DAY_LABELS[day]}</Text>
              {props.preview
                ?.filter((row) => row.day === day)
                .map((row) => (
                  <Pressable key={row.slot} onPress={() => props.onSwap(row.day, row.slot)} style={styles.row}>
                    <RecipePhoto uri={row.recipe.imageUrl} emoji={row.recipe.emoji} size={52} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.slotKey}>{MEAL_SLOTS.find((s) => s.key === row.slot)?.label}</Text>
                      <Text style={styles.recipe}>{row.recipe.name}</Text>
                    </View>
                    <Text style={styles.swap}>Swap</Text>
                  </Pressable>
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
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
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
  },
  slotKey: { color: colors.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  recipe: { color: colors.text, fontWeight: '700' },
  swap: { color: colors.accent, fontWeight: '700' },
});
