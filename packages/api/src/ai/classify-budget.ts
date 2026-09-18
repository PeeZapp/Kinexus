import {
  budgetCategoryOptions,
  type AiMerchantGuess,
  type BudgetCategoryOption,
  type FinanceBudgetLineKind,
} from '@kinexus/domain';

import type { AiClient } from './provider.js';
import { parseJsonObject } from '../recipe-draft.js';

const KINDS = new Set<FinanceBudgetLineKind>(['income', 'expense']);

export type BudgetClassifyMerchant = {
  merchantKey: string;
  sample: string;
  count: number;
  total: number;
  kind: FinanceBudgetLineKind;
};

export function budgetClassifyPrompt(
  merchants: readonly BudgetClassifyMerchant[],
  categories: readonly BudgetCategoryOption[],
): string {
  const categoryList = budgetCategoryOptions(categories)
    .map((item) => `${item.kind}: ${item.name}`)
    .join('\n');
  const merchantList = merchants
    .slice(0, 40)
    .map(
      (item) =>
        `- key: ${JSON.stringify(item.merchantKey)}; sample: ${JSON.stringify(item.sample)}; ${item.kind} ${item.total} across ${item.count} txn(s)`,
    )
    .join('\n');
  return `Classify bank statement merchants into household budget categories.

Use only these categories (kind: name):
${categoryList}

Rules:
- Prefer an existing category name exactly.
- If the merchant is an internal transfer, savings sweep, or not a real income/expense, set ignore to true.
- Do not invent account numbers or personal details.
- confidence is 0 to 1. Only use 0.8+ when the merchant is obvious.

Merchants:
${merchantList}

Return ONLY JSON: { "assignments": [ { "merchantKey": string, "kind": "income" | "expense", "name": string, "confidence": number, "ignore": boolean } ] }`;
}

export function guessesFromAi(raw: Record<string, unknown>): AiMerchantGuess[] {
  const rows = Array.isArray(raw.assignments) ? raw.assignments : Array.isArray(raw.guesses) ? raw.guesses : [];
  const out: AiMerchantGuess[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const rec = row as Record<string, unknown>;
    const merchantKey = String(rec.merchantKey ?? rec.merchant ?? '').trim();
    if (!merchantKey) continue;
    const kindRaw = String(rec.kind ?? '').trim();
    const kind = KINDS.has(kindRaw as FinanceBudgetLineKind) ? (kindRaw as FinanceBudgetLineKind) : undefined;
    const name = String(rec.name ?? rec.category ?? '').trim() || undefined;
    const confidence = typeof rec.confidence === 'number' ? rec.confidence : Number(rec.confidence);
    const ignore = rec.ignore === true || rec.transfer === true;
    out.push({
      merchantKey,
      kind,
      name,
      confidence: Number.isFinite(confidence) ? confidence : undefined,
      ignore,
    });
  }
  return out;
}

export async function classifyBudgetMerchantsWithAi(
  client: AiClient,
  merchants: readonly BudgetClassifyMerchant[],
  categories: readonly BudgetCategoryOption[],
): Promise<AiMerchantGuess[]> {
  if (merchants.length === 0) return [];
  const text = await client.complete({
    json: true,
    maxTokens: 2048,
    system: 'You classify household bank merchants into budget categories. Respond with valid JSON only.',
    prompt: budgetClassifyPrompt(merchants, categories),
  });
  return guessesFromAi(parseJsonObject(text));
}
