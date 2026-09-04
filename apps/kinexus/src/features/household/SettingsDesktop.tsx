import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  CreateJoinPanel,
  HouseholdSwitcher,
  InvitePanel,
  MembersList,
  PeoplePanel,
} from '@/src/features/household/sections';
import { ErrorText } from '@/src/features/household/ui';
import { colors, space } from '@/src/features/shell/theme';
import { useHousehold } from '@/src/lib/household';

export function SettingsDesktop() {
  const { isReady, error, activeHousehold, members, memberships } = useHousehold();

  if (!isReady) {
    return (
      <View style={styles.root}>
        <Text style={styles.kicker}>Account</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.body}>Loading household…</Text>
      </View>
    );
  }

  if (!activeHousehold) {
    return (
      <View style={styles.root}>
        <Text style={styles.kicker}>Get started</Text>
        <Text style={styles.title}>Your household</Text>
        <Text style={styles.lede}>
          Create a household or accept an invite. Modules stay locked until you belong to one.
        </Text>
        <ErrorText message={error} />
        <View style={styles.narrow}>
          <CreateJoinPanel />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>Account</Text>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.lede}>
        {memberships.length > 1
          ? `${memberships.length} households · managing ${activeHousehold.name}`
          : activeHousehold.name}
      </Text>
      <ErrorText message={error} />
      <View style={styles.grid}>
        <View style={styles.col}>
          <HouseholdSwitcher />
          <InvitePanel />
        </View>
        <View style={styles.col}>
          <MembersList members={members} />
          <PeoplePanel />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 48,
    paddingTop: 48,
  },
  content: {
    paddingBottom: 64,
    maxWidth: 1100,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '700',
    marginBottom: space.sm,
  },
  lede: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: space.lg,
    maxWidth: 640,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
  },
  narrow: {
    maxWidth: 480,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  col: {
    flex: 1,
    gap: 16,
    minWidth: 320,
  },
});
