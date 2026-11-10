import { describe, expect, it, vi } from 'vitest';

import { normalizeRecipeUrl } from '@kinexus/domain';

import { processRecipeImport } from './pipeline.js';
import { getImportById, resetRecipeImportStore, saveImport } from './store.js';

describe('recipe import when AI is blocked', () => {
  it('returns non-AI JSON-LD data with aiBlocked when structuring is skipped', async () => {
    resetRecipeImportStore();
    const normalized = normalizeRecipeUrl('https://example.com/pie');
    const id = 'import-blocked-1';
    await saveImport({
      id,
      status: 'queued',
      sourceKind: 'web',
      inputUrl: normalized.inputUrl,
      canonicalUrl: normalized.canonicalUrl,
      progress: 0,
      phaseLabel: 'Queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      requestUserId: 'u1',
      requestHouseholdId: 'h1',
    });

    // Incomplete JSON-LD (no instructions) would normally fall through to LLM.
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">
      ${JSON.stringify({
        '@type': 'Recipe',
        name: 'Apple Pie',
        recipeIngredient: ['2 apples', '1 crust'],
      })}
      </script>
    </head><body></body></html>`;

    await processRecipeImport(id, normalized, {
      aiContext: { userId: 'u1', householdId: 'h1' },
      fetch: async () => new Response(html, { status: 200 }),
      structure: async () => ({ ok: false, reason: 'ai_blocked', blocked: 'no_access' }),
    });

    const job = await getImportById(id);
    expect(job?.status).toBe('succeeded');
    expect(job?.recipe?.title).toBe('Apple Pie');
    expect(job?.aiBlocked).toBe('no_access');
  });

  it('fails with ai_key_paused when blocked and nothing non-AI was extracted', async () => {
    resetRecipeImportStore();
    const structure = vi.fn(async () => ({
      ok: false as const,
      reason: 'ai_blocked' as const,
      blocked: 'key_paused' as const,
    }));
    const normalized = normalizeRecipeUrl('https://example.com/empty');
    const id = 'import-blocked-2';
    await saveImport({
      id,
      status: 'queued',
      sourceKind: 'web',
      inputUrl: normalized.inputUrl,
      canonicalUrl: normalized.canonicalUrl,
      progress: 0,
      phaseLabel: 'Queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await processRecipeImport(id, normalized, {
      fetch: async () => new Response('<html><body>hello</body></html>', { status: 200 }),
      structure,
    });

    const job = await getImportById(id);
    expect(structure).toHaveBeenCalled();
    expect(job?.status).toBe('failed');
    expect(job?.errorCode).toBe('ai_key_paused');
  });
});
