import { Pressable, StyleSheet, View } from 'react-native';

import { trainVisibilityLabel, trainVisibilityOptions, type TrainVisibility } from '@kinexus/domain';

import { Choice } from '@/src/features/train/ui';
import { FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { colors, radius, space } from '@/src/features/shell/theme';

export function ShareGlyph({ color = colors.accent }: { color?: string }) {
  return (
    <View style={glyph.root} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[glyph.lineUp, { backgroundColor: color }]} />
      <View style={[glyph.lineDown, { backgroundColor: color }]} />
      <View style={[glyph.node, glyph.nodeLeft, { backgroundColor: color }]} />
      <View style={[glyph.node, glyph.nodeTop, { backgroundColor: color }]} />
      <View style={[glyph.node, glyph.nodeBottom, { backgroundColor: color }]} />
    </View>
  );
}

export function PlanVisibilityBar({
  visibility,
  buddyUserIds,
  buddies,
  isApprovedCreator,
  editable,
  onChangeVisibility,
  onToggleBuddy,
  onShare,
}: {
  visibility: TrainVisibility;
  buddyUserIds: string[];
  buddies: readonly { id: string; name: string }[];
  isApprovedCreator: boolean;
  editable: boolean;
  onChangeVisibility: (next: TrainVisibility) => void;
  onToggleBuddy: (buddyId: string) => void;
  onShare?: () => void;
}) {
  const options = trainVisibilityOptions({ isApprovedCreator, current: visibility });
  const { openMenu, toggleMenu, pick } = useFilterMenus();

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <FilterDropdown
          id="plan-visibility"
          label="Visible to"
          value={visibility}
          valueLabel={trainVisibilityLabel(visibility)}
          open={openMenu === 'plan-visibility'}
          options={options.map((option) => ({ value: option.value, label: option.label }))}
          active
          onToggle={toggleMenu}
          onSelect={
            editable
              ? pick((next: TrainVisibility) => onChangeVisibility(next))
              : () => undefined
          }
          style={styles.dropdown}
        />
        {onShare ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share plan"
            onPress={onShare}
            hitSlop={6}
            style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}>
            <ShareGlyph />
          </Pressable>
        ) : null}
      </View>
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

const glyph = StyleSheet.create({
  root: {
    width: 18,
    height: 18,
    position: 'relative',
  },
  node: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  nodeLeft: { left: 0, top: 6.5 },
  nodeTop: { right: 0, top: 0 },
  nodeBottom: { right: 0, bottom: 0 },
  lineUp: {
    position: 'absolute',
    width: 11,
    height: 1.5,
    left: 4,
    top: 5,
    transform: [{ rotate: '-32deg' }],
    borderRadius: 1,
  },
  lineDown: {
    position: 'absolute',
    width: 11,
    height: 1.5,
    left: 4,
    bottom: 5,
    transform: [{ rotate: '32deg' }],
    borderRadius: 1,
  },
});

const styles = StyleSheet.create({
  root: { gap: space.sm, zIndex: 30, overflow: 'visible' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 30,
    overflow: 'visible',
  },
  dropdown: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 140,
    maxWidth: undefined,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnPressed: { opacity: 0.82 },
  buddies: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
