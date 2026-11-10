import { describe, expect, it } from 'vitest';

import { assertRegistryAnnotations, MCP_TOOL_REGISTRY } from './registry.js';

describe('MCP tool registry', () => {
  it('requires title and annotations on every tool', () => {
    expect(() => assertRegistryAnnotations(MCP_TOOL_REGISTRY)).not.toThrow();
    for (const tool of MCP_TOOL_REGISTRY) {
      expect(tool.title.trim().length).toBeGreaterThan(0);
      expect(tool.annotations).toEqual(
        expect.objectContaining({
          readOnlyHint: expect.any(Boolean),
          destructiveHint: expect.any(Boolean),
          openWorldHint: expect.any(Boolean),
        }),
      );
    }
  });

  it('fails the ChatGPT portal Scan Tools gate when any tool lacks annotation booleans', () => {
    const missing = MCP_TOOL_REGISTRY.filter((tool) => {
      const a = tool.annotations;
      return (
        !a ||
        typeof a.readOnlyHint !== 'boolean' ||
        typeof a.destructiveHint !== 'boolean' ||
        typeof a.openWorldHint !== 'boolean'
      );
    }).map((tool) => tool.name);
    expect(missing).toEqual([]);
    expect(() =>
      assertRegistryAnnotations([
        {
          name: 'no_hints',
          title: 'No hints',
          annotations: { readOnlyHint: true } as { readOnlyHint: boolean; destructiveHint: boolean; openWorldHint: boolean },
        },
      ]),
    ).toThrow(/missing annotations/);
  });

  it('fails when a tool lacks title or annotations', () => {
    expect(() =>
      assertRegistryAnnotations([{ name: 'broken', title: '', annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } }]),
    ).toThrow(/missing title/);
    expect(() => assertRegistryAnnotations([{ name: 'broken', title: 'Broken' }])).toThrow(/missing annotations/);
  });
});
