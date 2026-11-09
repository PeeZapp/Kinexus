import { View, StyleSheet } from 'react-native';

import { trainVisibilityOptions, type TrainVisibility } from '@kinexus/domain';

import { Choice, VisibilityPicker } from '@/src/features/train/ui';
import { space } from '@/src/features/shell/theme';

export function PlanVisibilityBar({
  visibility,
  buddyUserIds,
  buddies,
  isApprovedCreator,
  editable,
  onChangeVisibility,
  onToggleBuddy,
}: {
  visibility: TrainVisibility;
  buddyUserIds: string[];
  buddies: readonly { id: string; name: string }[];
  isApprovedCreator: boolean;
  editable: boolean;
  onChangeVisibility: (next: TrainVisibility) => void;
  onToggleBuddy: (buddyId: string) => void;
}) {
  const options = trainVisibilityOptions({ isApprovedCreator, current: visibility });
  return (
    <View style={styles.root}>
      <VisibilityPicker
        value={visibility}
        options={options}
        editable={editable}
        onChange={(next) => {
          if (editable) onChangeVisibility(next);
        }}
      />
      {visibility === 'buddies_selected' && editable ? (
        <View style={styles.buddies}>
          {buddies.map((buddy) => {
            const on = buddyUserIds.includes(buddy.id);
            return (
              <Choice
                key={buddy.id}
                label={buddy.name}
                active={on}
                onPress={() => onToggleBuddy(buddy.id)}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  buddies: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
