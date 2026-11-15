import { z } from 'zod';

import type { McpToolDefinition } from '../registry.js';
import type { McpCaller } from '../context.js';
import {
  getInvestmentItem,
  listInvestmentAlerts,
  listInvestmentWatchlist,
  listTradeJournal,
} from './invest-reads.js';
import {
  previewAddInvestmentIdea,
  previewAddTrade,
  previewRemoveInvestmentIdea,
  previewRemoveTrade,
  previewUpdateInvestmentIdea,
  previewUpdateTrade,
} from './invest-writes.js';
import { getBudgetCarry, getBudgetMonth, listBudgetTransactions } from './reads.js';
import {
  previewAddBudgetTxn,
  previewApplyBudgetCarry,
  previewClearBudgetCarry,
  previewTransferBudgetCarry,
  type PreviewResult,
} from './writes.js';
import { resolveCallerHousehold, withFinancesAudit } from './shared.js';

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const previewResultSchema = z.object({
  kind: z.enum(['preview', 'dedupe', 'blocked', 'noop']),
  previewId: z.string().optional(),
  expiresAt: z.string().optional(),
  tool: z.string().optional(),
  summary: z.string(),
  steps: z.array(z.string()).optional(),
  message: z.string().optional(),
});

async function householdIdOrNull(caller: McpCaller): Promise<string | null> {
  try {
    return (await resolveCallerHousehold(caller.client, caller.userId)).householdId;
  } catch {
    return null;
  }
}

async function auditedPreview(
  caller: McpCaller,
  tool: string,
  run: () => Promise<PreviewResult>,
): Promise<z.infer<typeof previewResultSchema>> {
  const householdId = await householdIdOrNull(caller);
  return withFinancesAudit(caller, { tool, mode: 'write', householdId }, async () => run());
}

const getBudgetMonthInput = z.object({ month: z.string().optional() });
const getBudgetMonthOutput = z.object({
  householdId: z.string(),
  budgetId: z.string(),
  monthStart: z.string(),
  totals: z.object({
    planned: z.number(),
    spent: z.number(),
    leftover: z.number(),
    income: z.number(),
    incomePlanned: z.number(),
    leftoverPlanned: z.number(),
  }),
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.string(),
      planned: z.number(),
      spent: z.number(),
      leftover: z.number(),
      parentId: z.string().nullable(),
    }),
  ),
  carryBalances: z.array(
    z.object({
      lineId: z.string(),
      name: z.string(),
      balance: z.number(),
    }),
  ),
});

export const getBudgetMonthTool: McpToolDefinition<typeof getBudgetMonthInput, typeof getBudgetMonthOutput> = {
  name: 'get_budget_month',
  title: 'Get budget month',
  description: 'Planned/spent/leftover for a month (YYYY-MM or YYYY-MM-01), categories, and non-zero carry balances.',
  inputSchema: getBudgetMonthInput,
  outputSchema: getBudgetMonthOutput,
  scope: 'finances:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withFinancesAudit(caller, { tool: 'get_budget_month', mode: 'read' }, () =>
      getBudgetMonth(caller.client, caller.userId, args),
    ),
};

const listBudgetTxnsInput = z.object({
  month: z.string().optional(),
  lineId: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
});
const listBudgetTxnsOutput = z.object({
  householdId: z.string(),
  monthStart: z.string(),
  transactions: z.array(
    z.object({
      id: z.string(),
      lineId: z.string().nullable(),
      date: z.string(),
      description: z.string(),
      amount: z.number(),
      source: z.string(),
    }),
  ),
});

export const listBudgetTransactionsTool: McpToolDefinition<
  typeof listBudgetTxnsInput,
  typeof listBudgetTxnsOutput
> = {
  name: 'list_budget_transactions',
  title: 'List budget transactions',
  description: 'Budget transactions for a month, optionally filtered by category. Does not wipe or import statements.',
  inputSchema: listBudgetTxnsInput,
  outputSchema: listBudgetTxnsOutput,
  scope: 'finances:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withFinancesAudit(caller, { tool: 'list_budget_transactions', mode: 'read' }, () =>
      listBudgetTransactions(caller.client, caller.userId, args),
    ),
};

const getBudgetCarryInput = z.object({});
const getBudgetCarryOutput = z.object({
  householdId: z.string(),
  budgetId: z.string(),
  carries: z.array(
    z.object({
      lineId: z.string(),
      name: z.string(),
      balance: z.number(),
      lastAccruedMonth: z.string().nullable(),
    }),
  ),
});

export const getBudgetCarryTool: McpToolDefinition<typeof getBudgetCarryInput, typeof getBudgetCarryOutput> = {
  name: 'get_budget_carry',
  title: 'Get budget carry',
  description: 'Carry balances by category.',
  inputSchema: getBudgetCarryInput,
  outputSchema: getBudgetCarryOutput,
  scope: 'finances:read',
  annotations: readAnnotations,
  handler: async (_args, caller) =>
    withFinancesAudit(caller, { tool: 'get_budget_carry', mode: 'read' }, () =>
      getBudgetCarry(caller.client, caller.userId),
    ),
};

const addBudgetTxnInput = z.object({
  lineId: z.string(),
  description: z.string(),
  amount: z.union([z.string(), z.number()]),
  date: z.string().optional(),
  entryKind: z.enum(['spend', 'return', 'income']).optional(),
  month: z.string().optional(),
});

export const previewAddBudgetTxnTool: McpToolDefinition<typeof addBudgetTxnInput, typeof previewResultSchema> = {
  name: 'preview_add_budget_txn',
  title: 'Preview add budget transaction',
  description: 'Preview spend / return / income entry. Never clears the budget or imports statements.',
  inputSchema: addBudgetTxnInput,
  outputSchema: previewResultSchema,
  scope: 'finances:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_add_budget_txn', () => previewAddBudgetTxn(caller, args)),
};

const applyCarryInput = z.object({
  lineId: z.string(),
  month: z.string().optional(),
  amount: z.number().optional(),
  targetLineId: z.string().optional(),
});

export const previewApplyBudgetCarryTool: McpToolDefinition<typeof applyCarryInput, typeof previewResultSchema> = {
  name: 'preview_apply_budget_carry',
  title: 'Preview apply budget carry',
  description: 'Preview applying carry balance into a month/category (owners/admins).',
  inputSchema: applyCarryInput,
  outputSchema: previewResultSchema,
  scope: 'finances:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_apply_budget_carry', () => previewApplyBudgetCarry(caller, args)),
};

const clearCarryInput = z.object({ lineId: z.string() });

export const previewClearBudgetCarryTool: McpToolDefinition<typeof clearCarryInput, typeof previewResultSchema> = {
  name: 'preview_clear_budget_carry',
  title: 'Preview clear budget carry',
  description: 'Preview zeroing one category’s carry balance (not clearBudget / wipe).',
  inputSchema: clearCarryInput,
  outputSchema: previewResultSchema,
  scope: 'finances:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_clear_budget_carry', () => previewClearBudgetCarry(caller, args)),
};

const transferCarryInput = z.object({
  fromLineId: z.string(),
  toLineId: z.string(),
  amount: z.number().optional(),
});

export const previewTransferBudgetCarryTool: McpToolDefinition<
  typeof transferCarryInput,
  typeof previewResultSchema
> = {
  name: 'preview_transfer_budget_carry',
  title: 'Preview transfer budget carry',
  description: 'Preview moving carry balance between expense categories.',
  inputSchema: transferCarryInput,
  outputSchema: previewResultSchema,
  scope: 'finances:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_transfer_budget_carry', () => previewTransferBudgetCarry(caller, args)),
};

const investmentItemOut = z.object({
  id: z.string(),
  title: z.string(),
  symbol: z.string().nullable(),
  status: z.string(),
  visibility: z.string(),
  thesis: z.string(),
  notes: z.string(),
  tags: z.array(z.string()),
  targetPrice: z.number().nullable(),
  stopPrice: z.number().nullable(),
  lastPrice: z.number().nullable(),
  lastPriceAt: z.string().nullable(),
  createdBy: z.string(),
});

const listInvestmentWatchlistInput = z.object({ status: z.string().optional() });
const listInvestmentWatchlistOutput = z.object({
  householdId: z.string(),
  items: z.array(investmentItemOut),
});

export const listInvestmentWatchlistTool: McpToolDefinition<
  typeof listInvestmentWatchlistInput,
  typeof listInvestmentWatchlistOutput
> = {
  name: 'list_investment_watchlist',
  title: 'List investment watchlist',
  description: 'Investment ideas/watchlist visible to you (private items stay private).',
  inputSchema: listInvestmentWatchlistInput,
  outputSchema: listInvestmentWatchlistOutput,
  scope: 'finances:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withFinancesAudit(caller, { tool: 'list_investment_watchlist', mode: 'read' }, async () => {
      const result = await listInvestmentWatchlist(caller.client, caller.userId, args);
      return {
        householdId: result.householdId,
        items: result.items.map((item) => ({
          id: item.id,
          title: item.title,
          symbol: item.symbol,
          status: item.status,
          visibility: item.visibility,
          thesis: item.thesis,
          notes: item.notes,
          tags: item.tags,
          targetPrice: item.targetPrice,
          stopPrice: item.stopPrice,
          lastPrice: item.lastPrice,
          lastPriceAt: item.lastPriceAt,
          createdBy: item.createdBy,
        })),
      };
    }),
};

const getInvestmentItemInput = z.object({ itemId: z.string() });
const getInvestmentItemOutput = z.object({
  householdId: z.string(),
  item: investmentItemOut,
});

export const getInvestmentItemTool: McpToolDefinition<
  typeof getInvestmentItemInput,
  typeof getInvestmentItemOutput
> = {
  name: 'get_investment_item',
  title: 'Get investment item',
  description: 'One investment idea by id (respects private visibility).',
  inputSchema: getInvestmentItemInput,
  outputSchema: getInvestmentItemOutput,
  scope: 'finances:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withFinancesAudit(caller, { tool: 'get_investment_item', mode: 'read' }, async () => {
      const result = await getInvestmentItem(caller.client, caller.userId, args.itemId);
      const item = result.item;
      return {
        householdId: result.householdId,
        item: {
          id: item.id,
          title: item.title,
          symbol: item.symbol,
          status: item.status,
          visibility: item.visibility,
          thesis: item.thesis,
          notes: item.notes,
          tags: item.tags,
          targetPrice: item.targetPrice,
          stopPrice: item.stopPrice,
          lastPrice: item.lastPrice,
          lastPriceAt: item.lastPriceAt,
          createdBy: item.createdBy,
        },
      };
    }),
};

const addIdeaInput = z.object({
  title: z.string(),
  symbol: z.string().nullable().optional(),
  thesis: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['watching', 'idea', 'holding', 'closed']).optional(),
  visibility: z.enum(['household', 'private']).optional(),
  targetPrice: z.number().nullable().optional(),
  stopPrice: z.number().nullable().optional(),
});

export const previewAddInvestmentIdeaTool: McpToolDefinition<typeof addIdeaInput, typeof previewResultSchema> = {
  name: 'preview_add_investment_idea',
  title: 'Preview add investment idea',
  description: 'Preview adding an investment watchlist/idea item.',
  inputSchema: addIdeaInput,
  outputSchema: previewResultSchema,
  scope: 'finances:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_add_investment_idea', () => previewAddInvestmentIdea(caller, args)),
};

const updateIdeaInput = addIdeaInput.partial().extend({ itemId: z.string() });

export const previewUpdateInvestmentIdeaTool: McpToolDefinition<
  typeof updateIdeaInput,
  typeof previewResultSchema
> = {
  name: 'preview_update_investment_idea',
  title: 'Preview update investment idea',
  description: 'Preview updating an investment idea you can edit.',
  inputSchema: updateIdeaInput,
  outputSchema: previewResultSchema,
  scope: 'finances:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_update_investment_idea', () => previewUpdateInvestmentIdea(caller, args)),
};

const removeIdeaInput = z.object({ itemId: z.string() });

export const previewRemoveInvestmentIdeaTool: McpToolDefinition<
  typeof removeIdeaInput,
  typeof previewResultSchema
> = {
  name: 'preview_remove_investment_idea',
  title: 'Preview remove investment idea',
  description: 'Preview deleting an investment idea.',
  inputSchema: removeIdeaInput,
  outputSchema: previewResultSchema,
  scope: 'finances:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_remove_investment_idea', () => previewRemoveInvestmentIdea(caller, args)),
};

const listTradeJournalInput = z.object({
  symbol: z.string().optional(),
  itemId: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
});
const listTradeJournalOutput = z.object({
  householdId: z.string(),
  entries: z.array(
    z.object({
      id: z.string(),
      symbol: z.string().nullable(),
      itemId: z.string().nullable(),
      side: z.string(),
      qty: z.number(),
      price: z.number(),
      fees: z.number(),
      tradedOn: z.string(),
      thesis: z.string(),
      notes: z.string(),
      visibility: z.string(),
    }),
  ),
  summary: z.object({
    buys: z.number(),
    sells: z.number(),
    fees: z.number(),
    realizedPnl: z.number().nullable(),
  }),
});

export const listTradeJournalTool: McpToolDefinition<
  typeof listTradeJournalInput,
  typeof listTradeJournalOutput
> = {
  name: 'list_trade_journal',
  title: 'List trade journal',
  description: 'Trade journal entries visible to you, with a simple realized P/L summary.',
  inputSchema: listTradeJournalInput,
  outputSchema: listTradeJournalOutput,
  scope: 'finances:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withFinancesAudit(caller, { tool: 'list_trade_journal', mode: 'read' }, async () => {
      const result = await listTradeJournal(caller.client, caller.userId, args);
      return {
        householdId: result.householdId,
        entries: result.entries.map((entry) => ({
          id: entry.id,
          symbol: entry.symbol,
          itemId: entry.itemId,
          side: entry.side,
          qty: entry.qty,
          price: entry.price,
          fees: entry.fees,
          tradedOn: entry.tradedOn,
          thesis: entry.thesis,
          notes: entry.notes,
          visibility: entry.visibility,
        })),
        summary: result.summary,
      };
    }),
};

const addTradeInput = z.object({
  symbol: z.string().nullable().optional(),
  itemId: z.string().nullable().optional(),
  side: z.enum(['buy', 'sell']),
  qty: z.number(),
  price: z.number(),
  fees: z.number().optional(),
  tradedOn: z.string(),
  thesis: z.string().optional(),
  emotions: z.string().optional(),
  notes: z.string().optional(),
  visibility: z.enum(['household', 'private']).optional(),
});

export const previewAddTradeTool: McpToolDefinition<typeof addTradeInput, typeof previewResultSchema> = {
  name: 'preview_add_trade',
  title: 'Preview add trade',
  description: 'Preview logging a buy/sell in the trade journal.',
  inputSchema: addTradeInput,
  outputSchema: previewResultSchema,
  scope: 'finances:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_add_trade', () => previewAddTrade(caller, args)),
};

const updateTradeInput = addTradeInput.partial().extend({ entryId: z.string() });

export const previewUpdateTradeTool: McpToolDefinition<typeof updateTradeInput, typeof previewResultSchema> = {
  name: 'preview_update_trade',
  title: 'Preview update trade',
  description: 'Preview updating a trade journal entry.',
  inputSchema: updateTradeInput,
  outputSchema: previewResultSchema,
  scope: 'finances:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_update_trade', () => previewUpdateTrade(caller, args)),
};

const removeTradeInput = z.object({ entryId: z.string() });

export const previewRemoveTradeTool: McpToolDefinition<typeof removeTradeInput, typeof previewResultSchema> = {
  name: 'preview_remove_trade',
  title: 'Preview remove trade',
  description: 'Preview deleting a trade journal entry.',
  inputSchema: removeTradeInput,
  outputSchema: previewResultSchema,
  scope: 'finances:write',
  annotations: writeAnnotations,
  handler: async (args, caller) =>
    auditedPreview(caller, 'preview_remove_trade', () => previewRemoveTrade(caller, args)),
};

const listInvestmentAlertsInput = z.object({ activeOnly: z.boolean().optional() });
const listInvestmentAlertsOutput = z.object({
  householdId: z.string(),
  alerts: z.array(
    z.object({
      id: z.string(),
      itemId: z.string(),
      kind: z.string(),
      threshold: z.number(),
      active: z.boolean(),
      lastTriggeredAt: z.string().nullable(),
    }),
  ),
});

export const listInvestmentAlertsTool: McpToolDefinition<
  typeof listInvestmentAlertsInput,
  typeof listInvestmentAlertsOutput
> = {
  name: 'list_investment_alerts',
  title: 'List investment alerts',
  description: 'Read investment price alerts (threshold / % move).',
  inputSchema: listInvestmentAlertsInput,
  outputSchema: listInvestmentAlertsOutput,
  scope: 'finances:read',
  annotations: readAnnotations,
  handler: async (args, caller) =>
    withFinancesAudit(caller, { tool: 'list_investment_alerts', mode: 'read' }, async () => {
      const result = await listInvestmentAlerts(caller.client, caller.userId, args);
      return {
        householdId: result.householdId,
        alerts: result.alerts.map((alert) => ({
          id: alert.id,
          itemId: alert.itemId,
          kind: alert.kind,
          threshold: alert.threshold,
          active: alert.active,
          lastTriggeredAt: alert.lastTriggeredAt,
        })),
      };
    }),
};

export const FINANCES_MCP_TOOLS = [
  getBudgetMonthTool,
  listBudgetTransactionsTool,
  getBudgetCarryTool,
  previewAddBudgetTxnTool,
  previewApplyBudgetCarryTool,
  previewClearBudgetCarryTool,
  previewTransferBudgetCarryTool,
  listInvestmentWatchlistTool,
  getInvestmentItemTool,
  previewAddInvestmentIdeaTool,
  previewUpdateInvestmentIdeaTool,
  previewRemoveInvestmentIdeaTool,
  listTradeJournalTool,
  previewAddTradeTool,
  previewUpdateTradeTool,
  previewRemoveTradeTool,
  listInvestmentAlertsTool,
] as const;
