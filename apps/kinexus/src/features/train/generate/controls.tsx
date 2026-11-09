import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  DAYS,
  REMIX_DURATIONS,
  TRAIN_GLOBAL_GOALS,
  TRAIN_GLOBAL_LEVELS,
  trainGlobalGoalLabel,
  trainGlobalLevelLabel,
} from '@kinexus/domain';

import { Chip } from '@/src/features/meals/meals-kit';
import { DayPicker, Section } from '@/src/features/shell/generate-controls';
import { colors } from '@/src/features/shell/theme';
import { TRAIN_GENERATE_PRESETS } from '@/src/features/train/generate/presets';
import {
  TRAIN_SPLIT_STYLE_OPTIONS,
  type TrainGenerateAudience,
  type TrainGeneratePrefs,
} from '@/src/features/train/generate/types';

const LENGTHS = REMIX_DURATIONS.filter((value) => value === 30 || value === 40 || value === 50 || value === 60);

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
  onChange,
  onApplyPreset,
}: {
  prefs: TrainGeneratePrefs;
  equipmentOptions: readonly string[];
  bodyParts?: readonly string[];
  onChange: (patch: Partial<TrainGeneratePrefs>) => void;
  onApplyPreset: (id: string) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const selectedDays = new Set(prefs.days);

  function toggleEquipment(value: string) {
    const on = prefs.equipment.includes(value);
    onChange({
      gymProfile: null,
      equipment: on ? prefs.equipment.filter((item) => item !== value) : [...prefs.equipment, value],
    });
  }

  return (
    <View style={styles.stack}>
      <Section label="Week style">
        <View style={styles.row}>
          {TRAIN_GENERATE_PRESETS.map((preset) => (
            <Chip key={preset.id} label={preset.name} active={false} onPress={() => onApplyPreset(preset.id)} />
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

      <Section label="Session length">
        <View style={styles.row}>
          {LENGTHS.map((value) => (
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
          {TRAIN_SPLIT_STYLE_OPTIONS.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              active={prefs.splitStyle === option.id}
              onPress={() => onChange({ splitStyle: option.id })}
            />
          ))}
        </View>
      </Section>

      <Section label="Workouts">
        <View style={styles.row}>
          <Chip
            label="Intents only"
            active={!prefs.fillWorkouts}
            onPress={() => onChange({ fillWorkouts: false })}
          />
          <Chip
            label="Fill workouts"
            active={prefs.fillWorkouts}
            onPress={() => onChange({ fillWorkouts: true })}
          />
        </View>
      </Section>

      <Pressable accessibilityRole="button" onPress={() => setMoreOpen((open) => !open)} style={styles.moreToggle}>
        <Text style={styles.moreToggleText}>{moreOpen ? 'Hide options' : 'More options'}</Text>
      </Pressable>

      {moreOpen ? (
        <>
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

          <Section label="Equipment" last>
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
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  moreToggle: { paddingVertical: 8 },
  moreToggleText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
