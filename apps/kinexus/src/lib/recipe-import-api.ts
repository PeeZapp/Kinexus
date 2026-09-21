import { Platform } from 'react-native';

import type { RecipeImportErrorCode, RecipeImportJob } from '@kinexus/domain';

import { supabase } from '@/src/lib/supabase';

export class RecipeImportApiError extends Error {
  readonly status: number;
  readonly errorCode?: RecipeImportErrorCode | string;

  constructor(message: string, status: number, errorCode?: RecipeImportErrorCode | string) {
    super(message);
    this.name = 'RecipeImportApiError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

function configuredUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

export function isRecipeImportApiConfigured(): boolean {
  if (configuredUrl()) return true;
  return Platform.OS === 'web';
}

function apiBase(): string {
  return configuredUrl();
}

async function optionalAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!supabase) return headers;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function parseBody(data: unknown): {
  job?: RecipeImportJob;
  error?: string;
  errorCode?: string;
} {
  if (!data || typeof data !== 'object') return {};
  return data as { job?: RecipeImportJob; error?: string; errorCode?: string };
}

export async function postRecipeImport(url: string): Promise<RecipeImportJob> {
  if (!isRecipeImportApiConfigured()) {
    throw new RecipeImportApiError(
      'Import is not configured. Set EXPO_PUBLIC_API_URL and run the API server.',
      503,
    );
  }
  const res = await fetch(`${apiBase()}/api/recipes/import`, {
    method: 'POST',
    headers: await optionalAuthHeaders(),
    body: JSON.stringify({ url }),
  });
  const data = parseBody(await res.json().catch(() => ({})));
  if (data.job) return data.job;
  throw new RecipeImportApiError(
    data.error ?? `Import failed (${res.status})`,
    res.status,
    data.errorCode,
  );
}

export async function getRecipeImport(id: string): Promise<RecipeImportJob> {
  if (!isRecipeImportApiConfigured()) {
    throw new RecipeImportApiError(
      'Import is not configured. Set EXPO_PUBLIC_API_URL and run the API server.',
      503,
    );
  }
  const res = await fetch(`${apiBase()}/api/recipes/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json' },
  });
  const data = parseBody(await res.json().catch(() => ({})));
  if (data.job) return data.job;
  throw new RecipeImportApiError(data.error ?? `Import not found (${res.status})`, res.status, data.errorCode);
}

export function isImportInProgress(job: RecipeImportJob | undefined): boolean {
  return job?.status === 'queued' || job?.status === 'running';
}
