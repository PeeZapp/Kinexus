import { type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Btn } from '@/src/features/household/ui';
import { SETTINGS_HREF } from '@/src/features/shell/modules';
import { EmptyState, ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

type Props = {
  module: string;
  children: ReactNode;
};

export function HouseholdGate({ module, children }: Props) {
  const router = useRouter();
  const { mode } = useExperienceMode();
  const { isReady, activeHousehold, error } = useHousehold();
  const desktop = mode === 'desktop';

  if (!isReady) {
    return <LoadingState label={`Opening ${module}…`} />;
  }

  if (!activeHousehold) {
    return (
      <View style={[styles.root, desktop && styles.rootDesktop]}>
        <Text style={styles.kicker}>Household required</Text>
        <Text style={[styles.title, desktop && styles.titleDesktop]}>{module}</Text>
        <EmptyState
          title="Join a household first"
          body={`Sign in and create a household, or accept an invite, before using ${module}.`}>
          <ErrorBanner message={error} />
          <Btn label="Go to Settings" onPress={() => router.push(SETTINGS_HREF)} />
        </EmptyState>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space.md,
    paddingTop: space.lg,
    gap: 12,
  },
  rootDesktop: {
    paddingHorizontal: 48,
    paddingTop: 48,
    maxWidth: 880,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  titleDesktop: {
    fontSize: 40,
  },
});
