import type { BookWork, ReadStatus } from '@kinexus/domain';

import { getBookProvider } from '../../books/compose.js';
import type { McpCaller } from '../context.js';
import { createWritePreview, commitWritePreview } from '../preview.js';
import { loadReadlistPeopleMap, toReadlistList } from './reads.js';
import {
  BOOK_NOT_FOUND,
  READLIST_ITEM_NOT_FOUND,
  WRITE_DENIED,
  accessOpts,
  assertCanManageReadlist,
  looksLikeUuid,
  parseReadStatus,
  resolveCallerHousehold,
  resolveCallerPersonId,
} from './shared.js';

export type ReadlistWriteAction =
  | {
      action: 'add_to_readlist';
      listId: string;
      status: ReadStatus;
      books: { bookId: string; title: string }[];
      notes: string[];
    }
  | {
      action: 'update_readlist_status';
      entryId: string;
      status: ReadStatus;
      title: string;
    }
  | {
      action: 'remove_from_readlist';
      entryId: string;
      title: string;
    };

export type PreviewResult =
  | {
      kind: 'preview';
      previewId: string;
      expiresAt: string;
      tool: string;
      summary: string;
      steps: string[];
    }
  | {
      kind: 'dedupe';
      summary: string;
      candidates: { id: string; name: string; detail?: string }[];
      message: string;
    }
  | {
      kind: 'blocked';
      summary: string;
      message: string;
    }
  | {
      kind: 'noop';
      summary: string;
      message: string;
      itemId?: string;
    };

async function savePreview(
  caller: McpCaller,
  householdId: string,
  tool: string,
  payload: ReadlistWriteAction,
  summary: string,
  steps: string[],
): Promise<PreviewResult> {
  const { previewId, expiresAt } = await createWritePreview(caller.client, {
    userId: caller.userId,
    householdId,
    clientId: caller.clientId,
    tool,
    payload,
  });
  return { kind: 'preview', previewId, expiresAt, tool, summary, steps };
}

function bookWorkPayload(work: BookWork) {
  return {
    id: work.id,
    title: work.title,
    authors: work.authors,
    firstPublishedYear: work.firstPublishedYear,
    coverUrl: work.coverUrl,
    ids: work.ids,
    editions: work.editions.map((edition) => ({
      id: edition.id,
      workId: edition.workId,
      title: edition.title,
      format: edition.format,
      pageCount: edition.pageCount,
      publishedYear: edition.publishedYear,
      publisher: edition.publisher,
      ids: edition.ids,
    })),
  };
}

export async function resolveCatalogWorkId(
  caller: McpCaller,
  bookId: string,
): Promise<{ catalogWorkId: string; title: string } | null> {
  const client = caller.client;
  if (looksLikeUuid(bookId)) {
    const { data: existing } = await client
      .from('readlist_works')
      .select('id, title')
      .eq('id', bookId)
      .maybeSingle();
    if (existing?.id) {
      return {
        catalogWorkId: String(existing.id),
        title: typeof existing.title === 'string' ? existing.title : 'Book',
      };
    }
  }

  const { data: byOl } = await client
    .from('readlist_works')
    .select('id, title')
    .eq('ol_work_id', bookId)
    .maybeSingle();
  if (byOl?.id) {
    return {
      catalogWorkId: String(byOl.id),
      title: typeof byOl.title === 'string' ? byOl.title : 'Book',
    };
  }

  const work = await getBookProvider().lookupWork(bookId).catch(() => null);
  if (!work) return null;
  return { catalogWorkId: work.id, title: work.title };
}

async function ensureDefaultListId(caller: McpCaller, householdId: string): Promise<string> {
  const { data, error } = await caller.client.rpc('ensure_default_readlist', {
    p_household_id: householdId,
  });
  if (error) throw new Error(error.message);
  if (typeof data !== 'string' || !data) throw new Error('Could not ensure default readlist');
  return data;
}

async function loadDefaultListOrThrow(caller: McpCaller, householdId: string, role: string) {
  const personId = await resolveCallerPersonId(caller.client, householdId, caller.userId);
  const opts = accessOpts(role, caller.userId, personId);
  const listId = await ensureDefaultListId(caller, householdId);
  const peopleMap = await loadReadlistPeopleMap(caller.client, householdId);
  const { data, error } = await caller.client.from('readlist_lists').select('*').eq('id', listId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(WRITE_DENIED);
  const list = toReadlistList(data as Record<string, unknown>, peopleMap.get(listId) ?? []);
  assertCanManageReadlist(list, opts);
  return list;
}

async function listedWorkKeys(
  caller: McpCaller,
  listId: string,
): Promise<Set<string>> {
  const { data: items, error } = await caller.client
    .from('readlist_items')
    .select('work_id')
    .eq('list_id', listId);
  if (error) throw new Error(error.message);
  const workIds = (items ?? []).map((row) => String((row as { work_id: string }).work_id));
  const keys = new Set<string>(workIds.map((id) => id.toUpperCase()));
  if (workIds.length === 0) return keys;
  const { data: works, error: worksError } = await caller.client
    .from('readlist_works')
    .select('id, ol_work_id')
    .in('id', workIds);
  if (worksError) throw new Error(worksError.message);
  for (const work of works ?? []) {
    keys.add(String((work as { id: string }).id).toUpperCase());
    const ol = (work as { ol_work_id?: string | null }).ol_work_id;
    if (typeof ol === 'string' && ol) keys.add(ol.toUpperCase());
  }
  return keys;
}

export async function previewAddToReadlist(
  caller: McpCaller,
  input: { bookIds: string[]; status?: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  const list = await loadDefaultListOrThrow(caller, householdId, role);
  const status = parseReadStatus(input.status, 'want_to_read');
  const bookIds = [...new Set((input.bookIds ?? []).map((id) => id.trim()).filter(Boolean))];
  if (bookIds.length === 0) {
    return { kind: 'blocked', summary: 'No books to add', message: 'Provide at least one book id from search_books or recommend_books' };
  }

  const already = await listedWorkKeys(caller, list.id);
  const books: { bookId: string; title: string }[] = [];
  const notes: string[] = [];
  const seen = new Set<string>();

  for (const bookId of bookIds) {
    if (seen.has(bookId.toUpperCase())) {
      notes.push(`Skipped duplicate id ${bookId}`);
      continue;
    }
    seen.add(bookId.toUpperCase());

    const resolved = await resolveCatalogWorkId(caller, bookId);
    if (!resolved) {
      notes.push(`Dropped unresolvable id ${bookId}`);
      continue;
    }
    if (already.has(resolved.catalogWorkId.toUpperCase()) || already.has(bookId.toUpperCase())) {
      notes.push(`Skipped "${resolved.title}" — already on your readlist`);
      continue;
    }
    books.push({ bookId, title: resolved.title });
    already.add(resolved.catalogWorkId.toUpperCase());
    already.add(bookId.toUpperCase());
  }

  if (books.length === 0) {
    return {
      kind: 'noop',
      summary: 'Nothing to add',
      message: notes.join('; ') || 'No resolvable books to add',
    };
  }

  const steps = [
    ...books.map((book) => `Add "${book.title}" as ${status}`),
    ...notes,
  ];
  return savePreview(
    caller,
    householdId,
    'preview_add_to_readlist',
    { action: 'add_to_readlist', listId: list.id, status, books, notes },
    `Add ${books.length} book(s) to your readlist`,
    steps,
  );
}

export async function previewUpdateReadlistStatus(
  caller: McpCaller,
  input: { entryId: string; status: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  const personId = await resolveCallerPersonId(caller.client, householdId, caller.userId);
  const opts = accessOpts(role, caller.userId, personId);
  const status = parseReadStatus(input.status);

  const { data: item, error } = await caller.client
    .from('readlist_items')
    .select('*')
    .eq('id', input.entryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) throw new Error(READLIST_ITEM_NOT_FOUND);

  const peopleMap = await loadReadlistPeopleMap(caller.client, householdId);
  const { data: listRow, error: listError } = await caller.client
    .from('readlist_lists')
    .select('*')
    .eq('id', String((item as { list_id: string }).list_id))
    .maybeSingle();
  if (listError) throw new Error(listError.message);
  if (!listRow || String((listRow as { household_id: string }).household_id) !== householdId) {
    throw new Error(READLIST_ITEM_NOT_FOUND);
  }
  const list = toReadlistList(listRow as Record<string, unknown>, peopleMap.get(String((listRow as { id: string }).id)) ?? []);
  assertCanManageReadlist(list, opts);

  const { data: work } = await caller.client
    .from('readlist_works')
    .select('title')
    .eq('id', String((item as { work_id: string }).work_id))
    .maybeSingle();
  const title = typeof work?.title === 'string' ? work.title : 'Book';

  if (String((item as { status: string }).status) === status) {
    return {
      kind: 'noop',
      summary: `"${title}" is already ${status}`,
      message: 'No change needed',
      itemId: String((item as { id: string }).id),
    };
  }

  return savePreview(
    caller,
    householdId,
    'preview_update_readlist_status',
    {
      action: 'update_readlist_status',
      entryId: String((item as { id: string }).id),
      status,
      title,
    },
    `Mark "${title}" as ${status}`,
    [`Update status to ${status}`],
  );
}

export async function previewRemoveFromReadlist(
  caller: McpCaller,
  input: { entryId: string },
): Promise<PreviewResult> {
  const { householdId, role } = await resolveCallerHousehold(caller.client, caller.userId);
  const personId = await resolveCallerPersonId(caller.client, householdId, caller.userId);
  const opts = accessOpts(role, caller.userId, personId);

  const { data: item, error } = await caller.client
    .from('readlist_items')
    .select('*')
    .eq('id', input.entryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) throw new Error(READLIST_ITEM_NOT_FOUND);

  const peopleMap = await loadReadlistPeopleMap(caller.client, householdId);
  const { data: listRow, error: listError } = await caller.client
    .from('readlist_lists')
    .select('*')
    .eq('id', String((item as { list_id: string }).list_id))
    .maybeSingle();
  if (listError) throw new Error(listError.message);
  if (!listRow || String((listRow as { household_id: string }).household_id) !== householdId) {
    throw new Error(READLIST_ITEM_NOT_FOUND);
  }
  const list = toReadlistList(listRow as Record<string, unknown>, peopleMap.get(String((listRow as { id: string }).id)) ?? []);
  assertCanManageReadlist(list, opts);

  const { data: work } = await caller.client
    .from('readlist_works')
    .select('title')
    .eq('id', String((item as { work_id: string }).work_id))
    .maybeSingle();
  const title = typeof work?.title === 'string' ? work.title : 'Book';

  return savePreview(
    caller,
    householdId,
    'preview_remove_from_readlist',
    {
      action: 'remove_from_readlist',
      entryId: String((item as { id: string }).id),
      title,
    },
    `Remove "${title}" from your readlist`,
    [`Delete entry ${String((item as { id: string }).id)}`],
  );
}

async function upsertWorkFromBookId(caller: McpCaller, bookId: string): Promise<{ catalogWorkId: string; title: string }> {
  const client = caller.client;
  if (looksLikeUuid(bookId)) {
    const { data: existing } = await client.from('readlist_works').select('id, title').eq('id', bookId).maybeSingle();
    if (existing?.id) {
      return {
        catalogWorkId: String(existing.id),
        title: typeof existing.title === 'string' ? existing.title : 'Book',
      };
    }
  }
  const { data: byOl } = await client
    .from('readlist_works')
    .select('id, title')
    .eq('ol_work_id', bookId)
    .maybeSingle();
  if (byOl?.id) {
    return {
      catalogWorkId: String(byOl.id),
      title: typeof byOl.title === 'string' ? byOl.title : 'Book',
    };
  }

  const work = await getBookProvider().lookupWork(bookId);
  if (!work) throw new Error(BOOK_NOT_FOUND);
  const { data, error } = await client.rpc('upsert_readlist_work', {
    p_work: bookWorkPayload(work),
  });
  if (error) throw new Error(error.message);
  if (typeof data !== 'string' || !data) throw new Error('Could not save work');
  return { catalogWorkId: data, title: work.title };
}

async function peekPreviewTool(client: McpCaller['client'], userId: string, previewId: string): Promise<string> {
  const { data, error } = await client
    .from('mcp_previews')
    .select('tool')
    .eq('id', previewId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.tool) throw new Error('Preview missing');
  return data.tool as string;
}

async function executeWrite(
  caller: McpCaller,
  payload: ReadlistWriteAction,
): Promise<{ affectedIds: string[]; result: Record<string, unknown> }> {
  switch (payload.action) {
    case 'add_to_readlist': {
      const affectedIds: string[] = [];
      const added: { bookId: string; itemId: string; title: string }[] = [];
      for (const book of payload.books) {
        const { catalogWorkId, title } = await upsertWorkFromBookId(caller, book.bookId);
        const { data, error } = await caller.client.rpc('add_readlist_item', {
          p_list_id: payload.listId,
          p_work_id: catalogWorkId,
          p_preferred_edition_id: null,
          p_status: payload.status,
        });
        if (error) throw new Error(error.message);
        const itemId = String(data);
        affectedIds.push(itemId);
        added.push({ bookId: book.bookId, itemId, title });
      }
      return {
        affectedIds,
        result: { added, notes: payload.notes, status: payload.status, listId: payload.listId },
      };
    }
    case 'update_readlist_status': {
      const { data, error } = await caller.client.rpc('set_readlist_item_status', {
        p_item_id: payload.entryId,
        p_status: payload.status,
      });
      if (error) throw new Error(error.message);
      return {
        affectedIds: [payload.entryId],
        result: { itemId: data ?? payload.entryId, status: payload.status, title: payload.title },
      };
    }
    case 'remove_from_readlist': {
      const { error } = await caller.client.rpc('remove_readlist_item', {
        p_item_id: payload.entryId,
      });
      if (error) throw new Error(error.message);
      return {
        affectedIds: [payload.entryId],
        result: { deleted: payload.entryId, title: payload.title },
      };
    }
    default: {
      const _exhaustive: never = payload;
      throw new Error(`Unknown readlist action ${(_exhaustive as { action: string }).action}`);
    }
  }
}

export async function commitReadlistPreview(
  caller: McpCaller,
  input: { previewId: string },
): Promise<{
  ok: true;
  tool: string;
  affectedIds: string[];
  result: Record<string, unknown>;
}> {
  await resolveCallerHousehold(caller.client, caller.userId);
  if (!input.previewId) throw new Error('previewId is required');

  const tool = await peekPreviewTool(caller.client, caller.userId, input.previewId);
  const committed = await commitWritePreview(caller.client, {
    userId: caller.userId,
    previewId: input.previewId,
    tool,
  });
  if (!committed.ok) throw new Error(`Preview ${committed.reason}`);

  const payload = committed.preview.payload as ReadlistWriteAction;
  const executed = await executeWrite(caller, payload);
  return {
    ok: true,
    tool: committed.preview.tool,
    affectedIds: executed.affectedIds,
    result: executed.result,
  };
}

export const READLIST_PREVIEW_TOOLS = [
  'preview_add_to_readlist',
  'preview_update_readlist_status',
  'preview_remove_from_readlist',
] as const;
