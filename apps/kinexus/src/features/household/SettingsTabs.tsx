import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CreatorPanel } from '@/src/features/creators/CreatorPanel';
import { GoogleCalendarPanel } from '@/src/features/household/GoogleCalendarPanel';
import { ConnectedAiChats } from '@/src/features/connectors/ConnectedAiChats';
import { AiKeySettings } from '@/src/features/household/AiKeySettings';
import { GrokBotSettings } from '@/src/features/household/GrokBotSettings';
import { ProfileSection, UsernameSetupPrompt } from '@/src/features/household/profile-settings';
import { RecipeImageUploadLink } from '@/src/features/household/RecipeImageUploadLink';
import { RolePreviewCard } from '@/src/features/household/RolePreview';
import { SettingsPage } from '@/src/features/household/SettingsPage';
import { AlertSettingsPanel } from '@/src/features/alerts/AlertSettingsPanel';
import { HouseholdSettingsSection } from '@/src/features/household/household-settings';
import {
  CreateJoinPanel,
  LocationPanel,
} from '@/src/features/household/sections';
import { UnitsSettings } from '@/src/features/household/UnitsSettings';
import { LegalLinks } from '@/src/features/legal/LegalLinks';
import { StaffSettingsLink } from '@/src/features/staff/StaffSettingsLink';
import { NewsTopicsLink } from '@/src/features/today/NewsTopicsScreen';
import { colors } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

function useSettingsReady() {
  return useHousehold();
}

export function SettingsProfileTab() {
  const { isReady, error, activeHousehold } = useSettingsReady();
  const [profileEpoch, setProfileEpoch] = useState(0);

  return (
    <SettingsPage error={error} loading={!isReady} wide>
      <UsernameSetupPrompt onChanged={() => setProfileEpoch((value) => value + 1)} />
      <ProfileSection key={profileEpoch} aside={<UnitsSettings />} />
      {!activeHousehold ? (
        <>
          <CreateJoinPanel />
          <LegalLinks />
        </>
      ) : null}
    </SettingsPage>
  );
}

export function SettingsHouseholdTab() {
  const { isReady, error, activeHousehold, members } = useSettingsReady();

  if (!isReady) return <SettingsPage loading />;

  if (!activeHousehold) {
    return (
      <SettingsPage error={error}>
        <CreateJoinPanel />
      </SettingsPage>
    );
  }

  return (
    <SettingsPage error={error} wide>
      <HouseholdSettingsSection members={members} />
    </SettingsPage>
  );
}

export function SettingsConnectionsTab() {
  const { isReady, error, activeHousehold } = useSettingsReady();
  const { mode } = useExperienceMode();
  const wide = mode === 'desktop';

  if (!isReady) return <SettingsPage loading />;

  if (!activeHousehold) {
    return (
      <SettingsPage error={error}>
        <EmptyCard title="Join a household first" />
        <CreateJoinPanel />
      </SettingsPage>
    );
  }

  return (
    <SettingsPage error={error} wide={wide}>
      {wide ? (
        <>
          <View style={styles.splitRow}>
            <View style={styles.splitCol}>
              <GoogleCalendarPanel />
            </View>
            <View style={styles.splitCol}>
              <ConnectedAiChats />
            </View>
          </View>
          <View style={styles.splitRow}>
            <View style={styles.splitCol}>
              <GrokBotSettings />
            </View>
            <View style={styles.splitCol}>
              <AiKeySettings />
            </View>
          </View>
        </>
      ) : (
        <>
          <GoogleCalendarPanel />
          <ConnectedAiChats />
          <GrokBotSettings />
          <AiKeySettings />
        </>
      )}
    </SettingsPage>
  );
}

export function SettingsPreferencesTab() {
  const { isReady, error, activeHousehold } = useSettingsReady();

  if (!isReady) return <SettingsPage loading />;

  return (
    <SettingsPage error={error}>
      {activeHousehold ? <AlertSettingsPanel /> : null}
      {activeHousehold ? <LocationPanel /> : null}
      {activeHousehold ? <RolePreviewCard /> : null}
      <NewsTopicsLink />
      <StaffSettingsLink />
      <RecipeImageUploadLink />
      {activeHousehold ? <CreatorPanel /> : null}
      {!activeHousehold ? <CreateJoinPanel /> : null}
      <LegalLinks />
    </SettingsPage>
  );
}

function EmptyCard({ title }: { title: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
  },
  emptyTitle: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
    width: '100%',
  },
  splitCol: {
    flex: 1,
    minWidth: 0,
  },
});