import { handle } from 'hono/vercel';

import { app } from './app';

export const runtime = 'nodejs';
export const GET = handle(app);
export const POST = handle(app);
export const OPTIONS = handle(app);
export default handle(app);
