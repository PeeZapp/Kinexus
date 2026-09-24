import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  categoryLabel,
  dueTone,
  formatDueLabel,
  listThemeSoft,
  normalizeListEmoji,
  normalizeListTheme,
  priorityLabel,
  recurrenceLabel,
  type StashListItem,
} from '@kinexus/domain';

import { Pill } from '@/src/features/household/ui';
import { colors, radius, space } from '@/src/features/shell/theme';

export type ChecklistListCardModel = {
  id: string;
  name: string;
  emoji: string;
  theme: string;
  openCount: number;
  dueTodayCount: number;
  subListCount: number;
  shareLabel: string;
};

export function ChecklistListCard({
  list,
  wide,
  onPress,
  onSettings,
}: {
  list: ChecklistListCardModel;
  wide?: boolean;
  onPress: () => void;
  onSettings?: () => void;
}) {
  const stats: string[] = [];
  if (list.subListCount > 0) {
    stats.push(`${list.subListCount} sub-list${list.subListCount === 1 ? '' : 's'}`);
  }
  stats.push(`${list.openCount} open`);
  if (list.dueTodayCount > 0) {
    stats.push(`${list.dueTodayCount} due today`);
  }
  const theme = normalizeListTheme(list.theme);
  const emoji = normalizeListEmoji(list.emoji);

  return (
    <Pressable onPress={onPress} style={[styles.listCard, wide && styles.listCardWide, { borderColor: theme }]}>
      <View style={[styles.listCover, { backgroundColor: listThemeSoft(theme, 0.22) }]}>
        <Text style={styles.listCoverEmoji}>{emoji}</Text>
        {list.dueTodayCount > 0 ? (
          <View style={styles.listBadgeDue}>
            <Text style={styles.listBadgeDueText}>{list.dueTodayCount} due</Text>
          </View>
        ) : null}
        {list.shareLabel && list.shareLabel !== 'Family' ? (
          <View style={styles.listBadgeShare}>
            <Text style={styles.listBadgeShareText}>{list.shareLabel}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.listCardBody}>
        <Text style={styles.listCardTitle} numberOfLines={2}>
          {list.name}
        </Text>
        <Text style={styles.listCardStats} numberOfLines={2}>
          {stats.join(' · ')}
        </Text>
        {onSettings ? (
          <View style={styles.listCardActions}>
            <Pill label="Settings" onPress={onSettings} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ChecklistItemRow({
  item,
  today,
  peopleNames,
  listNames,
  showListName,
  onToggle,
  onOpen,
  onMoveUp,
  onMoveDown,
  onPushTomorrow,
  onPushToday,
}: {
  item: StashListItem;
  today: string;
  peopleNames: Map<string, string>;
  listNames: Map<string, string>;
  showListName: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onPushTomorrow?: () => void;
  onPushToday?: () => void;
}) {
  const tone = dueTone(item.dueOn, today);
  const bits = [
    formatDueLabel(item.dueOn, today) || null,
    item.assignedPersonId ? peopleNames.get(item.assignedPersonId) ?? null : null,
    item.recurrence !== 'none' ? recurrenceLabel(item.recurrence) : null,
    item.category ? categoryLabel(item.category) : null,
    item.priority > 0 ? priorityLabel(item.priority) : null,
    showListName ? listNames.get(item.listId) ?? null : null,
  ].filter(Boolean);
  const metaStyle =
    !item.isChecked && (tone === 'overdue' || item.priority >= 4)
      ? styles.itemUrgent
      : !item.isChecked && tone === 'today'
        ? styles.itemToday
        : styles.itemMeta;
  const hasActions = Boolean(onMoveUp || onMoveDown || onPushTomorrow || onPushToday);
  return (
    <Pressable onPress={onOpen} style={[styles.itemRow, item.isChecked && styles.itemRowDone]}>
      <Pressable
        onPress={onToggle}
        style={[styles.check, item.isChecked && styles.checkOn, item.priority >= 3 && !item.isChecked && styles.checkHigh]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.isChecked }}>
        <Text style={styles.checkMark}>{item.isChecked ? '✓' : ''}</Text>
      </Pressable>
      <View style={styles.itemBody}>
        <Text style={[styles.itemTitle, item.isChecked && styles.itemTitleDone]} numberOfLines={2}>
          {item.title}
        </Text>
        {bits.length > 0 ? (
          <Text style={metaStyle} numberOfLines={1}>
            {bits.join(' · ')}
          </Text>
        ) : null}
        {item.notes && !item.isChecked ? (
          <Text style={styles.itemNotes} numberOfLines={1}>
            {item.notes}
          </Text>
        ) : null}
        {hasActions && !item.isChecked ? (
          <View style={styles.itemActions}>
            {onMoveUp ? (
              <Pressable onPress={onMoveUp} hitSlop={6}>
                <Text style={styles.itemAction}>Up</Text>
              </Pressable>
            ) : null}
            {onMoveDown ? (
              <Pressable onPress={onMoveDown} hitSlop={6}>
                <Text style={styles.itemAction}>Down</Text>
              </Pressable>
            ) : null}
            {onPushTomorrow ? (
              <Pressable onPress={onPushTomorrow} hitSlop={6}>
                <Text style={styles.itemAction}>Tomorrow</Text>
              </Pressable>
            ) : null}
            {onPushToday ? (
              <Pressable onPress={onPushToday} hitSlop={6}>
                <Text style={styles.itemActionAccent}>Today</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    minWidth: 0,
  },
  listCardWide: { width: 280 },
  listCover: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  listCoverEmoji: {
    fontSize: 48,
  },
  listBadgeDue: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: colors.warningBg,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  listBadgeDueText: { color: colors.warning, fontSize: 11, fontWeight: '800' },
  listBadgeShare: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listBadgeShareText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  listCardBody: { padding: space.md, gap: 6 },
  listCardTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  listCardStats: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  listCardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  itemRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.sm,
  },
  itemRowDone: { opacity: 0.72 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  checkHigh: { borderColor: colors.warning },
  checkMark: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  itemBody: { flex: 1, minWidth: 0, gap: 2 },
  itemTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  itemTitleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  itemMeta: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  itemToday: { color: colors.warning, fontSize: 12, fontWeight: '700' },
  itemUrgent: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  itemNotes: { color: colors.textMuted, fontSize: 12 },
  itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  itemAction: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  itemActionAccent: { color: colors.accent, fontSize: 12, fontWeight: '800' },
});
