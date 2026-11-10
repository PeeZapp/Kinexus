import { describe, expect, it } from 'vitest';

import { emptyBookExternalIds, type BookSearchHit, type ReadlistItem } from '@kinexus/domain';

import {
  addOrOpenWork,
  dedupeFinishedItems,
  findEntryForHit,
  setLocalEdition,
  setLocalStatus,
  shelfCounts,
  shouldResolveBookQuery,
  showProgressSlider,
  sortReadlistLists,
  type LocalReadlistState,
} from '@/src/features/readlist/readlist-model';

function item(partial: Partial<ReadlistItem> & Pick<ReadlistItem, 'id' | 'workId' | 'status'>): ReadlistItem {
  return {
    listId: 'list-1',
    preferredEditionId: null,
    addedBy: null,
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function hit(partial: Partial<BookSearchHit> & Pick<BookSearchHit, 'workId' | 'title'>): BookSearchHit {
  return {
    authors: ['Tolkien'],
    firstPublishedYear: 1937,
    coverUrl: null,
    editionCount: 1,
    ids: {
      ...emptyBookExternalIds(),
      openLibraryWorkId: partial.workId,
    },
    ...partial,
  };
}

describe('dedupeFinishedItems', () => {
  it('keeps one finished item per work', () => {
    const items = dedupeFinishedItems([
      item({ id: '1', workId: 'w1', status: 'finished', updatedAt: '2026-01-01' }),
      item({ id: '2', workId: 'w1', status: 'finished', updatedAt: '2026-02-01' }),
      item({ id: '3', workId: 'w2', status: 'want_to_read' }),
      item({ id: '4', workId: 'w3', status: 'finished', updatedAt: '2026-01-15' }),
    ]);
    expect(items.map((row) => row.id).sort()).toEqual(['2', '4']);
  });
});

describe('shelfCounts', () => {
  it('renders the right counts per shelf', () => {
    const counts = shelfCounts([
      item({ id: '1', workId: 'w1', status: 'want_to_read' }),
      item({ id: '2', workId: 'w2', status: 'want_to_read' }),
      item({ id: '3', workId: 'w3', status: 'reading' }),
      item({ id: '4', workId: 'w4', status: 'finished' }),
      item({ id: '5', workId: 'w5', status: 'finished' }),
      item({ id: '6', workId: 'w6', status: 'finished' }),
    ]);
    expect(counts).toEqual({ want_to_read: 2, reading: 1, finished: 3 });
  });

  it('counts shelves within one selected list', () => {
    const selected = [
      item({ id: '1', listId: 'list-a', workId: 'w1', status: 'want_to_read' }),
      item({ id: '2', listId: 'list-a', workId: 'w2', status: 'reading' }),
      item({ id: '3', listId: 'list-a', workId: 'w3', status: 'finished' }),
    ];
    expect(shelfCounts(selected)).toEqual({ want_to_read: 1, reading: 1, finished: 1 });
  });
});

describe('sortReadlistLists', () => {
  it('puts the default list first, then A–Z', () => {
    const sorted = sortReadlistLists([
      { id: 'b', name: 'Book club', isDefault: false },
      { id: 'd', name: 'Reading list', isDefault: true },
      { id: 'a', name: 'A shelf', isDefault: false },
    ]);
    expect(sorted.map((list) => list.id)).toEqual(['d', 'a', 'b']);
  });
});

describe('shouldResolveBookQuery', () => {
  it('routes pasted ISBN to resolve-url', () => {
    expect(shouldResolveBookQuery('9780306406157')).toBe(true);
    expect(shouldResolveBookQuery('0-306-40615-2')).toBe(true);
  });

  it('routes book URLs to resolve-url', () => {
    expect(shouldResolveBookQuery('https://openlibrary.org/works/OL45804W')).toBe(true);
  });

  it('keeps plain title search on /books/search', () => {
    expect(shouldResolveBookQuery('The Hobbit')).toBe(false);
  });
});

describe('showProgressSlider', () => {
  it('is hidden unless Reading', () => {
    expect(showProgressSlider('want_to_read')).toBe(false);
    expect(showProgressSlider('finished')).toBe(false);
    expect(showProgressSlider('reading')).toBe(true);
  });
});

describe('one item per work', () => {
  it('search→add→Reading→progress→Finished keeps one item; audiobook edition does not duplicate', () => {
    let state: LocalReadlistState = { items: [] };

    const added = addOrOpenWork(state, { listId: 'list-1', workId: 'work-hobbit' });
    state = added.state;
    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.status).toBe('want_to_read');

    state = setLocalStatus(state, state.items[0]!.id, 'reading');
    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.status).toBe('reading');

    state = setLocalEdition(state, state.items[0]!.id, 'edition-print');
    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.preferredEditionId).toBe('edition-print');

    const audio = addOrOpenWork(state, {
      listId: 'list-1',
      workId: 'work-hobbit',
      preferredEditionId: 'edition-audio',
    });
    state = audio.state;
    expect(audio.existing).not.toBeNull();
    expect(audio.added).toBeNull();
    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.preferredEditionId).toBe('edition-audio');

    state = setLocalStatus(state, state.items[0]!.id, 'finished');
    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.status).toBe('finished');
    expect(state.items[0]?.preferredEditionId).toBe('edition-audio');
  });

  it('allows the same work on two lists, never twice on one', () => {
    let state: LocalReadlistState = { items: [] };
    const first = addOrOpenWork(state, { listId: 'list-1', workId: 'work-hobbit' });
    state = first.state;
    const second = addOrOpenWork(state, { listId: 'list-2', workId: 'work-hobbit' });
    state = second.state;
    expect(state.items).toHaveLength(2);
    expect(second.added?.listId).toBe('list-2');

    const again = addOrOpenWork(state, { listId: 'list-1', workId: 'work-hobbit' });
    expect(again.existing?.listId).toBe('list-1');
    expect(again.added).toBeNull();
    expect(again.state.items).toHaveLength(2);
  });

  it('add from a collection dedupes by work on the selected list', () => {
    let state: LocalReadlistState = { items: [] };
    const fromCollection = addOrOpenWork(state, { listId: 'list-1', workId: 'OL45804W' });
    state = fromCollection.state;
    const again = addOrOpenWork(state, { listId: 'list-1', workId: 'OL45804W' });
    expect(again.existing?.workId).toBe('OL45804W');
    expect(again.added).toBeNull();
    expect(again.state.items).toHaveLength(1);
  });
});

describe('findEntryForHit', () => {
  it('matches an existing work so search opens instead of duplicating', () => {
    const entry = {
      item: item({ id: 'i1', workId: 'uuid-1', status: 'want_to_read' }),
      list: {
        id: 'list-1',
        householdId: 'h1',
        createdBy: null,
        name: 'Readlist',
        visibility: 'private' as const,
        isDefault: true,
        personIds: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      work: {
        id: 'uuid-1',
        olWorkId: 'OL45804W',
        isbn13: '9780547928227',
        hardcoverId: null,
        googleVolumeId: null,
        goodreadsId: null,
        title: 'The Hobbit',
        authors: [{ name: 'J. R. R. Tolkien', openLibraryAuthorId: null }],
        coverUrl: null,
        firstPublishedYear: 1937,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    };
    const matched = findEntryForHit([entry], hit({ workId: 'OL45804W', title: 'The Hobbit' }));
    expect(matched?.item.id).toBe('i1');
    expect(findEntryForHit([entry], hit({ workId: 'OL45804W', title: 'The Hobbit' }), 'list-1')?.item.id).toBe(
      'i1',
    );
    expect(findEntryForHit([entry], hit({ workId: 'OL45804W', title: 'The Hobbit' }), 'list-2')).toBeNull();
  });
});
