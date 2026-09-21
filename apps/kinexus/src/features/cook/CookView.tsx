import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { scaledQuantityLabel, type CleanRecipe } from '@kinexus/domain';

import {
  clearPendingCookSave,
  readCookChecks,
  readPendingCookSave,
  writeCookChecks,
  writeCookReturnTo,
  writePendingCookSave,
} from '@/src/features/cook/cook-storage';
import { openSourceUrl } from '@/src/features/cook/open-source';
import { useCookSave } from '@/src/features/cook/use-cook-save';
import { useWakeLock } from '@/src/features/cook/use-wake-lock';
import { Btn } from '@/src/features/household/ui';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { ErrorBanner } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function CookView({
  importId,
  recipe,
}: {
  importId: string;
  recipe: CleanRecipe;
}) {
  const router = useRouter();
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const cookSave = useCookSave(importId);
  const canScale = Boolean(recipe.originalServings && recipe.originalServings > 0);
  const [servings, setServings] = useState(Math.max(1, recipe.originalServings ?? 1));
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useWakeLock(true);

  useEffect(() => {
    setServings(Math.max(1, recipe.originalServings ?? 1));
  }, [recipe.originalServings, importId]);

  useEffect(() => {
    let cancelled = false;
    void readCookChecks(importId).then((ids) => {
      if (!cancelled) setChecked(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, [importId]);

  const persistChecks = useCallback(
    (next: Set<string>) => {
      setChecked(next);
      void writeCookChecks(importId, [...next]);
    },
    [importId],
  );

  const saveRecipe = cookSave.save;
  const signedIn = Boolean(cookSave.user);
  const householdId = cookSave.householdId;
  const alreadySaved = cookSave.alreadySaved;
  const saveBusy = cookSave.busy;

  useEffect(() => {
    if (!signedIn || !householdId || alreadySaved || saveBusy) return;
    let cancelled = false;
    void (async () => {
      const pending = await readPendingCookSave();
      if (cancelled || pending?.importId !== importId) return;
      try {
        await saveRecipe(pending.recipe);
        await clearPendingCookSave();
      } catch {
        // Stay on the cook view; save error is shown on the button row.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alreadySaved, householdId, importId, saveBusy, saveRecipe, signedIn]);

  const groups = useMemo(() => groupedIngredients(recipe), [recipe]);

  async function onSave() {
    if (!cookSave.user) {
      await writePendingCookSave({ importId, recipe });
      await writeCookReturnTo(`/recipes/${importId}`);
      router.push('/sign-in' as Href);
      return;
    }
    await cookSave.save(recipe);
  }

  let stepNumber = 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{recipe.title}</Text>
      {recipe.attribution.sourceUrl ? (
        <Pressable onPress={() => openSourceUrl(recipe.attribution.sourceUrl)} accessibilityRole="link">
          <Text style={styles.source}>From {recipe.attribution.displayName}</Text>
        </Pressable>
      ) : (
        <Text style={styles.sourceMuted}>From {recipe.attribution.displayName}</Text>
      )}
      <Text style={styles.attrNote}>Source recipe. Kinexus did not write this.</Text>

      {recipe.imageUrl ? (
        <View style={styles.hero}>
          <RecipePhoto uri={recipe.imageUrl} size="fill" radius={0} />
        </View>
      ) : null}

      <View style={styles.servingsRow}>
        <Text style={styles.sectionLabel}>Servings</Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => canScale && setServings((n) => Math.max(1, n - 1))}
            disabled={!canScale || servings <= 1}
            style={({ pressed }) => [
              styles.stepBtn,
              (!canScale || servings <= 1) && styles.stepBtnDisabled,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Fewer servings">
            <Text style={styles.stepBtnLabel}>−</Text>
          </Pressable>
          <Text style={styles.servingsValue}>{canScale ? servings : '—'}</Text>
          <Pressable
            onPress={() => canScale && setServings((n) => n + 1)}
            disabled={!canScale}
            style={({ pressed }) => [
              styles.stepBtn,
              !canScale && styles.stepBtnDisabled,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="More servings">
            <Text style={styles.stepBtnLabel}>+</Text>
          </Pressable>
        </View>
      </View>
      {!canScale ? (
        <Text style={styles.hint}>Servings were not listed, so amounts stay as written.</Text>
      ) : null}

      {cookSave.error ? <ErrorBanner message={cookSave.error} /> : null}
      {cookSave.alreadySaved ? (
        <Btn label="Saved to My Recipes" variant="secondary" disabled onPress={() => undefined} />
      ) : (
        <Btn
          label={cookSave.user ? 'Save to My Recipes' : 'Sign in to save'}
          onPress={() => void onSave()}
          busy={cookSave.busy}
          disabled={cookSave.busy || (Boolean(cookSave.user) && !cookSave.householdId)}
        />
      )}
      {cookSave.user && !cookSave.householdId ? (
        <Text style={styles.hint}>Create a household in Kinexus to save this recipe.</Text>
      ) : null}

      <Text style={styles.section}>Ingredients</Text>
      {groups.map((group) => (
        <View key={group.key} style={styles.group}>
          {group.label ? <Text style={styles.groupLabel}>{group.label}</Text> : null}
          {group.items.map((item) => {
            const on = checked.has(item.id);
            const qty = scaledQuantityLabel(item.quantity, recipe.originalServings, servings);
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  const next = new Set(checked);
                  if (on) next.delete(item.id);
                  else next.add(item.id);
                  persistChecks(next);
                }}
                style={[styles.ingredient, on && styles.ingredientOn]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}>
                <View style={[styles.box, on && styles.boxOn]}>{on ? <Text style={styles.check}>✓</Text> : null}</View>
                <Text style={[styles.ingredientText, on && styles.ingredientDone]}>
                  {qty ? `${qty} ${item.name}` : item.name}
                  {item.note ? ` (${item.note})` : ''}
                  {item.optional ? ' (optional)' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Text style={styles.section}>Method</Text>
      {recipe.method.map((block) => {
        if (block.type === 'heading') {
          return (
            <Text key={block.id} style={styles.methodHeading}>
              {block.text}
            </Text>
          );
        }
        stepNumber += 1;
        return (
          <View key={block.id} style={styles.stepRow}>
            <Text style={styles.stepNum}>{stepNumber}</Text>
            <Text style={styles.stepText}>{block.text}</Text>
          </View>
        );
      })}

      {recipe.chefTip ? (
        <View style={styles.tip}>
          <Text style={styles.groupLabel}>Chef tip</Text>
          <Text style={styles.stepText}>{recipe.chefTip}</Text>
        </View>
      ) : null}

      <Btn label="Import another" variant="ghost" onPress={() => router.push('/import' as Href)} />
    </ScrollView>
  );
}

function groupedIngredients(recipe: CleanRecipe) {
  const groups: { key: string; label?: string; items: CleanRecipe['ingredients'] }[] = [];
  for (const item of recipe.ingredients) {
    const label = item.group?.trim() || undefined;
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(item);
    } else {
      groups.push({ key: `${label ?? 'all'}-${groups.length}`, label, items: [item] });
    }
  }
  return groups;
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: '100%',
  },
  content: {
    padding: space.md,
    gap: 14,
    paddingBottom: 64,
  },
  contentDesktop: {
    maxWidth: 640,
    width: '100%',
    paddingTop: space.lg,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
  },
  source: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  sourceMuted: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  attrNote: {
    color: colors.textDim,
    fontSize: 13,
  },
  hero: {
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgHover,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  stepBtnLabel: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginTop: -2,
  },
  servingsValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    minWidth: 36,
    textAlign: 'center',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  group: {
    gap: 8,
  },
  groupLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  ingredient: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ingredientOn: {
    backgroundColor: colors.bgElevated,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: colors.accent,
  },
  check: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '800',
  },
  ingredientText: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
  },
  ingredientDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  methodHeading: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepNum: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.accent,
    color: colors.bg,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 36,
  },
  stepText: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '500',
  },
  tip: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: 6,
  },
  pressed: {
    opacity: 0.86,
  },
});
