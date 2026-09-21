import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { RecipeUrlError, normalizeRecipeUrl } from '@kinexus/domain';

import { CookChrome } from '@/src/features/cook/CookChrome';
import { Btn, Field } from '@/src/features/household/ui';
import { recipeParam } from '@/src/features/meals/recipe-href';
import { ErrorBanner } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useOnline } from '@/src/lib/online';
import { isRecipeImportApiConfigured, postRecipeImport, RecipeImportApiError } from '@/src/lib/recipe-import-api';

export function ImportScreen() {
  const router = useRouter();
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const online = useOnline();
  const params = useLocalSearchParams<{ url?: string | string[] }>();
  const urlParam = recipeParam(params.url);
  const [value, setValue] = useState(urlParam ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const submit = useCallback(
    async (raw: string) => {
      setError(null);
      if (!online) {
        setError('Import needs a connection. Paste the recipe text instead if you are offline.');
        return;
      }
      if (!isRecipeImportApiConfigured()) {
        setError('Import is not available right now. Try again later, or paste the recipe text.');
        return;
      }
      let canonical: string;
      try {
        canonical = normalizeRecipeUrl(raw).canonicalUrl;
      } catch (err) {
        const message =
          err instanceof RecipeUrlError ? err.message : 'Enter a valid URL starting with https://';
        setError(message);
        return;
      }
      setBusy(true);
      try {
        const job = await postRecipeImport(canonical);
        router.replace({ pathname: '/recipes/[id]', params: { id: job.id } } as Href);
      } catch (err) {
        if (err instanceof RecipeImportApiError) {
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : 'Could not start that import');
        }
      } finally {
        setBusy(false);
      }
    },
    [online, router],
  );

  useEffect(() => {
    if (!urlParam || autoStarted.current) return;
    autoStarted.current = true;
    setValue(urlParam);
    void submit(urlParam);
  }, [submit, urlParam]);

  return (
    <CookChrome title="Import">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.lede}>
          Paste a recipe page or a YouTube, TikTok, Instagram, or Facebook cooking video. We show a clean cook
          view and always link back to the original source.
        </Text>
        {!online ? (
          <ErrorBanner message="You are offline. URL import needs a connection." />
        ) : null}
        <Field
          label="Paste recipe or video link"
          value={value}
          onChangeText={setValue}
          placeholder="https://"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          editable={!busy}
          onSubmitEditing={() => void submit(value)}
        />
        {error ? <ErrorBanner message={error} /> : null}
        <Btn
          label={online ? 'Get recipe' : 'Needs connection'}
          onPress={() => void submit(value)}
          busy={busy}
          disabled={!online || !value.trim()}
        />
        <Btn
          label="Paste recipe text instead"
          variant="ghost"
          onPress={() => router.push('/meals/recipes/import' as Href)}
        />
        <Btn label="My Recipes" variant="secondary" onPress={() => router.push('/recipes' as Href)} />
      </ScrollView>
    </CookChrome>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: '100%',
  },
  content: {
    padding: space.md,
    gap: 16,
    paddingBottom: 48,
  },
  contentDesktop: {
    maxWidth: 560,
    width: '100%',
    paddingTop: space.xl,
  },
  lede: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
});
