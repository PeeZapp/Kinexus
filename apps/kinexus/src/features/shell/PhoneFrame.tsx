import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { FrameOverlayProvider } from '@/src/features/shell/frame-overlay';
import { colors, radius } from '@/src/features/shell/theme';
import { PHONE_PREVIEW, TABLET_PREVIEW, type PreviewSurface } from '@/src/lib/pwa';

type FramedSurface = Exclude<PreviewSurface, 'desktop'>;

const FRAMES: Record<FramedSurface, { width: number; height: number; notch: boolean; screenRadius: number }> = {
  phone: { ...PHONE_PREVIEW, notch: true, screenRadius: 32 },
  tablet: { ...TABLET_PREVIEW, notch: false, screenRadius: 16 },
};

export function PhoneFrame({ variant, children }: { variant: FramedSurface; children: ReactNode }) {
  const frame = FRAMES[variant];
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const outerWidth = frame.width + (variant === 'tablet' ? 24 : 20);
  const outerHeight = frame.height + (variant === 'tablet' ? 24 : 20);
  const scale = Math.min(1, (windowWidth - 48) / outerWidth, (windowHeight - 120) / outerHeight);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const attachScreen = useCallback((node: unknown) => {
    const el = node as HTMLElement | null;
    const next = el && typeof HTMLElement !== 'undefined' && el instanceof HTMLElement ? el : null;
    setHost((current) => (current === next ? current : next));
  }, []);

  return (
    <FrameOverlayProvider host={host}>
      <View style={{ width: outerWidth * scale, height: outerHeight * scale }}>
        <View
          style={[
            styles.outer,
            {
              width: outerWidth,
              height: outerHeight,
              transform: [{ scale }],
              transformOrigin: 'top left',
            },
          ]}>
          <View
            style={[
              styles.bezel,
              variant === 'tablet' && styles.bezelTablet,
              { width: frame.width + (variant === 'tablet' ? 20 : 16), height: frame.height + (variant === 'tablet' ? 20 : 16) },
            ]}>
            {frame.notch ? <View style={styles.notch} /> : null}
            <View ref={attachScreen} style={[styles.screen, { borderRadius: frame.screenRadius }]}>
              {children}
            </View>
          </View>
        </View>
      </View>
    </FrameOverlayProvider>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bezel: {
    borderRadius: radius.phone,
    backgroundColor: colors.frameBezel,
    borderWidth: 2,
    borderColor: colors.frame,
    padding: 8,
    boxShadow: '0 16px 28px rgba(0,0,0,0.45)',
    elevation: 16,
  },
  bezelTablet: {
    borderRadius: 28,
    padding: 10,
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
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
});
