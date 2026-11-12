import { z } from 'zod';

import type { McpToolDefinition } from '../registry.js';
import type { McpCaller } from '../context.js';
import { getReadlist, recommendBooks, searchBooks } from './reads.js';
import { resolveCallerHousehold, withReadlistAudit } from './shared.js';
import {
  previewAddToReadlist,
  previewRemoveFromReadlist,
  previewUpdateReadlistStatus,
  type PreviewResult,
} from './writes.js';

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const destructiveAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: false,
} as const;

const previewResultSchema = z.object({
  kind: z.enum(['preview', 'dedupe', 'blocked', 'noop']),
  previewId: z.string().optional(),
  expiresAt: z.string().optional(),
  tool: z.string().optional(),
  summary: z.string(),
  steps: z.array(z.string()).optional(),
  candidates: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        detail: z.string().optional(),
      }),
    )
    .optional(),
  message: z.string().optional(),
  itemId: z.string().optional(),
});

const bookOut = z.object({
  entryId: z.string(),
  listId: z.string(),
  bookId: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  status: z.enum(['want_to_read', 'reading', 'finished']),
  statusLabel: z.string(),
  rating: z.number().nullable(),
  year: z.number().nullable(),
  coverUrl: z.string().nullable(),
});

const searchHitOut = z.object({
  bookId: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number().nullable(),
  coverUrl: z.string().nullable(),
  isbn: z.string().nullable(),
});

const recommendHitOut = searchHitOut.extend({
  reason: z.string(),
});

async function householdIdOrNull(caller: McpCaller): Promise<string | null> {
  try {
    return (await resolveCallerHousehold(caller.client, caller.userId)).householdId;
  } catch {
    return null;
  }
}

function asPreviewResult(value: PreviewResult): z.infer<typeof previewResultSchema> {
  return value;
}

async function auditedPreview(
  caller: McpCaller,
  tool: string,
  run: () => Promise<PreviewResult>,
): Promise<z.infer<typeof previewResultSchema>> {
  const householdId = await householdIdOrNull(caller);
  return withReadlistAudit(caller, { tool, mode: 'write', householdId }, async () =>
    asPreviewResult(await run()),
  );
}

const getReadlistInput = z.object({
  status: z.enum(['want_to_read', 'reading', 'finished']).optional(),
  limit: z.number().int().positive().max(100).optional(),
});
const getReadlistOutput = z.object({
  householdId: z.string(),
  groups: z.array(
    z.object({
      status: z.enum(['want_to_read', 'reading', 'finished']),
      label: z.string(),
      books: z.array(bookOut),
    }),
  ),
});

export const getReadlistTool: McpToolDefinition<typeof getReadlistInput, typeof getReadlistOutput> = {
  name: 'get_readlist',
  title: 'Get readlist',
  description:
    'Your books grouped by Want to read / Reading / Read. Optional status and limit filters.',
  inputSchema: getReadlistInput,
  outputSchema: getReadlistOutput,
  // Scopes are frozen per connection — reuse watchlists so existing users get these without reconnecting.
  scope: 'watchlists:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withReadlistAudit(caller, { tool: 'get_readlist', mode: 'read' }, () =>
      getReadlist(caller.client, caller.userId, args),
    ),
};

const searchBooksInput = z.object({
  query: z.string(),
  limit: z.number().int().positive().max(20).optional(),
});
const searchBooksOutput = z.object({
  householdId: z.string(),
  results: z.array(searchHitOut),
});

export const searchBooksTool: McpToolDefinition<typeof searchBooksInput, typeof searchBooksOutput> = {
  name: 'search_books',
  title: 'Search books',
  description:
    'Search the book catalogue and return stable book ids. Search or recommend first, then preview_add_to_readlist, then the user confirms via commit. Never invent titles.',
  inputSchema: searchBooksInput,
  outputSchema: searchBooksOutput,
  scope: 'watchlists:read',
  annotations: { ...readAnnotations, openWorldHint: true },
  handler: async (args, caller) =>
    withReadlistAudit(caller, { tool: 'search_books', mode: 'read' }, () =>
      searchBooks(caller.client, caller.userId, args),
    ),
};

const recommendBooksInput = z.object({
  limit: z.number().int().positive().max(20).optional(),
  based_on: z.array(z.string()).optional(),
});
const recommendBooksOutput = z.object({
  householdId: z.string(),
  results: z.array(recommendHitOut),
  reason: z.string().optional(),
});

export const recommendBooksTool: McpToolDefinition<typeof recommendBooksInput, typeof recommendBooksOutput> = {
  name: 'recommend_books',
  title: 'Recommend books',
  description:
    'Non-AI similar-author/subject picks from finished/highly rated books, skipping anything already on the list. Use based_on book ids to seed. Search or recommend first, then preview add, then commit.',
  inputSchema: recommendBooksInput,
  outputSchema: recommendBooksOutput,
  scope: 'watchlists:read',
  annotations: { ...readAnnotations, openWorldHint: true },
  handler: async (args, caller) =>
    withReadlistAudit(caller, { tool: 'recommend_books', mode: 'read' }, () =>
      recommendBooks(caller.client, caller.userId, {
        limit: args.limit,
        basedOn: args.based_on,
      }),
    ),
};

const addToReadlistInput = z.object({
  bookIds: z.array(z.string()).min(1),
  status: z.enum(['want_to_read', 'reading', 'finished']).optional(),
});

export const previewAddToReadlistTool: McpToolDefinition<typeof addToReadlistInput, typeof previewResultSchema> = {
  name: 'preview_add_to_readlist',
  title: 'Preview add to readlist',
  description:
    'Preview adding book ids from search_books/recommend_books (default want_to_read). Several ids share one preview/commit. Drops unresolvable ids; skips duplicates.',
  inputSchema: addToReadlistInput,
  outputSchema: previewResultSchema,
  scope: 'watchlists:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_add_to_readlist', () => previewAddToReadlist(caller, args)),
};

const updateStatusInput = z.object({
  entryId: z.string(),
  status: z.enum(['want_to_read', 'reading', 'finished']),
});

export const previewUpdateReadlistStatusTool: McpToolDefinition<
  typeof updateStatusInput,
  typeof previewResultSchema
> = {
  name: 'preview_update_readlist_status',
  title: 'Preview update readlist status',
  description: 'Preview changing an entry status. User confirms via commit.',
  inputSchema: updateStatusInput,
  outputSchema: previewResultSchema,
  scope: 'watchlists:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_update_readlist_status', () =>
      previewUpdateReadlistStatus(caller, args),
    ),
};

const removeInput = z.object({ entryId: z.string() });

export const previewRemoveFromReadlistTool: McpToolDefinition<typeof removeInput, typeof previewResultSchema> = {
  name: 'preview_remove_from_readlist',
  title: 'Preview remove from readlist',
  description: 'Preview removing an entry. User confirms via commit.',
  inputSchema: removeInput,
  outputSchema: previewResultSchema,
  scope: 'watchlists:write',
  annotations: destructiveAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_remove_from_readlist', () =>
      previewRemoveFromReadlist(caller, args),
    ),
};

export const READLIST_MCP_TOOLS = [
  getReadlistTool,
  searchBooksTool,
  recommendBooksTool,
  previewAddToReadlistTool,
  previewUpdateReadlistStatusTool,
  previewRemoveFromReadlistTool,
] as const;
