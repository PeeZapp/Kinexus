import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { userFromRequest } from './auth.js';
import { corsOrigins } from './env.js';
import { handleAi, handleScrape, type AiRequestBody } from './handlers.js';

function registerMealsRoutes(router: Hono) {
  router.get('/health', (c) => c.json({ ok: true }));

  router.post('/scrape', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleScrape(body as { url?: string });
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  router.post('/ai', async (c) => {
    const authed = await userFromRequest(c.req.raw);
    if ('error' in authed) return c.json({ error: authed.error }, authed.status);
    const body = await c.req.json().catch(() => ({}));
    const result = await handleAi(body as AiRequestBody);
    return c.json(result.body, result.status as ContentfulStatusCode);
  });
}

const meals = new Hono();
registerMealsRoutes(meals);

export const app = new Hono();

app.use(
  '*',
  cors({
    origin: corsOrigins(),
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }),
);

app.route('/', meals);
app.route('/api', meals);
