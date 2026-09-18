import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CreateJoinPanel,
  HouseholdSwitcher,
  InvitePanel,
  LocationPanel,
  MembersList,
  PeoplePanel,
} from '@/src/features/household/sections';
import { ErrorText } from '@/src/features/household/ui';
import { colors, space } from '@/src/features/shell/theme';
import { useHousehold } from '@/src/lib/household';

export function SettingsMobile() {
  const insets = useSafeAreaInsets();
  const { isReady, error, activeHousehold, members, memberships } = useHousehold();

  if (!isReady) {
    return (
      <View style={styles.root}>
        <Text style={styles.body}>Loading household…</Text>
      </View>
    );
  }

  if (!activeHousehold) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>Get started</Text>
        <Text style={styles.title}>Your household</Text>
        <Text style={styles.lede}>
          Create a household or paste an invite. Meals and the other modules unlock after you join.
        </Text>
        <ErrorText message={error} />
        <CreateJoinPanel />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>
        {memberships.length > 1 ? `${memberships.length} households` : 'Household'}
      </Text>
      <Text style={styles.title}>{activeHousehold.name}</Text>
      <ErrorText message={error} />
      <HouseholdSwitcher />
      <LocationPanel />
      <InvitePanel />
      <MembersList members={members} />
      <PeoplePanel />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    gap: 16,
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
  lede: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    padding: space.md,
  },
});
