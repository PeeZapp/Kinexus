import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { rotatingProgressMessage, type RecipeImportJob } from '@kinexus/domain';

import { Btn } from '@/src/features/household/ui';
import { colors, radius, space } from '@/src/features/shell/theme';

export function CookLoading({
  job,
  onCancel,
}: {
  job?: RecipeImportJob;
  onCancel: () => void;
}) {
  const startedAt = job?.createdAt ? Date.parse(job.createdAt) : Date.now();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const showElapsed = elapsedSec >= 8;
  const phase = rotatingProgressMessage(startedAt, now);
  const progress = Math.max(0, Math.min(100, job?.progress ?? 8));

  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>Working on it</Text>
      <Text style={styles.title}>{phase}</Text>
      <Text style={styles.body}>
        Video links can take a couple of minutes. Keep this page open — we will jump to the cook view when it
        is ready.
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${progress}%` }]} />
      </View>
      <ActivityIndicator color={colors.accent} />
      {showElapsed ? (
        <Text style={styles.elapsed}>
          {elapsedSec < 60 ? `${elapsedSec}s so far` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s so far`}
        </Text>
      ) : null}
      <Btn label="Cancel" variant="ghost" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    padding: space.lg,
    gap: 16,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  barTrack: {
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.bgHover,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
  },
  elapsed: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
});
