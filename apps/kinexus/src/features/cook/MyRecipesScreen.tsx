import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { CookChrome } from '@/src/features/cook/CookChrome';
import { useCookSave } from '@/src/features/cook/use-cook-save';
import { Btn } from '@/src/features/household/ui';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { EmptyState, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function MyRecipesScreen() {
  const router = useRouter();
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const { user, householdReady, householdId, savedRecipes, savedLoading, savedError } = useCookSave(undefined);

  return (
    <CookChrome title="My Recipes">
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
        <Text style={styles.lede}>Recipes you saved from a URL import, with the original source still attached.</Text>
        <Btn label="Import a recipe" onPress={() => router.push('/import' as Href)} />

        {!householdReady || (user && householdId && savedLoading) ? (
          <LoadingState label="Loading saved recipes…" />
        ) : !user ? (
          <EmptyState
            kicker="Sign in"
            title="Saved imports live here"
            body="You can cook as a guest. Sign in to save a recipe to this household.">
            <Btn label="Sign in" onPress={() => router.push('/sign-in' as Href)} />
          </EmptyState>
        ) : !householdId ? (
          <EmptyState
            kicker="Household"
            title="Create a household to save"
            body="Saving syncs to your household library. Finish setup, then come back here.">
            <Btn label="Open Kinexus" onPress={() => router.push('/' as Href)} />
          </EmptyState>
        ) : savedError ? (
          <EmptyState kicker="Couldn’t load" title="Saved recipes unavailable" body={savedError} />
        ) : savedRecipes.length === 0 ? (
          <EmptyState
            kicker="Empty"
            title="No saved imports yet"
            body="Saved imports show up here after you cook and save."
          />
        ) : (
          <View style={styles.list}>
            {savedRecipes.map((recipe) => (
              <Pressable
                key={recipe.id}
                onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: recipe.id } } as Href)}
                style={styles.card}>
                <View style={styles.thumb}>
                  <RecipePhoto uri={recipe.imageUrl} emoji={recipe.emoji} size="fill" radius={0} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.name} numberOfLines={2}>
                    {recipe.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {hostLabel(recipe.sourceUrl)}
                    {recipe.servings ? ` · ${recipe.servings} servings` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </CookChrome>
  );
}

function hostLabel(url?: string) {
  if (!url) return 'Saved recipe';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
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
    maxWidth: 640,
    width: '100%',
    paddingTop: space.lg,
  },
  lede: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    minHeight: 88,
  },
  thumb: {
    width: 88,
    alignSelf: 'stretch',
    backgroundColor: colors.bgHover,
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
    paddingRight: 12,
    gap: 4,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
