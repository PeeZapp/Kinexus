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
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export const DEFAULT_MCP_SCOPES: readonly McpScope[] = MCP_SCOPES;

export function hasScope(granted: readonly string[] | null | undefined, required: McpScope | null): boolean {
  if (!required) return true;
  return (granted ?? []).includes(required);
}
