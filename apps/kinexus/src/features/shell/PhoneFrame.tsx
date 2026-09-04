import { type ReactNode } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/src/features/shell/theme';

const FRAME_WIDTH = 390;
const FRAME_HEIGHT = 844;

export function PhoneFrame({ children }: { children: ReactNode }) {
  const { height } = Dimensions.get('window');
  const scale = Math.min(1, (height - 96) / FRAME_HEIGHT);

  return (
    <View style={[styles.outer, { transform: [{ scale }] }]}>
      <View style={styles.bezel}>
        <View style={styles.notch} />
        <View style={styles.screen}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: FRAME_WIDTH + 20,
    height: FRAME_HEIGHT + 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bezel: {
    width: FRAME_WIDTH + 16,
    height: FRAME_HEIGHT + 16,
    borderRadius: radius.phone,
    backgroundColor: colors.frameBezel,
    borderWidth: 2,
    borderColor: colors.frame,
    padding: 8,
    boxShadow: '0 16px 28px rgba(0,0,0,0.45)',
    elevation: 16,
  },
  notch: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    width: 108,
    height: 22,
    borderRadius: 12,
    backgroundColor: '#05070A',
    zIndex: 2,
  },
  screen: {
    flex: 1,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
});
