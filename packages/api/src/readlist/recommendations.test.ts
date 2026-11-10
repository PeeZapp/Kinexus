import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiBlockedError } from '../ai/resolve.js';
import { createMemoryBookCache, setBookCacheForTests } from '../books/cache.js';
import { resetBookOutboundRateLimits } from '../books/rate-limit.js';
import {
  applyAiRecommendationOrder,
  buildReadlistRecommendations,
  excludeListedWorkIds,
  pickReadlistRecommendSeeds,
  scoreAndRankCandidates,
  type ReadlistRecommendSeed,
  type ReadlistRecommendation,
} from './recommendations.js';

function seed(
  partial: Partial<ReadlistRecommendSeed> & Pick<ReadlistRecommendSeed, 'workId' | 'title' | 'status'>,
): ReadlistRecommendSeed {
  return {
    olWorkId: partial.olWorkId ?? partial.workId,
    authors: partial.authors ?? ['Ada'],
    authorIds: partial.authorIds ?? ['OL1A'],
    subjects: partial.subjects ?? ['fantasy'],
    score: partial.score ?? null,
    ...partial,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('readlist recommendations', () => {
  beforeEach(() => {
    resetBookOutboundRateLimits();
    setBookCacheForTests(createMemoryBookCache());
  });

  it('picks finished works with score ≥7 first', () => {
    const picked = pickReadlistRecommendSeeds([
      seed({ workId: 'OL1W', title: 'Low', status: 'finished', score: 4 }),
      seed({ workId: 'OL2W', title: 'Loved', status: 'finished', score: 9 }),
      seed({ workId: 'OL3W', title: 'Reading', status: 'reading', score: 8 }),
      seed({ workId: 'OL4W', title: 'Also loved', status: 'finished', score: 7 }),
    ]);
    expect(picked.map((row) => row.workId)).toEqual(['OL2W', 'OL4W']);
  });

  it('falls back to finished/reading when no high scores', () => {
    const picked = pickReadlistRecommendSeeds([
      seed({ workId: 'OL1W', title: 'Want', status: 'want_to_read', score: 10 }),
      seed({ workId: 'OL2W', title: 'Reading', status: 'reading', score: 5 }),
      seed({ workId: 'OL3W', title: 'Finished', status: 'finished', score: 6 }),
    ]);
    expect(picked.map((row) => row.workId)).toEqual(['OL3W', 'OL2W']);
  });

  it('excludes books already on lists', () => {
    const kept = excludeListedWorkIds(
      [{ workId: 'OL1W' }, { workId: 'OL2W' }, { workId: 'OL3W' }],
      [{ workId: 'uuid-2', olWorkId: 'OL2W' }],
      [seed({ workId: 'uuid-1', olWorkId: 'OL1W', title: 'Seed', status: 'finished', score: 9 })],
    );
    expect(kept.map((row) => row.workId)).toEqual(['OL3W']);
  });

  it('reasons reference a real seed title', () => {
    const ranked = scoreAndRankCandidates(
      [
        seed({
          workId: 'OL1W',
          title: 'The Seed Book',
          status: 'finished',
          score: 9,
          authors: ['Ada'],
          subjects: ['fantasy'],
        }),
      ],
      [
        {
          workId: 'OL9W',
          title: 'Next Book',
          authors: ['Ada'],
          firstPublishedYear: 2018,
          coverUrl: null,
          ratingsAverage: 4.2,
          subjects: ['fantasy'],
          authorKeys: ['OL1A'],
        },
      ],
      [],
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.reason).toBe('Because you loved The Seed Book');
    expect(ranked[0]?.seedTitle).toBe('The Seed Book');
  });

  it('AI path stays off for no_access/key_paused and still returns the non-AI list', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        docs: [
          {
            key: '/works/OL9W',
            title: 'Next Book',
            author_name: ['Ada'],
            first_publish_year: 2018,
            ratings_average: 4.5,
            subject: ['fantasy'],
            author_key: ['/authors/OL1A'],
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const seeds = [
      seed({
        workId: 'OL1W',
        title: 'The Seed Book',
        status: 'finished',
        score: 9,
        authors: ['Ada'],
        authorIds: ['OL1A'],
        subjects: ['fantasy'],
      }),
    ];

    for (const code of ['no_access', 'key_paused'] as const) {
      const resolveAi = vi.fn(async () => {
        throw new AiBlockedError(code);
      });
      const completeAi = vi.fn();
      const result = await buildReadlistRecommendations({
        userId: 'u1',
        householdId: 'h1',
        seeds,
        listed: [{ workId: 'OL1W', olWorkId: 'OL1W' }],
        deps: {
          fetchImpl,
          resolveAi: resolveAi as never,
          completeAi: completeAi as never,
          lookupWork: async () => null,
        },
      });
      expect(result.aiUsed).toBe(false);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0]?.title).toBe('Next Book');
      expect(completeAi).not.toHaveBeenCalled();
    }
  });

  it('AI output cannot introduce a title not in candidates', () => {
    const candidates: ReadlistRecommendation[] = [
      {
        workId: 'OL9W',
        title: 'Next Book',
        authors: ['Ada'],
        firstPublishedYear: 2018,
        coverUrl: null,
        reason: 'Because you loved The Seed Book',
        seedTitle: 'The Seed Book',
      },
    ];
    const next = applyAiRecommendationOrder(candidates, [
      { workId: 'FAKE', title: 'Invented Novel', reason: 'Because magic' },
      { workId: 'OL9W', title: 'Next Book', reason: 'Because you loved The Seed Book' },
    ]);
    expect(next.map((row) => row.workId)).toEqual(['OL9W']);
    expect(next.every((row) => row.title !== 'Invented Novel')).toBe(true);
  });

  it('hits cache on second call', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return jsonResponse({
        docs: [
          {
            key: '/works/OL9W',
            title: 'Cached Pick',
            author_name: ['Ada'],
            first_publish_year: 2019,
            ratings_average: 4.1,
            subject: ['fantasy'],
            author_key: ['/authors/OL1A'],
          },
        ],
      });
    }) as unknown as typeof fetch;

    const seeds = [
      seed({
        workId: 'OL1W',
        title: 'The Seed Book',
        status: 'finished',
        score: 9,
        authors: ['Ada'],
        authorIds: ['OL1A'],
        subjects: ['fantasy'],
      }),
    ];
    const resolveAi = vi.fn(async () => {
      throw new AiBlockedError('no_access');
    });

    const first = await buildReadlistRecommendations({
      userId: 'u1',
      householdId: 'h1',
      seeds,
      listed: [{ workId: 'OL1W', olWorkId: 'OL1W' }],
      deps: {
        fetchImpl,
        resolveAi: resolveAi as never,
        completeAi: vi.fn() as never,
        lookupWork: async () => null,
      },
    });
    const afterFirst = calls;
    expect(afterFirst).toBeGreaterThan(0);

    const second = await buildReadlistRecommendations({
      userId: 'u1',
      householdId: 'h1',
      seeds,
      listed: [{ workId: 'OL1W', olWorkId: 'OL1W' }],
      deps: {
        fetchImpl,
        resolveAi: resolveAi as never,
        completeAi: vi.fn() as never,
        lookupWork: async () => null,
      },
    });

    expect(first.results).toEqual(second.results);
    expect(calls).toBe(afterFirst);
  });
});
