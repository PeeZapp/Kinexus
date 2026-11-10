import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();
const lookupWork = vi.fn();

vi.mock('../auth.js', () => ({
  readBearerToken: () => 'token',
  createUserClient: () => ({ rpc, from }),
}));

vi.mock('../books/compose.js', () => ({
  getBookProvider: () => ({ lookupWork }),
}));

import {
  handleAddReadlistItem,
  handleCreateReadlistList,
  handleDeleteReadlistList,
  handleEnsureDefaultReadlist,
  handleRenameReadlistList,
  handleUpsertReadlistProgress,
  handleUpsertReadlistReview,
} from './handlers.js';

const request = new Request('http://localhost/readlist', {
  headers: { Authorization: 'Bearer token' },
});

describe('readlist handlers', () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    lookupWork.mockReset();
  });

  it('ensures default list via RPC', async () => {
    rpc.mockResolvedValueOnce({ data: 'list-1', error: null });
    const result = await handleEnsureDefaultReadlist('user-1', { householdId: 'hh-1' }, request);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ listId: 'list-1' });
    expect(rpc).toHaveBeenCalledWith('ensure_default_readlist', { p_household_id: 'hh-1' });
  });

  it('creates a readlist via RPC', async () => {
    rpc.mockResolvedValueOnce({ data: 'list-2', error: null });
    const result = await handleCreateReadlistList(
      'user-1',
      { householdId: 'hh-1', name: 'Book club', visibility: 'household', personIds: [] },
      request,
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ listId: 'list-2' });
    expect(rpc).toHaveBeenCalledWith('create_readlist_list', {
      p_household_id: 'hh-1',
      p_name: 'Book club',
      p_visibility: 'household',
      p_person_ids: [],
    });
  });

  it('renames a readlist via RPC', async () => {
    rpc.mockResolvedValueOnce({ data: 'list-2', error: null });
    const result = await handleRenameReadlistList(
      'user-1',
      { listId: 'list-2', name: 'Club picks' },
      request,
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ listId: 'list-2' });
    expect(rpc).toHaveBeenCalledWith('rename_readlist_list', {
      p_list_id: 'list-2',
      p_name: 'Club picks',
    });
  });

  it('deletes a readlist via RPC', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    const result = await handleDeleteReadlistList('user-1', { listId: 'list-2' }, request);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('delete_readlist_list', { p_list_id: 'list-2' });
  });

  it('surfaces list delete errors from RPC', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Cannot manage this readlist' } });
    const result = await handleDeleteReadlistList('user-1', { listId: 'list-1' }, request);
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: 'Cannot manage this readlist' });
  });

  it('resolves open library work ids before writing reviews', async () => {
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: 'work-uuid' }, error: null }),
        }),
      }),
    });
    rpc.mockResolvedValueOnce({ data: 'review-1', error: null });

    const result = await handleUpsertReadlistReview(
      'user-1',
      { workId: 'OL16052316W', score: 8 },
      request,
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ reviewId: 'review-1' });
    expect(rpc).toHaveBeenCalledWith('upsert_readlist_review', {
      p_work_id: 'work-uuid',
      p_score: 8,
      p_body: null,
    });
  });

  it('upserts catalog work then adds item', async () => {
    lookupWork.mockResolvedValueOnce({
      id: 'OL82563W',
      title: 'The Hobbit',
      authors: [{ name: 'Tolkien', openLibraryAuthorId: null }],
      firstPublishedYear: 1937,
      blurb: null,
      coverUrl: null,
      subjects: [],
      ids: {
        isbn10: null,
        isbn13: '9780547928227',
        openLibraryWorkId: 'OL82563W',
        openLibraryEditionId: null,
        hardcoverId: null,
        googleVolumeId: null,
        goodreadsId: null,
        asin: null,
      },
      editions: [
        {
          id: 'OL24331121M',
          workId: 'OL82563W',
          title: 'The Hobbit',
          format: 'print',
          pageCount: 300,
          publishedYear: 2012,
          publisher: null,
          language: null,
          coverUrl: null,
          blurb: null,
          ids: {
            isbn10: null,
            isbn13: '9780547928227',
            openLibraryWorkId: 'OL82563W',
            openLibraryEditionId: 'OL24331121M',
            hardcoverId: null,
            googleVolumeId: null,
            goodreadsId: null,
            asin: null,
          },
        },
      ],
    });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    });
    rpc
      .mockResolvedValueOnce({ data: 'work-uuid', error: null })
      .mockResolvedValueOnce({ data: 'item-uuid', error: null });

    const result = await handleAddReadlistItem(
      'user-1',
      { listId: 'list-1', workId: 'OL82563W', status: 'want_to_read' },
      request,
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ itemId: 'item-uuid', workId: 'work-uuid' });
    expect(rpc.mock.calls[0]?.[0]).toBe('upsert_readlist_work');
    expect(rpc.mock.calls[1]?.[0]).toBe('add_readlist_item');
  });

  it('adds an existing readlist work by uuid without catalog lookup', async () => {
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: 'work-uuid' }, error: null }),
        }),
      }),
    });
    rpc.mockResolvedValueOnce({ data: 'item-uuid', error: null });

    const result = await handleAddReadlistItem(
      'user-1',
      { listId: 'list-1', workId: 'work-uuid', status: 'want_to_read' },
      request,
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ itemId: 'item-uuid', workId: 'work-uuid' });
    expect(lookupWork).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('add_readlist_item', {
      p_list_id: 'list-1',
      p_work_id: 'work-uuid',
      p_preferred_edition_id: null,
      p_status: 'want_to_read',
    });
  });

  it('rejects out-of-range review scores', async () => {
    const result = await handleUpsertReadlistReview(
      'user-1',
      { workId: 'work-uuid', score: 11 },
      request,
    );
    expect(result.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('writes progress via RPC', async () => {
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: 'work-uuid' }, error: null }),
        }),
      }),
    });
    rpc.mockResolvedValueOnce({ data: 'progress-1', error: null });
    const result = await handleUpsertReadlistProgress(
      'user-1',
      { workId: 'work-uuid', pagesRead: 40, percent: 20, secondsListened: 120 },
      request,
    );
    expect(result.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('upsert_readlist_progress', {
      p_work_id: 'work-uuid',
      p_edition_id: null,
      p_pages_read: 40,
      p_percent: 20,
      p_seconds_listened: 120,
    });
  });
});
