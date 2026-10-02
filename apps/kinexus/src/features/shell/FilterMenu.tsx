import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/src/features/shell/theme';

export type FilterOption<T extends string | number | null> = {
  value: T;
  label: string;
};

export function useFilterMenus() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  function toggleMenu(id: string) {
    setOpenMenu((current) => (current === id ? null : id));
  }

  function pick<T>(apply: (value: T) => void) {
    return (value: T) => {
      apply(value);
      setOpenMenu(null);
    };
  }

  return { openMenu, toggleMenu, pick };
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <View style={styles.filterRow}>{children}</View>;
}

export function FilterDropdown<T extends string | number | null>({
  id,
  label,
  value,
  valueLabel,
  open,
  options,
  active,
  onToggle,
  onSelect,
}: {
  id: string;
  label: string;
  value: T;
  valueLabel: string;
  open: boolean;
  options: FilterOption<T>[];
  active?: boolean;
  onToggle: (id: string) => void;
  onSelect: (value: T) => void;
}) {
  const highlighted = active ?? value != null;
  return (
    <View style={[styles.dropdown, open && styles.dropdownOpen]}>
      <Pressable
        onPress={() => onToggle(id)}
        style={[styles.dropdownTrigger, (highlighted || open) && styles.dropdownTriggerActive]}>
        <Text style={styles.dropdownKind}>{label}</Text>
        <Text style={[styles.dropdownValue, highlighted && styles.dropdownValueActive]} numberOfLines={1}>
          {valueLabel}
        </Text>
        <Text style={styles.dropdownChevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.dropdownMenu}>
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={`${id}-${String(option.value)}`}
                onPress={() => onSelect(option.value)}
                style={[
                  styles.dropdownItem,
                  index > 0 && styles.dropdownItemBorder,
                  selected && styles.dropdownItemActive,
                ]}>
                <Text style={[styles.dropdownItemLabel, selected && styles.dropdownItemLabelActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 8,
    zIndex: 2,
  },
  dropdown: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 120,
    maxWidth: 220,
    position: 'relative',
    zIndex: 1,
  },
  dropdownOpen: { zIndex: 30 },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    paddingVertical: 7,
    paddingHorizontal: 10,
    minHeight: 34,
  },
  dropdownTriggerActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  dropdownKind: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dropdownValue: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    minWidth: 0,
  },
  dropdownValueActive: { color: colors.accent },
  dropdownChevron: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  dropdownMenu: {
    marginTop: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
    zIndex: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  dropdownItem: {
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  dropdownItemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dropdownItemActive: { backgroundColor: colors.accentSoft },
  dropdownItemLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  dropdownItemLabelActive: { color: colors.accent, fontWeight: '700' },
});
