import { useState } from 'react';
import { Link, usePathname, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export type SubnavTab = {
  href: Href;
  label: string;
  match: (path: string) => boolean;
};

export function SubnavTabs({ tabs, title = 'Go to' }: { tabs: SubnavTab[]; title?: string }) {
  const pathname = usePathname();
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';

  if (desktop) {
    return (
      <View style={styles.desktopRow}>
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.label}
              href={tab.href}
              style={StyleSheet.flatten([styles.tab, styles.tabDesktop, active && styles.tabActive])}>
              <Text style={StyleSheet.flatten([styles.label, active && styles.labelActive])}>{tab.label}</Text>
            </Link>
          );
        })}
      </View>
    );
  }

  return <MobileSectionMenu tabs={tabs} title={title} />;
}

function MobileSectionMenu({ tabs, title }: { tabs: SubnavTab[]; title: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const current = tabs.find((tab) => tab.match(pathname)) ?? tabs[0];

  function goTo(tab: SubnavTab) {
    setOpen(false);
    if (!tab.match(pathname)) router.push(tab.href);
  }

  return (
    <View style={styles.mobileWrap}>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title} menu, ${current?.label ?? title}`}>
        <HamburgerIcon />
        <Text style={styles.triggerLabel}>{current?.label ?? title}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close menu">
          <Pressable onPress={() => undefined} style={styles.card} accessibilityViewIsModal>
            <View style={styles.cardHead}>
              <Text style={styles.cardKicker}>{title}</Text>
              <Text style={styles.cardTitle}>Choose a section</Text>
            </View>
            <View style={styles.list}>
              {tabs.map((tab, index) => {
                const active = tab.match(pathname);
                return (
                  <Pressable
                    key={tab.label}
                    onPress={() => goTo(tab)}
                    style={[
                      styles.item,
                      active && styles.itemActive,
                      index === tabs.length - 1 && styles.itemLast,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}>
                    <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{tab.label}</Text>
                    {active ? <Text style={styles.itemCheck}>Current</Text> : null}
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={() => setOpen(false)} style={styles.closeBtn} accessibilityRole="button">
              <Text style={styles.closeLabel}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function HamburgerIcon() {
  return (
    <View style={styles.burger} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.burgerLine} />
      <View style={styles.burgerLine} />
      <View style={styles.burgerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  desktopRow: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 48,
    paddingTop: 16,
    paddingBottom: 4,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  tabDesktop: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  tabActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  labelActive: {
    color: colors.accent,
  },
  mobileWrap: {
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  trigger: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  triggerPressed: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  triggerLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  burger: {
    width: 18,
    height: 14,
    justifyContent: 'space-between',
  },
  burgerLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  cardHead: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 4,
  },
  cardKicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  list: {
    paddingVertical: 4,
  },
  item: {
    minHeight: 52,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemActive: {
    backgroundColor: colors.accentSoft,
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  itemLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  itemLabelActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  itemCheck: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closeLabel: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
});
