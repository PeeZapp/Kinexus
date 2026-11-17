import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/src/features/household/ui';
import { AppMark } from '@/src/features/shell/AppMark';
import { colors, space } from '@/src/features/shell/theme';

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export function LegalPage({
  title,
  updated,
  sections,
  otherHref,
  otherLabel,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
  otherHref: '/privacy' | '/terms';
  otherLabel: string;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  function goHome() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 40) },
      ]}>
      <BackLink label="Kinexus" onPress={goHome} />
      <Pressable onPress={goHome} style={styles.brand} accessibilityRole="link">
        <AppMark size={40} />
        <Text style={styles.brandName}>Kinexus</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>Last updated {updated}</Text>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.heading}>{section.title}</Text>
          {section.paragraphs.map((paragraph, index) => (
            <Text key={`${section.title}-${index}`} style={styles.body}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
      <View style={styles.footer}>
        <Pressable onPress={goHome}>
          <Text style={styles.link}>Back to Kinexus</Text>
        </Pressable>
        <Link href={otherHref}>
          <Text style={styles.link}>{otherLabel}</Text>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: space.lg,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 12,
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  brandName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  meta: {
    color: colors.textDim,
    fontSize: 13,
    marginBottom: space.lg,
  },
  section: {
    marginBottom: space.lg,
  },
  heading: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: space.md,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  link: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});
