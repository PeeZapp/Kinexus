import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';

import { RolePreviewBar } from '@/src/features/household/RolePreview';
import { DesktopSidebar } from '@/src/features/shell/DesktopSidebar';
import { MobileTabBar } from '@/src/features/shell/MobileTabBar';
import { PhoneFrame } from '@/src/features/shell/PhoneFrame';
import { PreviewToggle } from '@/src/features/shell/PreviewToggle';
import { PwaInstallHint } from '@/src/features/shell/PwaInstallHint';
import { titleFromPath } from '@/src/features/shell/modules';
import { colors } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function AppChrome({ children }: { children: ReactNode }) {
  const { mode, previewSurface, previewEnabled } = useExperienceMode();

  if (previewSurface === 'phone' || previewSurface === 'tablet') {
    const framed =
      mode === 'desktop' ? <DesktopShell showToolbar={false}>{children}</DesktopShell> : <MobileShell>{children}</MobileShell>;
    return (
      <View style={styles.previewRoot}>
        <View style={styles.previewBanner}>
          <Text style={styles.previewBannerText}>DEV PREVIEW</Text>
          <Text style={styles.previewBannerSub}>
            {previewSurface === 'tablet'
              ? 'Wide layout inside an iPad landscape frame — not a production surface'
              : 'Phone layout inside a phone frame — not a production surface'}
          </Text>
          <PreviewToggle />
        </View>
        <PhoneFrame variant={previewSurface}>{framed}</PhoneFrame>
      </View>
    );
  }

  if (mode === 'desktop') {
    return <DesktopShell showToolbar={previewEnabled}>{children}</DesktopShell>;
  }

  return <MobileShell>{children}</MobileShell>;
}

function DesktopShell({ children, showToolbar }: { children: ReactNode; showToolbar: boolean }) {
  return (
    <View style={styles.desktopRoot}>
      <DesktopSidebar />
      <View style={styles.desktopMain}>
        {showToolbar ? (
          <View style={styles.desktopToolbar}>
            <PreviewToggle />
          </View>
        ) : null}
        <RolePreviewBar />
        <View style={styles.desktopContent}>{children}</View>
      </View>
    </View>
  );
}

function MobileShell({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const title = titleFromPath(pathname);
  const { signOut, user } = useAuth();

  return (
    <View style={styles.mobileRoot}>
      <View style={[styles.mobileHeader, { paddingTop: Math.max(insets.top, 12) }]}>
        <View>
          <Text style={styles.mobileBrand}>Kinexus</Text>
          <Text style={styles.mobileTitle}>{title}</Text>
        </View>
        <Pressable onPress={() => void signOut()} hitSlop={8}>
          <Text style={styles.signOut}>{user?.isDevBypass ? 'Leave dev' : 'Sign out'}</Text>
        </Pressable>
      </View>
      <RolePreviewBar />
      <View style={styles.mobileBody}>{children}</View>
      <PwaInstallHint />
      <MobileTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  desktopRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.bg,
  },
  desktopMain: {
    flex: 1,
    zIndex: 1,
  },
  desktopToolbar: {
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  desktopContent: {
    flex: 1,
  },
  mobileRoot: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgSidebar,
  },
  mobileBrand: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  mobileTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  signOut: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
    paddingBottom: 4,
  },
  mobileBody: {
    flex: 1,
  },
  previewRoot: {
    flex: 1,
    backgroundColor: '#06090D',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    backgroundColor: colors.warningBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  previewBannerText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  previewBannerSub: {
    color: colors.text,
    fontSize: 12,
    flexGrow: 1,
  },
});
