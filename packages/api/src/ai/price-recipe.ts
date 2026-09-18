import { catalogPricesFromAi, INGREDIENT_CATALOG, storeListLabel, type GroceryMarket, type PriceOverrideMap } from '@kinexus/domain';

import type { AiClient } from './provider.js';
import { parseJsonObject } from '../recipe-draft.js';

export function catalogRefreshPrompt(market: GroceryMarket): string {
  const stores = storeListLabel(market.stores);
  const ingredientList = INGREDIENT_CATALOG.map(
    (item) =>
      `  "${item.key}": { label: "${item.label}", baseAmount: ${item.baseAmount}, baseUnit: "${item.baseUnit}", currentBaselineUSD: ${item.defaultPriceUSD} }`,
  ).join(',\n');

  return `You are a grocery pricing expert. Update the price estimates for the following common cooking ingredients.

The family shops in ${market.label} (${market.country}) at ${stores}. Still return prices in USD — the app will apply a local currency multiplier separately. Adjust the USD amounts to reflect typical grocery costs in that region relative to the US.

Return ONLY a valid JSON object — no markdown, no code fences, no explanation. The JSON must have exactly these keys (one per ingredient), each with a "priceUSD" number field representing the current realistic supermarket price for the given baseAmount and baseUnit.

Ingredients (key → details with current baseline for reference):
{
${ingredientList}
}

Your response must be a JSON object like:
{
  "chicken breast": { "priceUSD": 0.92 },
  "butter": { "priceUSD": 0.83 }
}

Only include "priceUSD" in each value. Do not change baseAmount or baseUnit — those are fixed.
Reflect realistic current-year grocery pricing. Make modest, realistic adjustments from the baselines.`;
}

export async function refreshIngredientCatalogWithAi(
  client: AiClient,
  market: GroceryMarket,
): Promise<PriceOverrideMap> {
  const text = await client.complete({
    json: true,
    maxTokens: 8192,
    system:
      'You are a grocery pricing expert. Always respond with valid JSON only — no markdown, no code fences, just raw JSON.',
    prompt: catalogRefreshPrompt(market),
  });
  return catalogPricesFromAi(parseJsonObject(text));
}
