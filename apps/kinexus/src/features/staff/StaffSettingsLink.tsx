import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { useStaffAccess } from '@/src/features/staff/use-staff';
import { Btn, Card } from '@/src/features/household/ui';
import { colors } from '@/src/features/shell/theme';

/** Staff-only shortcut into the creator approvals dashboard. */
export function StaffSettingsLink() {
  const router = useRouter();
  const access = useStaffAccess();

  if (!access.ready || !access.isStaff) return null;

  return (
    <Card>
      <Text style={styles.heading}>Staff</Text>
      <Btn label="Open dashboard" onPress={() => router.push('/staff' as Href)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
});
