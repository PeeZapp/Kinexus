import { describe, expect, it } from 'vitest';

import { scrubSecrets, scrubUnknown } from '../ai/scrub.js';
import { logMcp } from './log.js';

describe('mcp scrubber', () => {
  it('scrubs Authorization and bearer tokens from log payloads', () => {
    const scrubbed = scrubSecrets('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def');
    expect(scrubbed).not.toMatch(/eyJ/);
    expect(scrubbed.toLowerCase()).toContain('redacted');

    const obj = scrubUnknown({
      Authorization: 'Bearer secret-token-value',
      nested: { access_token: 'tok', note: 'ok' },
    }) as Record<string, unknown>;
    expect(String(obj.Authorization)).toMatch(/redacted|••••/);
  });

  it('logMcp does not throw on secret-bearing events', () => {
    expect(() =>
      logMcp({
        event: 'test',
        authorization: 'Bearer abc.def.ghi',
        detail: 'Authorization: Bearer xyz',
      }),
    ).not.toThrow();
  });
});
