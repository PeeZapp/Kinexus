import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import {
  REMIX_CATEGORIES,
  REMIX_CATEGORY_COLOR,
  REMIX_DURATIONS,
  buildRemixWorkoutLabel,
  encodeRemixSplit,
  generateFromCategoryMix,
  normalizeRemixSliderWeights,
  remixExerciseCount,
  type RemixCategory,
} from '@kinexus/domain';

import { Sheet } from '@/src/features/meals/meals-kit';
import { loadLibrary, startRemixSession, type LibraryExercise } from '@/src/features/train/api';
import { TrainButton, TrainPage } from '@/src/features/train/ui';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

export function RemixScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold } = useHousehold();
  const userId = user && !user.isDevBypass ? user.id : null;
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [categories, setCategories] = useState<RemixCategory[]>([]);
  const [buildOpen, setBuildOpen] = useState(false);
  const [weights, setWeights] = useState<number[]>([]);
  const [duration, setDuration] = useState(40);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    loadLibrary()
      .then(setLibrary)
      .catch((err: unknown) => setError(message(err)));
  }, []);

  useEffect(() => {
    if (!buildOpen) return;
    setWeights(categories.map(() => 100));
  }, [buildOpen, categories]);

  const norm = useMemo(() => normalizeRemixSliderWeights(weights), [weights]);
  const estimate = remixExerciseCount(categories, duration);

  function toggle(category: RemixCategory) {
    setCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    );
  }

  async function generate() {
    if (building) return;
    if (!activeHousehold || !userId) {
      setError('Sign in to build a workout.');
      return;
    }
    const picks = generateFromCategoryMix(categories, weights, duration, library);
    if (picks.length < 3) {
      setError('Not enough exercises for this mix.');
      return;
    }
    setBuilding(true);
    try {
      const id = await startRemixSession({
        householdId: activeHousehold.id,
        userId,
        name: buildRemixWorkoutLabel(categories, duration),
        remixSpec: encodeRemixSplit(categories, weights),
        durationMin: duration,
        exercises: picks.map((pick) => ({
          exerciseId: pick.exerciseId,
          name: pick.name,
          targetSets: pick.targetSets,
          targetReps: pick.targetReps,
        })),
      });
      setBuildOpen(false);
      router.push(`/train/session/live/${id}` as Href);
    } catch (err: unknown) {
      setError(message(err));
    } finally {
      setBuilding(false);
    }
  }

  return (
    <TrainPage>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: space.sm, paddingBottom: space.lg }}>
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        <View style={styles.grid}>
          {REMIX_CATEGORIES.map((category) => {
            const selected = categories.includes(category);
            return (
              <Pressable
                key={category}
                onPress={() => toggle(category)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.tile, selected && styles.tileOn]}>
                <View style={[styles.swatch, { backgroundColor: REMIX_CATEGORY_COLOR[category] }]} />
                <Text style={[styles.tileLabel, selected && { color: REMIX_CATEGORY_COLOR[category] }]}>{category}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <TrainButton
        label={categories.length ? `Remix (${categories.length})` : 'Remix'}
        disabled={categories.length === 0}
        onPress={() => {
          setError(null);
          setBuildOpen(true);
        }}
      />
      <Sheet visible={buildOpen} title="Remix" onClose={() => setBuildOpen(false)}>
        <View style={{ gap: space.md, paddingBottom: space.lg }}>
          {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
          <View style={{ height: 12, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.border }}>
            {categories.map((category, index) => (
              <View
                key={category}
                style={{ flex: Math.max(norm[index] ?? 0, 0.001), backgroundColor: REMIX_CATEGORY_COLOR[category] }}
              />
            ))}
          </View>
          {categories.map((category, index) => (
            <View key={category} style={{ gap: 6, backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{category}</Text>
                <Text style={{ color: colors.textMuted }}>
                  {weights[index] ?? 100} · {Math.round((norm[index] ?? 0) * 100)}%
                </Text>
              </View>
              <WeightSlider
                value={weights[index] ?? 100}
                onChange={(value) =>
                  setWeights((current) => {
                    const next = [...current];
                    next[index] = value;
                    return next;
                  })
                }
              />
            </View>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {REMIX_DURATIONS.map((value) => (
              <Pressable
                key={value}
                onPress={() => setDuration(value)}
                style={{
                  flexGrow: 1,
                  flexBasis: '22%',
                  alignItems: 'center',
                  borderRadius: radius.md,
                  paddingVertical: 10,
                  backgroundColor: value === duration ? colors.accent : colors.bgCard,
                }}>
                <Text style={{ color: value === duration ? colors.bg : colors.textMuted, fontWeight: '700' }}>{value}m</Text>
              </Pressable>
            ))}
          </View>
          <TrainButton
            label={building ? 'Building' : `Generate · ${estimate} exercises`}
            fill
            disabled={building}
            onPress={() => void generate()}
          />
        </View>
      </Sheet>
    </TrainPage>
  );
}

function WeightSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const track = useRef(1);
  function setFromX(x: number) {
    const ratio = Math.min(1, Math.max(0, x / track.current));
    onChange(Math.round(1 + ratio * 199));
  }
  return (
    <View
      onLayout={(event) => {
        track.current = Math.max(1, event.nativeEvent.layout.width);
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => setFromX(event.nativeEvent.locationX)}
      onResponderMove={(event) => setFromX(event.nativeEvent.locationX)}
      style={styles.sliderHit}>
      <View style={styles.sliderTrack}>
        <View style={styles.sliderGroove} />
        <View style={[styles.sliderFill, { width: `${((value - 1) / 199) * 100}%` }]} />
        <View style={[styles.sliderThumb, { left: `${((value - 1) / 199) * 100}%` }]} />
      </View>
    </View>
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not build a remix';
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tileOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  swatch: { width: 8, height: 28, borderRadius: 4 },
  tileLabel: { color: colors.text, fontWeight: '700', fontSize: 15, flex: 1 },
  sliderHit: { height: 32, justifyContent: 'center' },
  sliderTrack: { height: 18, justifyContent: 'center', position: 'relative' },
  sliderGroove: { position: 'absolute', left: 0, right: 0, top: 7, height: 4, borderRadius: 2, backgroundColor: colors.border },
  sliderFill: { position: 'absolute', left: 0, top: 7, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  sliderThumb: {
    position: 'absolute',
    top: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    backgroundColor: colors.bg,
    borderWidth: 3,
    borderColor: colors.accent,
  },
});
