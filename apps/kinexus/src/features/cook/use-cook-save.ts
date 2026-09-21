import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { cleanRecipeToHouseholdDraft, type CleanRecipe, type Recipe } from '@kinexus/domain';

import { cacheCookRecipe, readSavedHouseholdId, writeSavedHouseholdId } from '@/src/features/cook/cook-storage';
import { recipeFromRow, recipeToInsert } from '@/src/features/meals/mappers';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { useOnline } from '@/src/lib/online';
import { supabase } from '@/src/lib/supabase';

export function useCookSave(importId: string | undefined) {
  const { user } = useAuth();
  const { activeHousehold, isReady: householdReady } = useHousehold();
  const online = useOnline();
  const queryClient = useQueryClient();
  const householdId = activeHousehold?.id ?? null;
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!importId) {
      setSavedId(null);
      return;
    }
    let cancelled = false;
    void readSavedHouseholdId(importId).then((id) => {
      if (!cancelled) setSavedId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [importId]);

  const listQuery = useQuery({
    queryKey: ['cook', 'saved-imports', householdId],
    enabled: Boolean(householdId && supabase && user && !user.isDevBypass),
    queryFn: async (): Promise<Recipe[]> => {
      if (!supabase || !householdId) return [];
      const { data, error: queryError } = await supabase
        .from('recipes')
        .select('*')
        .eq('household_id', householdId)
        .not('source_url', 'is', null)
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;
      return (data ?? [])
        .map(recipeFromRow)
        .filter((recipe) => Boolean(recipe.sourceUrl) && !recipe.removed);
    },
  });

  const save = useCallback(
    async (recipe: CleanRecipe) => {
      setError(null);
      if (!importId) throw new Error('Missing recipe');
      if (!user) throw new Error('Sign in to save');
      if (!householdId || !supabase) throw new Error('Create a household to save recipes');
      if (!online) throw new Error('Saving recipes needs a connection');
      setBusy(true);
      try {
        const draft = cleanRecipeToHouseholdDraft(recipe);
        const { data, error: insertError } = await supabase
          .from('recipes')
          .insert(recipeToInsert(householdId, draft))
          .select('*')
          .single();
        if (insertError) throw insertError;
        const saved = recipeFromRow(data);
        await writeSavedHouseholdId(importId, saved.id);
        await cacheCookRecipe(saved.id, recipe);
        setSavedId(saved.id);
        await queryClient.invalidateQueries({ queryKey: ['cook', 'saved-imports', householdId] });
        await queryClient.invalidateQueries({ queryKey: ['meals', 'recipes', householdId] });
        return saved;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not save that recipe';
        setError(message);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [householdId, importId, online, queryClient, user],
  );

  return {
    user,
    householdReady,
    householdId,
    online,
    savedId,
    alreadySaved: Boolean(savedId),
    busy,
    error,
    save,
    savedRecipes: listQuery.data ?? [],
    savedLoading: listQuery.isLoading,
    savedError: listQuery.error instanceof Error ? listQuery.error.message : null,
  };
}
