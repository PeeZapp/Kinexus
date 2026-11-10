import { scrubSecrets, scrubUnknown } from '../ai/scrub.js';

export function logMcp(event: Record<string, unknown>): void {
  const safe = scrubUnknown(event) as Record<string, unknown>;
  const line = scrubSecrets(JSON.stringify({ scope: 'mcp', ...safe }));
  console.log(line);
}
