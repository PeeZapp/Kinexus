-- Add Grok (grok.com consumer MCP connectors) to mcp_platform enum.
alter type public.mcp_platform add value if not exists 'grok';
