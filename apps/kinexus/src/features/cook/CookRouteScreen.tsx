import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { householdRecipeToClean, isCompleteCleanRecipe, type CleanRecipe } from '@kinexus/domain';

import { CookChrome } from '@/src/features/cook/CookChrome';
import { CookError } from '@/src/features/cook/CookError';
import { CookLoading } from '@/src/features/cook/CookLoading';
import { CookView } from '@/src/features/cook/CookView';
import { cacheCookRecipe, readCachedCookRecipe } from '@/src/features/cook/cook-storage';
import { recipeParam } from '@/src/features/meals/recipe-href';
import { fetchRecipeById } from '@/src/features/meals/use-meals-sync';
import { LoadingState } from '@/src/features/shell/states';
import { useOnline } from '@/src/lib/online';
import { getRecipeImport, isImportInProgress, postRecipeImport, RecipeImportApiError } from '@/src/lib/recipe-import-api';

export function CookRouteScreen() {
  const router = useRouter();
  const online = useOnline();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const importId = recipeParam(id);
  const [cached, setCached] = useState<CleanRecipe | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    if (!importId) return;
    let cancelled = false;
    void readCachedCookRecipe(importId).then((recipe) => {
      if (!cancelled) setCached(recipe);
    });
    return () => {
      cancelled = true;
    };
  }, [importId]);

  const jobQuery = useQuery({
    queryKey: ['recipe-import', importId],
    enabled: Boolean(importId),
    queryFn: () => getRecipeImport(importId!),
    retry: 1,
    refetchInterval: (query) => {
      const job = query.state.data;
      if (!isImportInProgress(job)) return false;
      const started = job?.createdAt ? Date.parse(job.createdAt) : Date.now();
      return Date.now() - started > 30_000 ? 5_000 : 2_000;
    },
  });

  const householdQuery = useQuery({
    queryKey: ['cook', 'household-recipe', importId],
    enabled: Boolean(importId && jobQuery.isError && !cached),
    queryFn: () => fetchRecipeById(importId!),
  });

  const job = jobQuery.data;
  const jobRecipe = job?.status === 'succeeded' && job.recipe && isCompleteCleanRecipe(job.recipe) ? job.recipe : null;

  useEffect(() => {
    if (!importId || !jobRecipe) return;
    setCached(jobRecipe);
    void cacheCookRecipe(importId, jobRecipe);
  }, [importId, jobRecipe]);

  const householdRecipe = householdQuery.data
    ? householdRecipeToClean(householdQuery.data)
    : null;

  const retry = useCallback(async () => {
    const url = job?.canonicalUrl || job?.inputUrl;
    if (!url) {
      router.replace('/import' as Href);
      return;
    }
    setRetrying(true);
    setRetryError(null);
    try {
      const next = await postRecipeImport(url);
      if (next.id !== importId) {
        router.replace({ pathname: '/recipes/[id]', params: { id: next.id } } as Href);
        return;
      }
      await jobQuery.refetch();
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : 'Could not retry that import');
    } finally {
      setRetrying(false);
    }
  }, [importId, job?.canonicalUrl, job?.inputUrl, jobQuery, router]);

  if (!importId) {
    return (
      <CookChrome title="Cook" showInstall={false}>
        <CookError errorCode="invalid_url" hint="That cook link is missing a recipe id." onRetry={() => router.replace('/import' as Href)} />
      </CookChrome>
    );
  }

  if (jobRecipe || cached) {
    return (
      <CookChrome title="Cook" showInstall={false}>
        <CookView importId={importId} recipe={jobRecipe ?? cached!} />
      </CookChrome>
    );
  }

  if (isImportInProgress(job) || jobQuery.isLoading || retrying) {
    return (
      <CookChrome title="Cook" showInstall={false}>
        <CookLoading job={job} onCancel={() => router.replace('/import' as Href)} />
      </CookChrome>
    );
  }

  if (job?.status === 'failed') {
    return (
      <CookChrome title="Cook" showInstall={false}>
        <CookError
          errorCode={job.errorCode}
          hint={retryError ?? job.errorMessage}
          onRetry={() => void retry()}
        />
      </CookChrome>
    );
  }

  if (job?.status === 'succeeded' && !jobRecipe) {
    return (
      <CookChrome title="Cook" showInstall={false}>
        <CookError errorCode="extraction_failed" hint={job.errorMessage} onRetry={() => void retry()} />
      </CookChrome>
    );
  }

  if (householdRecipe && isCompleteCleanRecipe(householdRecipe)) {
    return (
      <CookChrome title="Cook" showInstall={false}>
        <CookView importId={importId} recipe={householdRecipe} />
      </CookChrome>
    );
  }

  if (householdQuery.isLoading) {
    return (
      <CookChrome title="Cook" showInstall={false}>
        <LoadingState label="Loading recipe…" />
      </CookChrome>
    );
  }

  const apiError = jobQuery.error;
  const code =
    apiError instanceof RecipeImportApiError
      ? apiError.errorCode ?? (apiError.status === 404 ? 'not_a_recipe' : online ? 'fetch_failed' : 'timeout')
      : online
        ? 'fetch_failed'
        : 'timeout';

  return (
    <CookChrome title="Cook" showInstall={false}>
      <CookError
        errorCode={code}
        hint={retryError ?? (apiError instanceof Error ? apiError.message : null)}
        onRetry={() => void (job?.inputUrl || job?.canonicalUrl ? retry() : jobQuery.refetch())}
      />
    </CookChrome>
  );
}
