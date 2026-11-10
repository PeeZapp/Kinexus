import { z } from 'zod';

import type { McpCaller } from './context.js';
import type { McpScope } from './scopes.js';
import { runWhoami, type WhoamiResult } from './whoami.js';
import { writeMcpAudit } from './audit.js';
import { commitTool } from './commit-tool.js';
import { FITNESS_MCP_TOOLS } from './fitness/tools.js';
import { LISTS_MCP_TOOLS } from './lists/tools.js';
import { MEALS_MCP_TOOLS } from './meals/tools.js';

export type McpToolAnnotations = {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  openWorldHint: boolean;
};

export type McpToolDefinition<I extends z.ZodTypeAny = z.ZodTypeAny, O extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  title: string;
  description: string;
  inputSchema: I;
  outputSchema: O;
  scope: McpScope | null;
  annotations: McpToolAnnotations;
  handler: (args: z.infer<I>, caller: McpCaller) => Promise<z.infer<O>>;
};

/** Erased registry entry so heterogeneous tools can share one array. */
export type AnyMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  scope: McpScope | null;
  annotations: McpToolAnnotations;
  handler: (args: unknown, caller: McpCaller) => Promise<unknown>;
};

const whoamiInput = z.object({});
const whoamiOutput = z.object({
  handle: z.string(),
  householdName: z.string(),
  role: z.string(),
});

export const whoamiTool: McpToolDefinition<typeof whoamiInput, typeof whoamiOutput> = {
  name: 'whoami',
  title: 'Who am I',
  description: 'Return the caller handle, household name, and household role. Read-only.',
  inputSchema: whoamiInput,
  outputSchema: whoamiOutput,
  scope: null,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  handler: async (_args, caller): Promise<WhoamiResult> => {
    try {
      const result = await runWhoami(caller.client, caller.userId);
      await writeMcpAudit(caller.client, {
        userId: caller.userId,
        clientId: caller.clientId,
        platform: caller.platform,
        tool: 'whoami',
        mode: 'read',
        success: true,
      });
      return result;
    } catch (err) {
      await writeMcpAudit(caller.client, {
        userId: caller.userId,
        clientId: caller.clientId,
        platform: caller.platform,
        tool: 'whoami',
        mode: 'read',
        success: false,
        errorKind: err instanceof Error ? err.message.slice(0, 80) : 'error',
      });
      throw err;
    }
  },
};

/** Single typed registry for MCP tools. Add tools here only. */
export const MCP_TOOL_REGISTRY: readonly AnyMcpTool[] = [
  whoamiTool as AnyMcpTool,
  ...(MEALS_MCP_TOOLS as readonly AnyMcpTool[]),
  ...(FITNESS_MCP_TOOLS as readonly AnyMcpTool[]),
  ...(LISTS_MCP_TOOLS as readonly AnyMcpTool[]),
  commitTool as AnyMcpTool,
];

export type RegisteredMcpTool = AnyMcpTool;

export function assertRegistryAnnotations(tools: readonly { name: string; title?: string; annotations?: McpToolAnnotations }[]): void {
  for (const tool of tools) {
    if (!tool.title?.trim()) {
      throw new Error(`MCP tool "${tool.name}" is missing title`);
    }
    const a = tool.annotations;
    if (!a || typeof a.readOnlyHint !== 'boolean' || typeof a.destructiveHint !== 'boolean' || typeof a.openWorldHint !== 'boolean') {
      throw new Error(`MCP tool "${tool.name}" is missing annotations`);
    }
  }
}
