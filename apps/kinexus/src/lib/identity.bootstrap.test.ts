import { describe, expect, it } from 'vitest';

import {
  OWN_IDENTITY_SELECT,
  buildEnsureProfilePatch,
  mapOwnIdentity,
} from './identity-own';

/** Mirrors household.tsx asErrorMessage — real schema/permission text must surface. */
function asErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

describe('ensureProfile under preset restrictions', () => {
  it('never writes OAuth or Google picture URLs into avatar_url', () => {
    const patch = buildEnsureProfilePatch(
      { display_name: null, email: null, avatar_url: null },
      {
        displayName: 'Pat',
        email: 'pat@example.com',
        avatarUrl: 'https://lh3.googleusercontent.com/a/photo',
      },
    );
    expect(patch).toEqual({ display_name: 'Pat', email: 'pat@example.com' });
    expect(patch).not.toHaveProperty('avatar_url');
  });

  it('leaves a blank avatar alone when display fields already exist', () => {
    const patch = buildEnsureProfilePatch(
      {
        display_name: 'Pat',
        email: 'pat@example.com',
        avatar_url: null,
      },
      { displayName: 'Pat', email: 'pat@example.com', avatarUrl: 'https://evil.example/x.png' },
    );
    expect(patch).toEqual({});
  });

  it('preserves an existing legacy avatar_url without rewriting it', () => {
    const legacy = 'https://lh3.googleusercontent.com/a/legacy';
    const patch = buildEnsureProfilePatch(
      { display_name: null, email: 'pat@example.com', avatar_url: legacy },
      { displayName: 'Pat', email: 'pat@example.com', avatarUrl: 'https://other.example/y.png' },
    );
    expect(patch).toEqual({ display_name: 'Pat' });
    expect(JSON.stringify(patch)).not.toContain(legacy);
    expect(JSON.stringify(patch)).not.toContain('avatar_url');
  });
});

describe('own identity with optional Google columns', () => {
  it('keeps a base select without Google columns for missing-migration fallback', () => {
    expect(OWN_IDENTITY_SELECT).toContain('global_handle');
    expect(OWN_IDENTITY_SELECT).toContain('avatar_url');
    expect(OWN_IDENTITY_SELECT).not.toMatch(/avatar_source/);
    expect(OWN_IDENTITY_SELECT).not.toMatch(/avatar_google_url/);
  });

  it('maps a preset-era profile row without Google columns to preset defaults', () => {
    const identity = mapOwnIdentity({
      id: '11111111-1111-1111-1111-111111111111',
      global_handle: 'Swift-Oak-42',
      username: null,
      username_changed_at: null,
      display_name: 'Pat',
      avatar_url: 'preset:meals',
      is_verified_creator: false,
    });
    expect(identity.globalHandle).toBe('Swift-Oak-42');
    expect(identity.avatarUrl).toBe('preset:meals');
    expect(identity.avatarSource).toBe('preset');
    expect(identity.avatarGoogleUrl).toBeNull();
  });
});

describe('household bootstrap error surfacing', () => {
  it('surfaces real permission and schema messages instead of a silent empty household', () => {
    expect(
      asErrorMessage(
        { message: 'avatar_url must be a known preset id (or null)', code: 'P0001' },
        'Could not load household',
      ),
    ).toMatch(/preset/i);

    expect(
      asErrorMessage(
        { message: 'column profiles.avatar_source does not exist', code: '42703' },
        'Could not load household',
      ),
    ).toMatch(/avatar_source/);

    expect(
      asErrorMessage({ message: 'permission denied for table household_members', code: '42501' }, 'Could not load household'),
    ).toMatch(/permission denied/i);

    expect(asErrorMessage(null, 'Could not load household')).toBe('Could not load household');
  });
});
