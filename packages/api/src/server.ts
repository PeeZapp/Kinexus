import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { serve } from '@hono/node-server';

const here = fileURLToPath(new URL('.', import.meta.url));
config({ path: resolve(here, '../.env') });
config({ path: resolve(here, '../../../.env') });

const { app } = await import('./app');

const port = Number(process.env.API_PORT ?? 5301);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Kinexus API listening on http://localhost:${info.port}`);
});
