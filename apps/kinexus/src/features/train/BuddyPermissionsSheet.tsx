import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  TRAIN_BUDDY_PERMISSION_KEYS,
  TRAIN_BUDDY_PERMISSION_LABELS,
  type TrainBuddyPermissions,
} from '@kinexus/domain';

import { Sheet } from '@/src/features/meals/meals-kit';
import { PublicName } from '@/src/features/shell/PublicName';
import { colors, space } from '@/src/features/shell/theme';
import { TrainButton, Toggle } from '@/src/features/train/ui';
import type { TrainBuddyConnection } from '@/src/features/train/buddies-api';
import { saveTrainBuddyPermissions } from '@/src/features/train/buddies-api';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function BuddyPermissionsSheet({
  buddy,
  onClose,
  onSaved,
}: {
  buddy: TrainBuddyConnection | null;
  onClose: () => void;
  onSaved: (buddyId: string, permissions: TrainBuddyPermissions) => void;
}) {
  useExperienceMode();
  const [draft, setDraft] = useState<TrainBuddyPermissions | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!buddy) {
      setDraft(null);
      setError(null);
      setBusy(false);
      return;
    }
    setDraft({ ...buddy.permissions });
    setError(null);
    setBusy(false);
  }, [buddy]);

  async function save() {
    if (!buddy || !draft || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveTrainBuddyPermissions(buddy.otherUserId, draft);
      onSaved(buddy.otherUserId, draft);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save permissions');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={Boolean(buddy)} title="Permissions" onClose={onClose}>
      {buddy && draft ? (
        <View style={styles.stack}>
          <PublicName user={buddy.profile} />
          {TRAIN_BUDDY_PERMISSION_KEYS.map((key) => (
            <Toggle
              key={key}
              label={TRAIN_BUDDY_PERMISSION_LABELS[key]}
              on={draft[key]}
              disabled={busy}
              onPress={() => setDraft((current) => (current ? { ...current, [key]: !current[key] } : current))}
            />
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TrainButton label={busy ? 'Saving…' : 'Save'} onPress={() => void save()} disabled={busy} fill />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
