import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CALENDAR_COLORS,
  CALENDAR_RECURRENCES,
  REMIND_OPTIONS,
  validateEventDraft,
  type CalendarEvent,
  type CalendarEventDraft,
  type HouseholdPerson,
} from '@kinexus/domain';

import { EVENT_COLOR } from '@/src/features/calendar/colors';
import { Btn, ErrorText, Field, Pill } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, radius, space } from '@/src/features/shell/theme';

const START_PRESETS = ['08:00', '09:00', '12:00', '15:00', '17:00', '18:00', '19:00'] as const;

type Props = {
  visible: boolean;
  draft: CalendarEventDraft;
  editing: CalendarEvent | null;
  people: HouseholdPerson[];
  busy?: boolean;
  error?: string | null;
  onChange: (draft: CalendarEventDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
};

function issueMessage(issue: ReturnType<typeof validateEventDraft>): string | null {
  switch (issue) {
    case 'title':
      return 'Add a short title.';
    case 'startsOn':
    case 'endsOn':
      return 'Pick a valid date.';
    case 'range':
      return 'End date can’t be before the start.';
    case 'untilOn':
      return 'Repeat until needs a date on or after the start.';
    case 'startTime':
    case 'endTime':
      return 'Use times like 09:00.';
    case 'times':
      return 'End time needs to be after the start.';
    default:
      return null;
  }
}

export function EventSheet({
  visible,
  draft,
  editing,
  people,
  busy,
  error,
  onChange,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setLocalError(null);
  }, [visible]);

  const set = (patch: Partial<CalendarEventDraft>) => onChange({ ...draft, ...patch });

  const togglePerson = (id: string) => {
    const on = draft.personIds.includes(id);
    set({
      personIds: on ? draft.personIds.filter((item) => item !== id) : [...draft.personIds, id],
    });
  };

  const save = () => {
    const issue = validateEventDraft(draft);
    if (issue) {
      setLocalError(issueMessage(issue));
      return;
    }
    setLocalError(null);
    onSave();
  };

  return (
    <Sheet visible={visible} title={editing ? 'Edit event' : 'New event'} onClose={onClose}>
      <View style={styles.stack}>
        <Field
          label="Title"
          value={draft.title}
          onChangeText={(title) => set({ title })}
          placeholder="Soccer, dinner, appointment…"
          autoCapitalize="sentences"
          autoCorrect
        />

        <View style={styles.block}>
          <Text style={styles.label}>When</Text>
          <View style={styles.wrap}>
            <Pill label="All day" active={draft.allDay} onPress={() => set({ allDay: true })} />
            <Pill label="Timed" active={!draft.allDay} onPress={() => set({ allDay: false })} />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Field
              label="Starts"
              value={draft.startsOn}
              onChangeText={(startsOn) =>
                set({ startsOn, endsOn: draft.endsOn < startsOn ? startsOn : draft.endsOn })
              }
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.half}>
            <Field
              label="Ends"
              value={draft.endsOn}
              onChangeText={(endsOn) => set({ endsOn })}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
          </View>
        </View>

        {!draft.allDay ? (
          <View style={styles.block}>
            <Text style={styles.label}>Time</Text>
            <View style={styles.wrap}>
              {START_PRESETS.map((time) => (
                <Pill
                  key={time}
                  label={time}
                  active={draft.startTime === time}
                  onPress={() => {
                    const [h, m] = time.split(':').map(Number);
                    const endH = String(((h ?? 0) + 1) % 24).padStart(2, '0');
                    set({ startTime: time, endTime: `${endH}:${String(m ?? 0).padStart(2, '0')}` });
                  }}
                />
              ))}
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Field
                  label="From"
                  value={draft.startTime ?? ''}
                  onChangeText={(startTime) => set({ startTime })}
                  placeholder="09:00"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.half}>
                <Field
                  label="To"
                  value={draft.endTime ?? ''}
                  onChangeText={(endTime) => set({ endTime })}
                  placeholder="10:00"
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.label}>Repeat</Text>
          <View style={styles.wrap}>
            {CALENDAR_RECURRENCES.map((option) => (
              <Pill
                key={option.id}
                label={option.label}
                active={draft.recurrence === option.id}
                onPress={() =>
                  set({
                    recurrence: option.id,
                    untilOn: option.id === 'none' ? null : draft.untilOn,
                  })
                }
              />
            ))}
          </View>
          {draft.recurrence !== 'none' ? (
            <>
              <Text style={styles.hint}>Edits and delete apply to the whole series.</Text>
              <Field
                label="Until (optional)"
                value={draft.untilOn ?? ''}
                onChangeText={(untilOn) => set({ untilOn: untilOn.trim() ? untilOn : null })}
                placeholder="YYYY-MM-DD or blank"
                autoCapitalize="none"
              />
            </>
          ) : null}
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Color</Text>
          <View style={styles.colorRow}>
            {CALENDAR_COLORS.map((color) => {
              const active = draft.color === color;
              return (
                <Pressable
                  key={color}
                  accessibilityRole="button"
                  accessibilityLabel={color}
                  accessibilityState={{ selected: active }}
                  onPress={() => set({ color })}
                  style={[styles.swatch, { backgroundColor: EVENT_COLOR[color] }, active && styles.swatchOn]}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Remind</Text>
          <View style={styles.wrap}>
            {REMIND_OPTIONS.map((option) => (
              <Pill
                key={String(option.minutes)}
                label={option.label}
                active={draft.remindMinutes === option.minutes}
                onPress={() => set({ remindMinutes: option.minutes })}
              />
            ))}
          </View>
        </View>

        {people.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.label}>Who</Text>
            <View style={styles.wrap}>
              {people.map((person) => (
                <Pill
                  key={person.id}
                  label={person.name}
                  active={draft.personIds.includes(person.id)}
                  onPress={() => togglePerson(person.id)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <Field
          label="Place"
          value={draft.location}
          onChangeText={(location) => set({ location })}
          placeholder="Optional"
          autoCapitalize="sentences"
        />
        <Field
          label="Notes"
          value={draft.notes}
          onChangeText={(notes) => set({ notes })}
          placeholder="Optional"
          multiline
          autoCapitalize="sentences"
          autoCorrect
        />

        <ErrorText message={localError ?? error ?? null} />

        <Btn label={editing ? 'Save changes' : 'Add event'} onPress={save} busy={busy} />
        {editing && onDelete ? (
          <Btn
            label={editing.recurrence !== 'none' ? 'Delete series' : 'Delete event'}
            variant="danger"
            onPress={onDelete}
            disabled={busy}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md, paddingBottom: space.lg },
  block: { gap: space.sm },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  hint: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: space.sm },
  half: { flex: 1, minWidth: 0 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchOn: {
    borderColor: colors.text,
    transform: [{ scale: 1.08 }],
  },
});
