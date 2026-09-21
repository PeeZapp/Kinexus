import type { RecipeImportJob, RecipeImportJobStatus } from '@kinexus/domain';
import { rotatingProgressMessage } from '@kinexus/domain';

import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';

function persistToSupabase(): boolean {
  if (process.env.VITEST) return false;
  return isServiceRoleConfigured();
}

export type RecipeImportRecord = RecipeImportJob & {
  extractionMethod?: string | null;
  provider?: string | null;
  confidence?: number | null;
};

const memoryById = new Map<string, RecipeImportRecord>();
const memoryByCanonical = new Map<string, string>();

export function resetRecipeImportStore(): void {
  memoryById.clear();
  memoryByCanonical.clear();
}

export async function getImportById(id: string): Promise<RecipeImportRecord | null> {
  const memory = memoryById.get(id);
  if (memory) return withRotatingLabel(memory);
  if (!persistToSupabase()) return null;
  const admin = createServiceClient();
  const { data, error } = await admin.from('recipe_imports').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  const record = rowToRecord(data as RecipeImportRow);
  memoryById.set(record.id, record);
  memoryByCanonical.set(record.canonicalUrl ?? record.inputUrl, record.id);
  return withRotatingLabel(record);
}

export async function getImportByCanonical(canonicalUrl: string): Promise<RecipeImportRecord | null> {
  const id = memoryByCanonical.get(canonicalUrl);
  if (id) {
    const record = memoryById.get(id);
    if (record) return withRotatingLabel(record);
  }
  if (!persistToSupabase()) return null;
  const admin = createServiceClient();
  const { data, error } = await admin.from('recipe_imports').select('*').eq('canonical_url', canonicalUrl).maybeSingle();
  if (error || !data) return null;
  const record = rowToRecord(data as RecipeImportRow);
  memoryById.set(record.id, record);
  memoryByCanonical.set(canonicalUrl, record.id);
  return withRotatingLabel(record);
}

export async function saveImport(record: RecipeImportRecord): Promise<RecipeImportRecord> {
  const next: RecipeImportRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };
  memoryById.set(next.id, next);
  if (next.canonicalUrl) memoryByCanonical.set(next.canonicalUrl, next.id);

  if (persistToSupabase()) {
    const admin = createServiceClient();
    await admin.from('recipe_imports').upsert({
      id: next.id,
      input_url: next.inputUrl,
      canonical_url: next.canonicalUrl ?? next.inputUrl,
      source_kind: next.sourceKind ?? null,
      status: next.status,
      progress: next.progress,
      phase_label: next.phaseLabel,
      error_code: next.errorCode ?? null,
      error_message: next.errorMessage ?? null,
      recipe: (next.recipe as never) ?? null,
      extraction_method: next.recipe?.extraction.method ?? next.extractionMethod ?? null,
      provider: next.recipe?.extraction.provider ?? next.provider ?? null,
      confidence: next.recipe?.extraction.confidence ?? next.confidence ?? null,
      created_at: next.createdAt,
      updated_at: next.updatedAt,
      expires_at: next.expiresAt,
      last_accessed_at: new Date().toISOString(),
    });
  }

  return withRotatingLabel(next);
}

function withRotatingLabel(record: RecipeImportRecord): RecipeImportRecord {
  if (record.status !== 'running' && record.status !== 'queued') return record;
  const started = Date.parse(record.createdAt);
  if (!Number.isFinite(started)) return record;
  const now = Date.now();
  const expires = Date.parse(record.expiresAt);
  const ttl = Number.isFinite(expires) ? Math.max(1, expires - started) : 180_000;
  const elapsed = Math.max(0, now - started);
  const soft = Math.min(90, 12 + Math.floor((elapsed / ttl) * 78));
  return {
    ...record,
    phaseLabel: rotatingProgressMessage(started, now),
    progress: Math.max(record.progress, soft),
  };
}

type RecipeImportRow = {
  id: string;
  input_url: string;
  canonical_url: string;
  source_kind: string | null;
  status: string;
  progress: number;
  phase_label: string;
  error_code: string | null;
  error_message: string | null;
  recipe: RecipeImportJob['recipe'] | null;
  extraction_method: string | null;
  provider: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

function rowToRecord(row: RecipeImportRow): RecipeImportRecord {
  return {
    id: row.id,
    status: row.status as RecipeImportJobStatus,
    sourceKind: (row.source_kind as RecipeImportJob['sourceKind']) ?? undefined,
    inputUrl: row.input_url,
    canonicalUrl: row.canonical_url,
    progress: row.progress,
    phaseLabel: row.phase_label,
    errorCode: (row.error_code as RecipeImportJob['errorCode']) ?? undefined,
    errorMessage: row.error_message ?? undefined,
    recipe: row.recipe ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    extractionMethod: row.extraction_method,
    provider: row.provider,
    confidence: row.confidence,
  };
}
