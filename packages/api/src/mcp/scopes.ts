/** App scopes granted in full on consent (not shown in the UI). */
export const MCP_SCOPES = [
  'meals:read',
  'meals:write',
  'fitness:read',
  'fitness:write',
  'watchlists:read',
  'watchlists:write',
  'wishlists:read',
  'wishlists:write',
  'today:read',
  'today:write',
  'finances:read',
  'finances:write',
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export const DEFAULT_MCP_SCOPES: readonly McpScope[] = MCP_SCOPES;

/** Union stored connection scopes with current defaults so new tools work without reconnect. */
export function mergeGrantedScopes(stored: readonly string[] | null | undefined): McpScope[] {
  const set = new Set<string>(stored ?? []);
  for (const scope of DEFAULT_MCP_SCOPES) set.add(scope);
  return MCP_SCOPES.filter((scope) => set.has(scope));
}

export function hasScope(granted: readonly string[] | null | undefined, required: McpScope | null): boolean {
  if (!required) return true;
  return (granted ?? []).includes(required);
}
