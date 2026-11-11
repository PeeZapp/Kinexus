import { afterEach, describe, expect, it, vi } from 'vitest';

import { hasTrolleyExtension } from '@/src/lib/trolley-extension';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hasTrolleyExtension', () => {
  it('is false without a document', () => {
    vi.stubGlobal('document', undefined);
    expect(hasTrolleyExtension()).toBe(false);
  });

  it('is false when the data attribute is missing', () => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } });
    expect(hasTrolleyExtension()).toBe(false);
  });

  it('is true when the data attribute is set', () => {
    vi.stubGlobal('document', {
      documentElement: { dataset: { kinexusTrolley: '1.1.0' } },
    });
    expect(hasTrolleyExtension()).toBe(true);
  });
});
