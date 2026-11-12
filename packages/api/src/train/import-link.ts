import {
  HEVY_LINK_PUBLIC_ERROR,
  classifyHevyWorkoutImportUrl,
  matchHevyLinkExercises,
  parseHevyShareHtml,
  type ExerciseCatalogEntry,
  type HevyLinkImportPreview,
  type HevyLinkMatchedExercise,
} from '@kinexus/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchPublicHtml } from '../scrape/index.js';
import { SsrfError, type HostnameLookup } from '../scrape/ssrf.js';

const HTML_CAP = 2_000_000;
const FETCH_TIMEOUT_MS = 12_000;
const POLITE_UA =
  'Mozilla/5.0 (compatible; KinexusTrainImport/1.0; +https://kinexus.app) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export type TrainImportLinkFetchOptions = {
  fetch?: typeof fetch;
  lookup?: HostnameLookup;
  /** Injected catalogue for tests; otherwise loaded from Supabase. */
  catalog?: readonly ExerciseCatalogEntry[];
  loadCatalog?: (client: SupabaseClient, userId: string) => Promise<ExerciseCatalogEntry[]>;
  client?: SupabaseClient;
  userId?: string;
};

export type TrainImportLinkResult = {
  source: 'hevy';
  title: string;
  url: string;
  resolvedUrl: string;
  exercises: Array<{
    name: string;
    sourceName: string;
    match: HevyLinkMatchedExercise['matchStatus'];
    exerciseId: string | null;
    matchConfidence: number | null;
    candidates: Array<{ exerciseId: string; name: string; confidence: number }>;
    willCreateCustom: boolean;
    targetSets: number;
    targetReps: string;
    tracking?: HevyLinkMatchedExercise['tracking'];
    targetUnit?: HevyLinkMatchedExercise['targetUnit'];
    targetDurationSec?: number | null;
    targetDistanceKm?: number | null;
    targetEffort: HevyLinkMatchedExercise['targetEffort'];
    targetWeightKg: number | null;
    sets: Array<{
      reps: string | null;
      weightKg: number | null;
      durationSec: number | null;
      distanceM: number | null;
    }>;
  }>;
};

function publicError(status = 422): never {
  throw Object.assign(new Error(HEVY_LINK_PUBLIC_ERROR), { status });
}

async function fetchHevyPageHtml(
  url: string,
  options: TrainImportLinkFetchOptions = {},
): Promise<{ status: number; html: string; finalUrl: string }> {
  let finalUrl = url;
  const baseFetch = options.fetch ?? fetch;
  const trackingFetch: typeof fetch = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const response = await baseFetch(input, init);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (location) finalUrl = new URL(location, href).href;
    } else if (response.status >= 200 && response.status < 300) {
      finalUrl = href;
    }
    return response;
  };

  const response = await fetchPublicHtml(url, {
    timeoutMs: FETCH_TIMEOUT_MS,
    escalate: false,
    headers: { 'User-Agent': POLITE_UA },
    fetch: trackingFetch,
    lookup: options.lookup,
  });
  const html = (await response.text()).slice(0, HTML_CAP);
  return { status: response.status, html, finalUrl };
}

async function defaultLoadCatalog(client: SupabaseClient, _userId: string): Promise<ExerciseCatalogEntry[]> {
  const { data, error } = await client
    .from('exercises')
    .select('id, name, category')
    .is('merged_into', null)
    .eq('status', 'active')
    .order('name', { ascending: true })
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String((row as { id: string }).id),
    name: String((row as { name: string }).name),
    category: (row as { category?: string | null }).category ?? null,
  }));
}

function toResult(
  title: string,
  url: string,
  resolvedUrl: string,
  exercises: HevyLinkMatchedExercise[],
): TrainImportLinkResult {
  return {
    source: 'hevy',
    title,
    url,
    resolvedUrl,
    exercises: exercises.map((ex) => ({
      name: ex.name,
      sourceName: ex.sourceName,
      match: ex.matchStatus,
      exerciseId: ex.exerciseId,
      matchConfidence: ex.matchConfidence,
      candidates: (ex.candidates ?? []).map((c) => ({
        exerciseId: c.exerciseId,
        name: c.name,
        confidence: c.confidence,
      })),
      willCreateCustom: ex.willCreateCustom,
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      tracking: ex.tracking,
      targetUnit: ex.targetUnit,
      targetDurationSec: ex.targetDurationSec ?? null,
      targetDistanceKm: ex.targetDistanceKm ?? null,
      targetEffort: ex.targetEffort,
      targetWeightKg: ex.targetWeightKg,
      sets: ex.sets.map((set) => ({
        reps: set.reps,
        weightKg: set.weightKg,
        durationSec: set.durationSec,
        distanceM: set.distanceM,
      })),
    })),
  };
}

/**
 * SSRF-safe fetch + parse of a public Hevy workout/routine share link.
 * Matches exercises against the caller's catalogue. Never writes.
 */
export async function importWorkoutFromHevyLink(
  rawUrl: string,
  options: TrainImportLinkFetchOptions = {},
): Promise<TrainImportLinkResult> {
  const classified = classifyHevyWorkoutImportUrl(rawUrl);
  if (!classified) {
    throw Object.assign(new Error('Paste a Hevy workout or routine link'), { status: 400 });
  }

  let status: number;
  let html: string;
  let finalUrl: string;
  try {
    const page = await fetchHevyPageHtml(classified.canonicalUrl, options);
    status = page.status;
    html = page.html;
    finalUrl = page.finalUrl;
  } catch (err) {
    if (err instanceof SsrfError) throw err;
    publicError(422);
  }

  // After short-link redirects, re-classify the landing URL when possible.
  const resolvedClassified = classifyHevyWorkoutImportUrl(finalUrl) ?? classified;
  if ([401, 402, 403, 404, 410, 429].includes(status)) publicError(422);
  if (status < 200 || status >= 300) publicError(422);

  const parsed = parseHevyShareHtml(html, finalUrl);
  if (parsed.privateOrBlocked || parsed.exercises.length === 0) publicError(422);

  let catalog: readonly ExerciseCatalogEntry[] = options.catalog ?? [];
  if (!options.catalog) {
    if (options.loadCatalog && options.client && options.userId) {
      catalog = await options.loadCatalog(options.client, options.userId);
    } else if (options.client && options.userId) {
      catalog = await defaultLoadCatalog(options.client, options.userId);
    }
  }

  const matched = matchHevyLinkExercises(parsed, catalog);
  return toResult(
    parsed.title.trim() || 'Hevy workout',
    classified.canonicalUrl,
    resolvedClassified.canonicalUrl,
    matched,
  );
}

export function previewToDomain(result: TrainImportLinkResult): HevyLinkImportPreview {
  return {
    title: result.title,
    url: result.resolvedUrl || result.url,
    exercises: result.exercises.map((ex) => ({
      name: ex.name,
      sourceName: ex.sourceName,
      exerciseId: ex.exerciseId,
      matchConfidence: ex.matchConfidence,
      candidates: ex.candidates.length > 0 ? ex.candidates : null,
      status: ex.match === 'likely' ? 'needsMatch' : 'ready',
      note:
        ex.match === 'matched'
          ? null
          : ex.match === 'likely'
            ? 'Needs confirmation'
            : 'Will be added to your exercises',
      sets: ex.sets.map((set) => ({
        reps: set.reps,
        weightKg: set.weightKg,
        durationSec: set.durationSec,
        distanceM: set.distanceM,
        rpe: null,
        setType: null,
      })),
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      tracking: ex.tracking,
      targetUnit: ex.targetUnit,
      targetDurationSec: ex.targetDurationSec ?? null,
      targetDistanceKm: ex.targetDistanceKm ?? null,
      targetWeightKg: ex.targetWeightKg,
      targetRpe: null,
      targetEffort: ex.targetEffort,
      matchStatus: ex.match,
      willCreateCustom: ex.willCreateCustom,
    })),
  };
}

export async function handleTrainImportLink(
  body: { url?: unknown },
  options?: TrainImportLinkFetchOptions,
): Promise<{ status: number; body: TrainImportLinkResult | { error: string } }> {
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) return { status: 400, body: { error: 'A workout URL is required' } };
  try {
    const result = await importWorkoutFromHevyLink(url, options);
    return { status: 200, body: result };
  } catch (err) {
    if (err instanceof SsrfError) {
      return { status: 400, body: { error: err.message || 'That URL is not allowed' } };
    }
    const message = err instanceof Error ? err.message : HEVY_LINK_PUBLIC_ERROR;
    const status =
      typeof (err as { status?: number }).status === 'number' ? (err as { status: number }).status : 422;
    return { status, body: { error: message } };
  }
}
