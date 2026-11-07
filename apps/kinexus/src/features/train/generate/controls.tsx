import { StyleSheet, Text, View } from 'react-native';

import {
  DAYS,
  DAY_LABELS,
  REMIX_CATEGORIES,
  REMIX_DURATIONS,
  TRAIN_GLOBAL_GOALS,
  TRAIN_GLOBAL_LEVELS,
  trainGlobalGoalLabel,
  trainGlobalLevelLabel,
} from '@kinexus/domain';

import { Chip } from '@/src/features/meals/meals-kit';
import { DayPicker, Section } from '@/src/features/shell/generate-controls';
import { colors } from '@/src/features/shell/theme';
import { WeightSlider } from '@/src/features/train/RemixScreen';
import { TRAIN_GENERATE_PRESETS } from '@/src/features/train/generate/presets';
import type {
  CardioAddon,
  GymProfileId,
  TrainGenerateAudience,
  TrainGeneratePrefs,
  TrainSplitStyle,
} from '@/src/features/train/generate/types';

const SPLITS: { id: TrainSplitStyle; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'full_body', label: 'Full body' },
  { id: 'upper_lower', label: 'Upper/Lower' },
  { id: 'ppl', label: 'PPL' },
  { id: 'bro', label: 'Bro' },
  { id: 'custom', label: 'Custom' },
];

const ADDONS: { id: CardioAddon; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'finisher', label: 'Finisher' },
  { id: 'separate_days', label: 'Separate days' },
];

export function TrainGenerateAudiencePicker({
  audience,
  buddies,
  buddyUserIds,
  onChangeAudience,
  onChangeBuddies,
}: {
  audience: TrainGenerateAudience;
  buddies: readonly { id: string; name: string }[];
  buddyUserIds: readonly string[];
  onChangeAudience: (audience: TrainGenerateAudience) => void;
  onChangeBuddies: (ids: string[]) => void;
}) {
  return (
    <Section label="For">
      <View style={styles.row}>
        <Chip label="Me" active={audience === 'me'} onPress={() => onChangeAudience('me')} />
        <Chip label="Household" active={audience === 'household'} onPress={() => onChangeAudience('household')} />
        <Chip label="Buddies" active={audience === 'buddies'} onPress={() => onChangeAudience('buddies')} />
      </View>
      {audience === 'buddies' && buddies.length > 0 ? (
        <View style={styles.row}>
          {buddies.map((buddy) => {
            const active = buddyUserIds.includes(buddy.id);
            return (
              <Chip
                key={buddy.id}
                label={buddy.name}
                active={active}
                onPress={() =>
                  onChangeBuddies(
                    active ? buddyUserIds.filter((id) => id !== buddy.id) : [...buddyUserIds, buddy.id],
                  )
                }
              />
            );
          })}
        </View>
      ) : null}
    </Section>
  );
}

export function TrainGenerateControls({
  prefs,
  equipmentOptions,
  bodyParts,
  onChange,
  onApplyPreset,
}: {
  prefs: TrainGeneratePrefs;
  equipmentOptions: readonly string[];
  bodyParts: readonly string[];
  onChange: (patch: Partial<TrainGeneratePrefs>) => void;
  onApplyPreset: (id: string) => void;
}) {
  const selectedDays = new Set(prefs.days);

  function setGymProfile(id: GymProfileId) {
    if (id == null) {
      onChange({ gymProfile: null });
      return;
    }
    const equipment = prefs.gymProfiles[id] ?? [];
    onChange({ gymProfile: id, equipment: [...equipment] });
  }

  function toggleEquipment(value: string) {
    const on = prefs.equipment.includes(value);
    onChange({
      gymProfile: null,
      equipment: on ? prefs.equipment.filter((item) => item !== value) : [...prefs.equipment, value],
    });
  }

  return (
    <View style={styles.stack}>
      <Section label="Presets">
        <View style={styles.row}>
          {TRAIN_GENERATE_PRESETS.map((preset) => (
            <Chip key={preset.id} label={preset.name} active={false} onPress={() => onApplyPreset(preset.id)} />
          ))}
        </View>
      </Section>

      <Section label="Goal">
        <View style={styles.row}>
          {TRAIN_GLOBAL_GOALS.map((goal) => (
            <Chip
              key={goal}
              label={trainGlobalGoalLabel(goal)}
              active={prefs.goal === goal}
              onPress={() => onChange({ goal })}
            />
          ))}
        </View>
      </Section>

      <Section label="Level">
        <View style={styles.row}>
          {TRAIN_GLOBAL_LEVELS.map((level) => (
            <Chip
              key={level}
              label={trainGlobalLevelLabel(level)}
              active={prefs.level === level}
              onPress={() => onChange({ level })}
            />
          ))}
        </View>
      </Section>

      <Section label="Days / week">
        <View style={styles.row}>
          {[2, 3, 4, 5, 6, 7].map((count) => (
            <Chip
              key={count}
              label={String(count)}
              active={prefs.daysPerWeek === count}
              onPress={() => onChange({ daysPerWeek: count })}
            />
          ))}
        </View>
      </Section>

      <DayPicker
        availableDays={DAYS}
        selected={selectedDays}
        onToggle={(day) => {
          const next = new Set(prefs.days);
          if (next.has(day)) {
            if (next.size <= 1) return;
            next.delete(day);
          } else next.add(day);
          const days = DAYS.filter((item) => next.has(item));
          onChange({ days, daysPerWeek: days.length });
        }}
        onSelectAll={() => onChange({ days: [...DAYS], daysPerWeek: 7 })}
      />

      <Section label="Time per day">
        <View style={styles.row}>
          {prefs.days.map((day) => (
            <Chip
              key={day}
              label={`${DAY_LABELS[day].slice(0, 3)} ${prefs.dayTimes[day] ?? '—'}`}
              active={Boolean(prefs.dayTimes[day])}
              onPress={() => {
                const current = prefs.dayTimes[day];
                const cycle = [undefined, '06:30', '07:00', '12:00', '17:30', '19:00'] as const;
                const index = cycle.findIndex((value) => value === current);
                const next = cycle[(index + 1) % cycle.length];
                const dayTimes = { ...prefs.dayTimes };
                if (!next) delete dayTimes[day];
                else dayTimes[day] = next;
                onChange({ dayTimes });
              }}
            />
          ))}
        </View>
      </Section>

      <Section label="Session length">
        <View style={styles.row}>
          {REMIX_DURATIONS.map((value) => (
            <Chip
              key={value}
              label={`${value}m`}
              active={prefs.durationMin === value}
              onPress={() => onChange({ durationMin: value })}
            />
          ))}
        </View>
      </Section>

      <Section label="Split">
        <View style={styles.row}>
          {SPLITS.map((split) => (
            <Chip
              key={split.id}
              label={split.label}
              active={prefs.splitStyle === split.id}
              onPress={() => onChange({ splitStyle: split.id })}
            />
          ))}
        </View>
      </Section>

      <Section label="Focus priority">
        {REMIX_CATEGORIES.map((category) => (
          <View key={category} style={styles.sliderBlock}>
            <View style={styles.sliderHead}>
              <Text style={styles.sliderLabel}>{category}</Text>
              <Text style={styles.sliderValue}>{prefs.focusWeights[category] ?? 100}</Text>
            </View>
            <WeightSlider
              value={prefs.focusWeights[category] ?? 100}
              onChange={(value) => onChange({ focusWeights: { ...prefs.focusWeights, [category]: value } })}
            />
          </View>
        ))}
      </Section>

      <Section label="Gym profile">
        <View style={styles.row}>
          <Chip label="Custom" active={prefs.gymProfile == null} onPress={() => setGymProfile(null)} />
          <Chip label="Home" active={prefs.gymProfile === 'home'} onPress={() => setGymProfile('home')} />
          <Chip label="Work" active={prefs.gymProfile === 'work'} onPress={() => setGymProfile('work')} />
        </View>
      </Section>

      <Section label="Equipment">
        <View style={styles.row}>
          {equipmentOptions.map((item) => (
            <Chip
              key={item}
              label={item}
              active={prefs.equipment.includes(item)}
              onPress={() => toggleEquipment(item)}
            />
          ))}
        </View>
      </Section>

      <Section label="Avoid body parts">
        <View style={styles.row}>
          {bodyParts.map((part) => {
            const active = prefs.avoidBodyParts.includes(part);
            return (
              <Chip
                key={part}
                label={part}
                active={active}
                onPress={() =>
                  onChange({
                    avoidBodyParts: active
                      ? prefs.avoidBodyParts.filter((item) => item !== part)
                      : [...prefs.avoidBodyParts, part],
                  })
                }
              />
            );
          })}
        </View>
      </Section>

      <Section label="Intensity">
        <View style={styles.row}>
          {[null, 6, 7, 8, 9].map((rpe) => (
            <Chip
              key={String(rpe)}
              label={rpe == null ? 'Auto' : `RPE ${rpe}`}
              active={prefs.intensityRpe === rpe}
              onPress={() => onChange({ intensityRpe: rpe })}
            />
          ))}
        </View>
        <View style={styles.row}>
          <Chip
            label="Progressive overload"
            active={prefs.progressiveOverload}
            onPress={() => onChange({ progressiveOverload: !prefs.progressiveOverload })}
          />
          <Chip
            label="Use saved workouts"
            active={prefs.preferSavedWorkouts}
            onPress={() => onChange({ preferSavedWorkouts: !prefs.preferSavedWorkouts })}
          />
        </View>
      </Section>

      <Section label="Cardio / mobility" last>
        <View style={styles.row}>
          {ADDONS.map((addon) => (
            <Chip
              key={addon.id}
              label={addon.label}
              active={prefs.cardioAddon === addon.id}
              onPress={() => onChange({ cardioAddon: addon.id })}
            />
          ))}
        </View>
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sliderBlock: { gap: 6, marginBottom: 8 },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { color: colors.text, fontWeight: '600', fontSize: 13 },
  sliderValue: { color: colors.textMuted, fontSize: 12 },
});
