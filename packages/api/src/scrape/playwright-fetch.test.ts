import { describe, expect, it } from 'vitest';

import { playwrightEnabled } from './playwright-fetch.js';

describe('playwrightEnabled', () => {
  it('is on locally and off on Vercel unless forced', () => {
    expect(playwrightEnabled({} as NodeJS.ProcessEnv)).toBe(true);
    expect(playwrightEnabled({ PLAYWRIGHT_ENABLED: '0' } as NodeJS.ProcessEnv)).toBe(false);
    expect(playwrightEnabled({ VERCEL: '1' } as NodeJS.ProcessEnv)).toBe(false);
    expect(playwrightEnabled({ VERCEL: '1', PLAYWRIGHT_ENABLED: '1' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('stays off during unit tests unless PLAYWRIGHT_TEST=1', () => {
    expect(playwrightEnabled({ VITEST: 'true' } as NodeJS.ProcessEnv)).toBe(false);
    expect(playwrightEnabled({ VITEST: 'true', PLAYWRIGHT_TEST: '1' } as NodeJS.ProcessEnv)).toBe(true);
  });
});
