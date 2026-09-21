/**
 * Structured import logs. Never include API keys, Authorization headers, or raw HTML.
 */
export function logRecipeImport(event: {
  jobId: string;
  host: string;
  sourceKind: string;
  videoId?: string;
  provider?: string;
  latencyMs: number;
  status: string;
  method?: string;
  errorCode?: string;
}): void {
  const provider =
    event.provider === 'anthropic' ? 'claude' : event.provider === 'deepseek' ? 'deepseek' : event.provider ?? null;
  console.info('[recipe-import]', {
    jobId: event.jobId,
    host: event.host,
    sourceKind: event.sourceKind,
    videoId: event.videoId,
    provider,
    latencyMs: event.latencyMs,
    status: event.status,
    method: event.method ?? null,
    errorCode: event.errorCode ?? null,
  });
}
