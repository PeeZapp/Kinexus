/**
 * One-off: AI-tag catalog recipes with allergens + equipment.
 *
 * Dry-run by default (prints summary + writes review JSON). Apply high-confidence
 * writes with --apply.
 *
 *   pnpm --filter @kinexus/api exec tsx scripts/tag-catalog-food-tags.ts
 *   pnpm --filter @kinexus/api exec tsx scripts/tag-catalog-food-tags.ts --apply
 *   pnpm --filter @kinexus/api exec tsx scripts/tag-catalog-food-tags.ts --limit=20
 *
 * Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and a platform AI key
 * (ANTHROPIC_API_KEY / OPENAI_API_KEY / …).
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALLERGEN_OPTIONS, EQUIPMENT_OPTIONS, knownAllergenId, knownEquipmentId, normalizeFoodTags } from '@kinexus/domain';

import { createPlatformAiClient } from '../src/ai/registry.js';
import { parseJsonObject } from '../src/recipe-draft.js';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../../.env') });
loadEnv({ path: resolve(here, '../../../apps/kinexus/.env') });
loadEnv({ path: resolve(here, '../.env') });

const apply = process.argv.includes('--apply');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : null;

const supabaseUrl =
  process.env.SUPABASE_URL?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ALLERGEN_IDS = ALLERGEN_OPTIONS.map((o) => o.id).join(', ');
const EQUIPMENT_IDS = EQUIPMENT_OPTIONS.map((o) => o.id).join(', ');

type CatalogRow = {
  id: string;
  name: string;
  ingredients: unknown;
  method: unknown;
  allergens: string[] | null;
  equipment: string[] | null;
};

type TagResult = {
  allergens: string[];
  equipment: string[];
  confidence: 'high' | 'unsure';
  notes?: string;
};

type ReviewRow = {
  id: string;
  name: string;
  suggestedAllergens: string[];
  suggestedEquipment: string[];
  confidence: 'high' | 'unsure';
  notes?: string;
  reason: string;
};

function ingredientLines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      const rec = item as Record<string, unknown>;
      const name = String(rec.name ?? '').trim();
      const amount = String(rec.amount ?? '').trim();
      return [amount, name].filter(Boolean).join(' ').trim();
    })
    .filter(Boolean)
    .slice(0, 40);
}

function methodLines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      const rec = item as Record<string, unknown>;
      return String(rec.text ?? rec.name ?? '').trim();
    })
    .filter(Boolean)
    .slice(0, 30);
}

function normalizeTags(value: unknown, resolve: (raw: string) => string | null): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const id = resolve(String(item ?? ''));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function mergeTags(existing: string[] | null | undefined, next: string[]): string[] {
  return normalizeFoodTags([...(existing ?? []), ...next]);
}

async function tagRecipe(client: ReturnType<typeof createPlatformAiClient>, row: CatalogRow): Promise<TagResult> {
  const ingredients = ingredientLines(row.ingredients);
  const method = methodLines(row.method);
  const prompt = `Tag this recipe for household meal filters. Return ONLY JSON:
{
  "allergens": string[],  // subset of [${ALLERGEN_IDS}] — only allergens the dish CONTAINS
  "equipment": string[],  // subset of [${EQUIPMENT_IDS}] — only special equipment clearly required
  "confidence": "high" | "unsure",
  "notes": string // short reason when unsure; omit when high
}

Rules:
- Allergens: tag only when clearly present in ingredients. Empty array if none.
- Equipment: omit stovetop/pan/knife/basic kitchenware. Empty array if only basics.
- Use confidence "unsure" when ingredients/method are thin or you cannot tell.
- Never invent tags outside the allowed ids.

Recipe name: ${row.name}
Ingredients:
${ingredients.map((line) => `- ${line}`).join('\n') || '(none)'}
Method:
${method.map((line, i) => `${i + 1}. ${line}`).join('\n') || '(none)'}`;

  const text = await client.complete({ prompt, json: true });
  const parsed = parseJsonObject(text);
  const confidence = parsed.confidence === 'high' ? 'high' : 'unsure';
  return {
    allergens: normalizeTags(parsed.allergens, knownAllergenId),
    equipment: normalizeTags(parsed.equipment, knownEquipmentId),
    confidence,
    notes: typeof parsed.notes === 'string' ? parsed.notes.trim() || undefined : undefined,
  };
}

async function main() {
  const client = createPlatformAiClient();

  let query = admin
    .from('recipes')
    .select('id,name,ingredients,method,allergens,equipment')
    .is('household_id', null)
    .eq('removed', false)
    .order('name', { ascending: true });
  if (limit != null && Number.isFinite(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as CatalogRow[];
  console.log(`Catalog recipes: ${rows.length}${apply ? ' (apply)' : ' (dry-run)'}`);

  const applied: ReviewRow[] = [];
  const unsure: ReviewRow[] = [];
  const failed: { id: string; name: string; error: string }[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    process.stdout.write(`[${i + 1}/${rows.length}] ${row.name}… `);
    try {
      const tagged = await tagRecipe(client, row);
      const review: ReviewRow = {
        id: row.id,
        name: row.name,
        suggestedAllergens: tagged.allergens,
        suggestedEquipment: tagged.equipment,
        confidence: tagged.confidence,
        notes: tagged.notes,
        reason:
          tagged.confidence === 'high'
            ? 'high confidence'
            : tagged.notes || 'model marked unsure',
      };

      if (tagged.confidence !== 'high') {
        unsure.push(review);
        console.log('unsure');
        continue;
      }

      if (apply) {
        const allergens = mergeTags(row.allergens, tagged.allergens);
        const equipment = mergeTags(row.equipment, tagged.equipment);
        const { error: updateError } = await admin
          .from('recipes')
          .update({ allergens, equipment })
          .eq('id', row.id)
          .is('household_id', null);
        if (updateError) throw updateError;
      }
      applied.push(review);
      console.log(
        `high allergens=[${tagged.allergens.join(',')}] equipment=[${tagged.equipment.join(',')}]`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ id: row.id, name: row.name, error: message });
      console.log(`fail: ${message}`);
    }
  }

  const outDir = resolve(here, '../../../.tmp');
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, 'catalog-food-tags-review.json');
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        apply,
        appliedCount: applied.length,
        unsureCount: unsure.length,
        failedCount: failed.length,
        applied,
        unsure,
        failed,
      },
      null,
      2,
    ),
  );

  console.log('\nDone');
  console.log(`High confidence: ${applied.length}${apply ? ' written' : ' (dry-run, not written)'}`);
  console.log(`Unsure (needs your approval): ${unsure.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Review file: ${outPath}`);
  if (unsure.length) {
    console.log('\nUnsure recipes:');
    for (const row of unsure) {
      console.log(
        `- ${row.name} (${row.id}) allergens=[${row.suggestedAllergens.join(',')}] equipment=[${row.suggestedEquipment.join(',')}] ${row.reason}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
