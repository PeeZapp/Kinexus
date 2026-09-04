/**
 * TODO(Phase 5): Vercel/Hono handlers for /ai and /scrape.
 * Verify Supabase JWT on every request. Never expose provider keys to the client.
 */

export type { AiClient, AiProvider } from './ai/provider';
export { createAiClient } from './ai/provider';
