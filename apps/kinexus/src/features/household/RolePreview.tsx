import { Pressable, StyleSheet, Text, View } from 'react-native';

import { roleLabel, type HouseholdRole } from '@kinexus/domain';

import { Card, Pill } from '@/src/features/household/ui';
import { colors, space } from '@/src/features/shell/theme';
import { useHousehold } from '@/src/lib/household';

const PREVIEW_ROLES: HouseholdRole[] = ['owner', 'admin', 'adult', 'teen', 'child'];

export function RolePreviewCard() {
  const { canPreviewRoles, actualRole, role, setPreviewRole } = useHousehold();
  if (!canPreviewRoles || !actualRole || !role) return null;

  return (
    <Card>
      <Text style={styles.heading}>Role preview</Text>
      <Text style={styles.body}>
        See the app as each household role. Your account stays {roleLabel(actualRole)}. Saves still use that role.
      </Text>
      <RolePills role={role} onSelect={setPreviewRole} />
    </Card>
  );
}

export function RolePreviewBar() {
  const { canPreviewRoles, actualRole, role, setPreviewRole } = useHousehold();
  if (!canPreviewRoles || !actualRole || !role || role === actualRole) return null;

  return (
    <View style={styles.bar}>
      <Text style={styles.barLabel}>Previewing as {roleLabel(role)}</Text>
      <RolePills role={role} onSelect={setPreviewRole} />
      <Pressable onPress={() => setPreviewRole(null)} hitSlop={8}>
        <Text style={styles.reset}>Use my role</Text>
      </Pressable>
    </View>
  );
}

export function RolePreviewSwitcher() {
  const { canPreviewRoles, actualRole, role, setPreviewRole } = useHousehold();
  if (!canPreviewRoles || !actualRole || !role) return null;

  return (
    <View style={styles.switcher}>
      <Text style={styles.switcherLabel}>Preview role</Text>
      <RolePills role={role} onSelect={setPreviewRole} />
    </View>
  );
}
function RolePills({
  role,
  onSelect,
}: {
  role: HouseholdRole;
  onSelect: (role: HouseholdRole | null) => void;
}) {
  return (
    <View style={styles.pills}>
      {PREVIEW_ROLES.map((choice) => (
        <Pill
          key={choice}
          label={roleLabel(choice)}
          active={role === choice}
          onPress={() => onSelect(choice)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  switcher: {
    gap: 8,
    marginBottom: 8,
  },
  switcherLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.warningBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning,
    paddingVertical: 10,
    paddingHorizontal: space.md,
  },
  barLabel: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  reset: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
