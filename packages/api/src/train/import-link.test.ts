import { describe, expect, it, vi } from 'vitest';

import { HEVY_LINK_PUBLIC_ERROR } from '@kinexus/domain';

import { handleTrainImportLink, importWorkoutFromHevyLink } from './import-link.js';
import { SsrfError, isPrivateIp } from '../scrape/ssrf.js';

const CATALOG = [
  { id: 'ex-bench', name: 'Bench Press', category: 'Chest' },
  { id: 'ex-squat', name: 'Barbell Squat', category: 'Legs' },
  { id: 'ex-run', name: 'Running', category: 'Cardio' },
];

function nextDataHtml(workout: Record<string, unknown>): string {
  return `<!doctype html><html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { workout } },
    page: '/workout/[id]',
    buildId: 'test',
  })}</script></body></html>`;
}

const WORKOUT_HTML = nextDataHtml({
  title: 'Push Day',
  exercises: [
    {
      title: 'Bench Press',
      sets: [
        { type: 'normal', weight_kg: 100, reps: 5 },
        { type: 'normal', weight_kg: 100, reps: 5 },
      ],
    },
    {
      title: 'Running',
      sets: [{ type: 'normal', duration_seconds: 300 }],
    },
    {
      title: 'Totally Unknown Lift',
      sets: [{ type: 'normal', weight_kg: 40, reps: 10 }],
    },
  ],
});

describe('train import link', () => {
  it('rejects private IPs via SSRF guard', async () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    const result = await handleTrainImportLink(
      { url: 'https://hevy.com/workout/abc123' },
      {
        lookup: async () => ['127.0.0.1'],
        fetch: vi.fn(async () => new Response('nope', { status: 200 })),
        catalog: CATALOG,
      },
    );
    expect(result.status).toBe(400);
    expect('error' in result.body && result.body.error).toMatch(/not allowed/i);
  });

  it('returns friendly error for private/unreadable pages', async () => {
    const result = await handleTrainImportLink(
      { url: 'https://hevy.com/workout/abc123' },
      {
        lookup: async () => ['93.184.216.34'],
        fetch: vi.fn(async () => new Response('<html><body>This workout is private.</body></html>', { status: 200 })),
        catalog: CATALOG,
      },
    );
    expect(result.status).toBe(422);
    expect(result.body).toEqual({ error: HEVY_LINK_PUBLIC_ERROR });
  });

  it('parses Hevy page, matches exercises, writes nothing', async () => {
    const fetchMock = vi.fn(async () => new Response(WORKOUT_HTML, { status: 200, headers: { 'content-type': 'text/html' } }));
    const loadCatalog = vi.fn(async () => CATALOG);
    const result = await importWorkoutFromHevyLink('https://hevy.com/workout/abc123', {
      lookup: async () => ['93.184.216.34'],
      fetch: fetchMock as unknown as typeof fetch,
      loadCatalog,
      catalog: CATALOG,
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.title).toBe('Push Day');
    expect(result.exercises.map((ex) => ex.match)).toEqual(['matched', 'matched', 'missing']);
    expect(result.exercises[0]?.targetEffort).toBe('heavy');
    expect(result.exercises[1]?.targetEffort).toBe('moderate');
    expect(result.exercises[2]?.willCreateCustom).toBe(true);
    // No write APIs involved — catalog/load only.
    expect(loadCatalog).not.toHaveBeenCalled();
  });

  it('resolves hevy.app short links via redirect then parses', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('hevy.app')) {
        return new Response('', {
          status: 302,
          headers: { location: 'https://hevy.com/workout/resolved1' },
        });
      }
      return new Response(WORKOUT_HTML, { status: 200, headers: { 'content-type': 'text/html' } });
    });

    const result = await importWorkoutFromHevyLink('https://hevy.app/x/shorty', {
      lookup: async () => ['93.184.216.34'],
      fetch: fetchMock as unknown as typeof fetch,
      catalog: CATALOG,
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result.title).toBe('Push Day');
    expect(result.resolvedUrl).toContain('/workout/resolved1');
  });

  it('maps SsrfError from lookup to 400', async () => {
    const result = await handleTrainImportLink(
      { url: 'https://hevy.com/workout/abc123' },
      {
        lookup: async () => {
          throw new SsrfError();
        },
        catalog: CATALOG,
      },
    );
    expect(result.status).toBe(400);
  });
});
