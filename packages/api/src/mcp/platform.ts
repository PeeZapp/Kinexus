export type McpPlatform = 'chatgpt' | 'claude' | 'perplexity' | 'inspector' | 'other';

export function inferMcpPlatform(clientName: string | null | undefined): McpPlatform {
  const name = (clientName ?? '').toLowerCase();
  if (name.includes('chatgpt') || name.includes('openai')) return 'chatgpt';
  if (name.includes('claude') || name.includes('anthropic')) return 'claude';
  if (name.includes('perplexity')) return 'perplexity';
  if (name.includes('inspector') || name.includes('mcp inspector')) return 'inspector';
  return 'other';
}
