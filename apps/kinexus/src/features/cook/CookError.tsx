import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import {
  RECIPE_IMPORT_ERROR_BODY,
  RECIPE_IMPORT_ERROR_TITLE,
  userErrorFromCode,
  type RecipeImportErrorCode,
  type RecipeImportUserError,
} from '@kinexus/domain';

import { openSourceUrl } from '@/src/features/cook/open-source';
import { Btn } from '@/src/features/household/ui';
import { colors, radius, space } from '@/src/features/shell/theme';

const TONE: Record<RecipeImportUserError, { border: string; bg: string; kicker: string }> = {
  not_a_recipe: { border: colors.warning, bg: colors.warningBg, kicker: colors.warning },
  unsupported_url: { border: colors.accentMuted, bg: colors.accentSoft, kicker: colors.accent },
  timeout: { border: colors.danger, bg: colors.dangerBg, kicker: colors.danger },
};

export function CookError({
  errorCode,
  hint,
  sourceUrl,
  onRetry,
}: {
  errorCode?: RecipeImportErrorCode | string | null;
  hint?: string | null;
  sourceUrl?: string | null;
  onRetry: () => void;
}) {
  const router = useRouter();
  const bucket = userErrorFromCode(errorCode);
  const tone = TONE[bucket];
  const missing = bucket === 'not_a_recipe' || errorCode === 'video_no_transcript';
  const title = missing ? 'Unable to find the recipe' : RECIPE_IMPORT_ERROR_TITLE[bucket];
  const body = missing
    ? 'We couldn’t read a full recipe from that link.'
    : RECIPE_IMPORT_ERROR_BODY[bucket];

  return (
    <View style={styles.root}>
      <View style={[styles.card, { borderColor: tone.border, backgroundColor: tone.bg }]}>
        <Text style={[styles.kicker, { color: tone.kicker }]}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {hint && hint !== body && hint !== title ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Btn label="Try again" onPress={onRetry} />
      {missing && sourceUrl ? (
        <>
          <Text style={styles.hint}>Full recipe not found, but it can be viewed at this link.</Text>
          <Btn label="Open link" variant="secondary" onPress={() => openSourceUrl(sourceUrl)} />
          <Btn
            label="Name the dish or save the link"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/meals/recipes/import',
                params: { url: sourceUrl, fallback: '1' },
              } as Href)
            }
          />
        </>
      ) : (
        <Btn
          label="Paste recipe text instead"
          variant="secondary"
          onPress={() => router.push('/meals/recipes/import' as Href)}
        />
      )}
      <Btn label="Different link" variant="ghost" onPress={() => router.replace('/import' as Href)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    padding: space.lg,
    gap: 12,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 8,
  },
  kicker: {
    fontSize: 18,
    fontWeight: '800',
  },
  body: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
