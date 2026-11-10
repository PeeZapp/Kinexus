import { afterEach, describe, expect, it } from 'vitest';

import { MCP_CONNECTOR_BROWSER_ORIGINS, corsOrigins } from './env.js';

const PREV = {
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
  EXPO_PUBLIC_WEB_URL: process.env.EXPO_PUBLIC_WEB_URL,
};

afterEach(() => {
  for (const [key, value] of Object.entries(PREV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('corsOrigins', () => {
  it('always includes Claude, ChatGPT, and Perplexity origins for connector setup', () => {
    process.env.CORS_ORIGIN = 'http://localhost:5300';
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    delete process.env.EXPO_PUBLIC_WEB_URL;
    const origins = corsOrigins();
    for (const host of MCP_CONNECTOR_BROWSER_ORIGINS) {
      expect(origins).toContain(host);
    }
    expect(origins).toContain('https://chatgpt.com');
    expect(origins).toContain('https://chat.openai.com');
    expect(origins).toContain('https://www.perplexity.ai');
    expect(origins).toContain('https://enterprise.perplexity.ai');
  });
});
