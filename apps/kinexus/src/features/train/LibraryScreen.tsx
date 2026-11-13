import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  EXERCISE_SOURCE_BADGE_LABEL,
  EXERCISE_SOURCE_BADGES,
  exerciseSearchScore,
  type ExerciseSourceBadge,
} from '@kinexus/domain';

import { Sheet } from '@/src/features/meals/meals-kit';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { PublicName } from '@/src/features/shell/PublicName';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { useStaffAccess } from '@/src/features/staff/use-staff';
import { loadLibrary, type LibraryExercise } from '@/src/features/train/api';
import { CustomExerciseForm } from '@/src/features/train/CustomExerciseForm';
import { ExerciseGroupsSheet } from '@/src/features/train/ExerciseGroupsSheet';
import { loadExerciseGroups, type ExerciseGroup } from '@/src/features/train/custom-exercises-api';
import { exerciseFacts, exerciseTitle } from '@/src/features/train/format';
import {
  ExerciseSteps,
  MediaGallery,
  Pill,
  SearchField,
  Segmented,
  TextAction,
  TrainButton,
  TrainPage,
} from '@/src/features/train/ui';

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

type Pane = 'catalog' | 'creators';

export function LibraryScreen() {
  const [pane, setPane] = useState<Pane>('catalog');

  return (
    <TrainPage>
      <Segmented
        value={pane}
        options={[
          { value: 'catalog', label: 'Catalog' },
          { value: 'creators', label: 'Creators' },
        ]}
        onChange={setPane}
      />
      <ExerciseLibraryPane creatorsOnly={pane === 'creators'} />
    </TrainPage>
  );
}

function ExerciseLibraryPane({ creatorsOnly }: { creatorsOnly: boolean }) {
  const { user } = useAuth();
  const { activeHousehold, role, canManageHousehold } = useHousehold();
  const staff = useStaffAccess();
  const isStaff = staff.isStaff;
  const userId = user && !user.isDevBypass ? user.id : null;
  const [rows, setRows] = useState<LibraryExercise[]>([]);
  const [groups, setGroups] = useState<ExerciseGroup[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [part, setPart] = useState<(typeof PARTS)[number][0]>('all');
  const [source, setSource] = useState<ExerciseSourceBadge | 'all'>('all');
  const [selected, setSelected] = useState<LibraryExercise | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryExercise | null>(null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openMenu, toggleMenu, pick } = useFilterMenus();
  const partLabel = PARTS.find(([id]) => id === part)?.[1] ?? 'All';
  const effectiveSource: ExerciseSourceBadge | 'all' = creatorsOnly ? 'creator' : source;
  const sourceLabel =
    effectiveSource === 'all' ? 'All' : EXERCISE_SOURCE_BADGE_LABEL[effectiveSource];

  const refresh = useCallback(async () => {
    const next = await loadLibrary();
    setRows(next);
    if (userId) {
      const nextGroups = await loadExerciseGroups(userId);
      setGroups(nextGroups);
    }
  }, [userId]);

  useEffect(() => {
    refresh()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load exercises'))
      .finally(() => setReady(true));
  }, [refresh]);

  const visible = useMemo(() => {
    const ranked: { row: LibraryExercise; score: number }[] = [];
    for (const row of rows) {
      if (row.status === 'hidden' || row.mergedInto) continue;
      if (part !== 'all' && row.bodyPart !== part) continue;
      if (effectiveSource !== 'all' && row.sourceBadge !== effectiveSource) continue;
      const aliasText = row.aliases?.length ? ` ${row.aliases.join(' ')}` : '';
      const score = exerciseSearchScore(
        query,
        `${row.name} ${row.equipment} ${row.targetMuscle} ${row.bodyPart}${aliasText}`,
      );
      if (score === null) continue;
      ranked.push({ row, score });
    }
    ranked.sort((a, b) => a.score - b.score);
    return ranked.map((item) => item.row);
  }, [effectiveSource, part, query, rows]);

  const facts = selected ? exerciseFacts(selected) : [];
  const credit = selected ? creditFor(selected) : '';
  const canEditSelected =
    Boolean(selected && userId) &&
    (selected?.ownerId === userId ||
      (selected?.scope === 'household' && canManageHousehold) ||
      (selected?.scope === 'group' &&
        groups.some((group) => group.id === selected.groupId && group.ownerId === userId)) ||
      (selected?.scope === 'global' &&
        selected.source === 'creator' &&
        (selected.ownerId === userId || isStaff)));

  return (
    <>
      <View style={styles.toolbar}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={creatorsOnly ? 'Search creator exercises' : 'Search exercises'}
        />
        {userId && !creatorsOnly ? (
          <View style={styles.toolbarActions}>
            <TrainButton
              label="Add exercise"
              onPress={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            />
            <TrainButton label="Groups" tone="ghost" onPress={() => setGroupsOpen(true)} />
          </View>
        ) : null}
      </View>
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
          {!creatorsOnly ? (
            <FilterDropdown
              id="source"
              label="Source"
              value={source}
              valueLabel={sourceLabel}
              open={openMenu === 'source'}
              options={[
                { value: 'all', label: 'All' },
                ...EXERCISE_SOURCE_BADGES.map((value) => ({
                  value,
                  label: EXERCISE_SOURCE_BADGE_LABEL[value],
                })),
              ]}
              active={source !== 'all'}
              onToggle={toggleMenu}
              onSelect={pick(setSource)}
            />
          ) : null}
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
          ListEmptyComponent={
            <Text style={styles.empty}>{creatorsOnly ? 'No creator exercises' : 'No exercises'}</Text>
          }
          renderItem={({ item }) => {
            const meta = exerciseFacts(item).join(' · ');
            return (
              <Pressable
                onPress={() => setSelected(item)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <View style={styles.rowTop}>
                  <Text style={styles.name}>{exerciseTitle(item.name)}</Text>
                  <Text style={styles.badge}>{EXERCISE_SOURCE_BADGE_LABEL[item.sourceBadge]}</Text>
                </View>
                {item.sourceBadge === 'creator' && item.owner ? (
                  <PublicName user={item.owner} primaryStyle={styles.creatorName} />
                ) : null}
                {meta ? <Text style={styles.meta}>{meta}</Text> : null}
              </Pressable>
            );
          }}
        />
      )}
      <Sheet visible={selected !== null} title={selected ? exerciseTitle(selected.name) : ''} wide onClose={() => setSelected(null)}>
        {selected ? (
          <View style={styles.detail}>
            {selected.mediaUrls.length > 0 ? <MediaGallery urls={selected.mediaUrls} name={selected.name} /> : null}
            <View style={styles.pills}>
              <Pill label={EXERCISE_SOURCE_BADGE_LABEL[selected.sourceBadge]} />
              {facts.map((fact) => (
                <Pill key={fact} label={fact} />
              ))}
            </View>
            {selected.sourceBadge === 'creator' && selected.owner ? (
              <PublicName user={selected.owner} link />
            ) : null}
            <ExerciseSteps instructions={selected.instructions} />
            {credit ? <Text style={styles.credit}>{credit}</Text> : null}
            {canEditSelected ? (
              <TextAction
                label="Edit"
                tone="accent"
                onPress={() => {
                  setEditing(selected);
                  setSelected(null);
                  setFormOpen(true);
                }}
              />
            ) : null}
          </View>
        ) : null}
      </Sheet>
      {userId ? (
        <>
          <CustomExerciseForm
            visible={formOpen}
            onClose={() => {
              setFormOpen(false);
              setEditing(null);
            }}
            onSaved={() => {
              void refresh();
            }}
            editing={editing}
            catalog={rows}
            groups={groups}
            userId={userId}
            householdId={activeHousehold?.id ?? null}
            canManageHousehold={canManageHousehold || role === 'owner' || role === 'admin'}
            isStaff={isStaff}
          />
          <ExerciseGroupsSheet
            visible={groupsOpen}
            onClose={() => setGroupsOpen(false)}
            userId={userId}
            onChanged={setGroups}
          />
        </>
      ) : null}
    </>
  );
}

function creditFor(exercise: LibraryExercise): string {
  if (exercise.source === 'exercisedb') return 'AscendAPI';
  if (exercise.source === 'wger') return `CC BY-SA${exercise.licenseAuthor ? ` · ${exercise.licenseAuthor}` : ''}`;
  return '';
}

const styles = StyleSheet.create({
  toolbar: { gap: 8 },
  toolbarActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  pressed: { backgroundColor: colors.bgHover },
  name: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
  badge: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  creatorName: { fontSize: 13, fontWeight: '600', color: colors.text },
  meta: { color: colors.textMuted, fontSize: 13 },
  empty: { color: colors.textMuted, fontSize: 15, paddingVertical: space.lg },
  detail: { gap: space.md, paddingTop: 4, paddingBottom: space.lg },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  credit: { color: colors.textDim, fontSize: 12 },
});
