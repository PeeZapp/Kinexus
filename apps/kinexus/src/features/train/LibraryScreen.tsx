import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { exerciseSearchScore } from '@kinexus/domain';

import { Sheet } from '@/src/features/meals/meals-kit';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { exerciseFacts, exerciseTitle } from '@/src/features/train/format';
import { loadLibrary, type LibraryExercise } from '@/src/features/train/api';
import { ExerciseSteps, MediaGallery, Pill, SearchField, TrainPage } from '@/src/features/train/ui';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';

const PARTS = [
  ['all', 'All'],
  ['chest', 'Chest'],
  ['back', 'Back'],
  ['legs', 'Legs'],
  ['shoulders', 'Shoulders'],
  ['biceps', 'Biceps'],
  ['triceps', 'Triceps'],
  ['core', 'Core'],
  ['forearms', 'Forearms'],
  ['cardio', 'Cardio'],
  ['neck', 'Neck'],
] as const;

export function LibraryScreen() {
  const [rows, setRows] = useState<LibraryExercise[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [part, setPart] = useState<(typeof PARTS)[number][0]>('all');
  const [selected, setSelected] = useState<LibraryExercise | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { openMenu, toggleMenu, pick } = useFilterMenus();
  const partLabel = PARTS.find(([id]) => id === part)?.[1] ?? 'All';

  useEffect(() => {
    loadLibrary()
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load exercises'))
      .finally(() => setReady(true));
  }, []);

  const visible = useMemo(() => {
    const ranked: { row: LibraryExercise; score: number }[] = [];
    for (const row of rows) {
      if (part !== 'all' && row.bodyPart !== part) continue;
      const score = exerciseSearchScore(query, `${row.name} ${row.equipment} ${row.targetMuscle} ${row.bodyPart}`);
      if (score === null) continue;
      ranked.push({ row, score });
    }
    ranked.sort((a, b) => a.score - b.score);
    return ranked.map((item) => item.row);
  }, [part, query, rows]);

  const facts = selected ? exerciseFacts(selected) : [];
  const credit = selected ? creditFor(selected) : '';

  return (
    <TrainPage>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search exercises" />
      <View style={styles.filters}>
        <FilterBar>
          <FilterDropdown
            id="part"
            label="Body"
            value={part}
            valueLabel={partLabel}
            open={openMenu === 'part'}
            options={PARTS.map(([value, label]) => ({ value, label }))}
            active={part !== 'all'}
            onToggle={toggleMenu}
            onSelect={pick(setPart)}
          />
        </FilterBar>
        {ready ? <Text style={styles.count}>{visible.length.toLocaleString()}</Text> : null}
      </View>
      <ErrorBanner message={error} />
      {!ready && !error ? (
        <LoadingState label="Loading exercises" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(row) => row.id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>No exercises</Text>}
          renderItem={({ item }) => {
            const meta = exerciseFacts(item).join(' · ');
            return (
              <Pressable
                onPress={() => setSelected(item)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <Text style={styles.name}>{exerciseTitle(item.name)}</Text>
                {meta ? <Text style={styles.meta}>{meta}</Text> : null}
              </Pressable>
            );
          }}
        />
      )}
      <Sheet visible={selected !== null} title={selected ? exerciseTitle(selected.name) : ''} wide onClose={() => setSelected(null)}>
        {selected ? (
          <View style={styles.detail}>
            {selected.mediaUrls.length > 0 ? <MediaGallery urls={selected.mediaUrls} /> : null}
            {facts.length > 0 ? (
              <View style={styles.pills}>
                {facts.map((fact) => (
                  <Pill key={fact} label={fact} />
                ))}
              </View>
            ) : null}
            <ExerciseSteps instructions={selected.instructions} />
            {credit ? <Text style={styles.credit}>{credit}</Text> : null}
          </View>
        ) : null}
      </Sheet>
    </TrainPage>
  );
}

function creditFor(exercise: LibraryExercise): string {
  if (exercise.source === 'exercisedb') return 'AscendAPI';
  if (exercise.source === 'wger') return `CC BY-SA${exercise.licenseAuthor ? ` · ${exercise.licenseAuthor}` : ''}`;
  return '';
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, zIndex: 20 },
  count: { color: colors.textDim, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  list: { flex: 1 },
  listContent: { gap: 8, paddingBottom: space.lg },
  row: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  pressed: { backgroundColor: colors.bgHover },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  empty: { color: colors.textMuted, fontSize: 15, paddingVertical: space.lg },
  detail: { gap: space.md, paddingTop: 4, paddingBottom: space.lg },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  credit: { color: colors.textDim, fontSize: 12 },
});
