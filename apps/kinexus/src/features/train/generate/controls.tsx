import { StyleSheet, View } from 'react-native';

import { DAYS, REMIX_DURATIONS } from '@kinexus/domain';

import { Chip } from '@/src/features/meals/meals-kit';
import { DayPicker, Section } from '@/src/features/shell/generate-controls';
import { TRAIN_GENERATE_PRESETS } from '@/src/features/train/generate/presets';
import {
  TRAIN_SPLIT_STYLE_OPTIONS,
  type TrainGenerateAudience,
  type TrainGeneratePrefs,
} from '@/src/features/train/generate/types';

const LENGTHS = REMIX_DURATIONS.filter((value) => value === 30 || value === 40 || value === 50 || value === 60);

export function TrainGenerateAudiencePicker({
  audience,
  onChangeAudience,
}: {
  audience: TrainGenerateAudience;
  buddies?: readonly { id: string; name: string }[];
  buddyUserIds?: readonly string[];
  onChangeAudience: (audience: TrainGenerateAudience) => void;
  onChangeBuddies?: (ids: string[]) => void;
}) {
  return (
    <Section label="Share plan">
      <View style={styles.row}>
        <Chip label="Private" active={audience === 'me'} onPress={() => onChangeAudience('me')} />
        <Chip label="Family" active={audience === 'household'} onPress={() => onChangeAudience('household')} />
        <Chip label="Buddies" active={audience === 'buddies'} onPress={() => onChangeAudience('buddies')} />
        <Chip label="Both" active={audience === 'both'} onPress={() => onChangeAudience('both')} />
      </View>
    </Section>
  );
}

export function TrainGenerateControls({
  prefs,
  onChange,
  onApplyPreset,
}: {
  prefs: TrainGeneratePrefs;
  equipmentOptions?: readonly string[];
  bodyParts?: readonly string[];
  onChange: (patch: Partial<TrainGeneratePrefs>) => void;
  onApplyPreset: (id: string) => void;
}) {
  const selectedDays = new Set(prefs.days);

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

      <Section label="Workouts" last>
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
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
