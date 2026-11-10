import { describe, expect, it, vi } from 'vitest';

import {
  assertBio,
  assertHttpsLinks,
  fetchProfileItems,
  fetchPublicProfile,
  handleGetPublicCreatorProfile,
  handleSearchCreators,
  parseProfileItemKind,
} from './public-profile.js';

describe('parseProfileItemKind', () => {
  it('accepts public kinds only', () => {
    expect(parseProfileItemKind('recipe')).toBe('recipe');
    expect(parseProfileItemKind('WORKOUT')).toBe('workout');
    expect(() => parseProfileItemKind('household')).toThrow(/kind must be/);
  });
});

describe('assertBio / assertHttpsLinks', () => {
  it('enforces https allowlist, max links, and profanity', () => {
    expect(assertBio('  Nice bio  ')).toBe('Nice bio');
    expect(() => assertBio('what the fuck')).toThrow(/not allowed/i);
    expect(() => assertHttpsLinks(['http://insecure.example'])).toThrow(/https/i);
    expect(assertHttpsLinks([{ url: 'https://example.com', label: 'Site' }])).toEqual([
      { url: 'https://example.com', label: 'Site' },
    ]);
    expect(() =>
      assertHttpsLinks([
        'https://a.com',
        'https://b.com',
        'https://c.com',
        'https://d.com',
        'https://e.com',
        'https://f.com',
      ]),
    ).toThrow(/At most 5/);
  });
});

describe('fetchPublicProfile / fetchProfileItems', () => {
  it('maps RPC rows and throws Error instead of raw PostgrestError', async () => {
    const client = {
      rpc: vi.fn(async (name: string) => {
        if (name === 'get_public_profile') {
          return {
            data: [
              {
                permanent_id: 'u1',
                handle: 'sunny.chef',
                avatar_preset: 'preset:meals',
                is_verified: true,
                bio: 'Cooks weekly',
                links: [{ url: 'https://example.com', label: 'Site' }],
              },
            ],
            error: null,
          };
        }
        if (name === 'get_profile_items') {
          return {
            data: [
              {
                id: 'r1',
                kind: 'recipe',
                title: 'Pasta',
                image_url: null,
                published_at: '2026-11-01T00:00:00Z',
              },
            ],
            error: null,
          };
        }
        throw new Error(`unexpected rpc ${name}`);
      }),
    };

    await expect(fetchPublicProfile(client, 'sunny.chef')).resolves.toEqual({
      permanentId: 'u1',
      handle: 'sunny.chef',
      avatarPreset: 'preset:meals',
      isVerified: true,
      bio: 'Cooks weekly',
      links: [{ url: 'https://example.com', label: 'Site' }],
    });

    await expect(fetchProfileItems(client, 'sunny.chef', 'recipe', 20, null)).resolves.toEqual({
      items: [
        {
          id: 'r1',
          kind: 'recipe',
          title: 'Pasta',
          imageUrl: null,
          publishedAt: '2026-11-01T00:00:00Z',
        },
      ],
      nextCursor: null,
    });

    client.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'db blew up', code: 'PGRST', details: 'x', hint: 'y' },
    });
    await expect(fetchPublicProfile(client, 'x')).rejects.toSatisfy(
      (err: unknown) => err instanceof Error && err.message === 'db blew up',
    );
  });
});

describe('handleGetPublicCreatorProfile', () => {
  it('400s on bad kind without calling supabase', async () => {
    const result = await handleGetPublicCreatorProfile(
      new Request('http://localhost/u/sunny'),
      'sunny',
      { kind: 'secret' },
    );
    expect(result).toEqual({
      status: 400,
      body: { error: 'kind must be recipe, workout, plan, or watchlist' },
    });
  });
});

describe('handleSearchCreators', () => {
  it('returns empty results for blank q', async () => {
    await expect(handleSearchCreators(new Request('http://localhost/creators/search'), '  ')).resolves.toEqual({
      status: 200,
      body: { results: [] },
    });
  });
});
