import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 40) },
      ]}>
      <View style={styles.brand}>
        <AppMark size={40} />
        <Text style={styles.brandName}>Kinexus</Text>
      </View>
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
        <Link href={otherHref}>
          <Text style={styles.link}>{otherLabel}</Text>
        </Link>
        <Link href="/sign-in">
          <Text style={styles.link}>Sign in</Text>
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
    gap: 12,
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
