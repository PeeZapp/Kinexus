import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, space } from '@/src/features/shell/theme';
import { joinByCode, normalizeJoinCode } from '@/src/features/train/group-workouts-api';
import { Field, TrainButton } from '@/src/features/train/ui';

export function GroupWorkoutJoinSheet({
  visible,
  onClose,
  onJoined,
}: {
  visible: boolean;
  onClose: () => void;
  onJoined: (id: string) => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCode('');
    setBusy(false);
    setError(null);
  }, [visible]);

  async function onJoin() {
    if (busy) return;
    setError(null);
    const normalized = normalizeJoinCode(code);
    if (normalized.length !== 6) {
      setError('Enter the 6-character code');
      return;
    }
    setBusy(true);
    try {
      const id = await joinByCode(normalized);
      onJoined(id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Join with code" onClose={onClose}>
      <View style={styles.body}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Field
          value={code}
          onChangeText={(value) => setCode(normalizeJoinCode(value))}
          placeholder="ABC234"
        />
        <TrainButton
          label={busy ? 'Joining…' : 'Join'}
          disabled={busy || code.length !== 6}
          fill
          onPress={() => void onJoin()}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingBottom: space.lg },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
