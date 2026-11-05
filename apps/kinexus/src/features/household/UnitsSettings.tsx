import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, ErrorText } from '@/src/features/household/ui';
import { colors } from '@/src/features/shell/theme';
import { Segmented } from '@/src/features/train/ui';
import { useUnits } from '@/src/lib/use-units';

export function UnitsSettings() {
  const { ready, weightUnit, measurementSystem, setWeightUnit, setMeasurementSystem } = useUnits();
  const [error, setError] = useState<string | null>(null);

  if (!ready) return null;

  return (
    <Card>
      <Text style={styles.heading}>Units</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Training weight</Text>
        <Segmented
          value={weightUnit}
          options={[
            { value: 'kg', label: 'kg' },
            { value: 'lb', label: 'lb' },
          ]}
          onChange={(value) => {
            setError(null);
            void setWeightUnit(value).catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Could not save units');
            });
          }}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Meals</Text>
        <Segmented
          value={measurementSystem}
          options={[
            { value: 'metric', label: 'Metric' },
            { value: 'imperial', label: 'Imperial' },
          ]}
          onChange={(value) => {
            setError(null);
            void setMeasurementSystem(value).catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Could not save units');
            });
          }}
        />
      </View>
      <ErrorText message={error} />
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    gap: 8,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
