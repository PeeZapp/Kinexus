import {
  compareGroceryList,
  searchGroceryCatalog,
  type GroceryCatalogRequest,
  type GroceryCompareRequest,
} from './compare.js';

export async function handleGroceryCompare(body: GroceryCompareRequest): Promise<{ status: number; body: unknown }> {
  const result = await compareGroceryList(body);
  if (!result.ok) return { status: 400, body: { error: result.error } };
  return { status: 200, body: { comparison: result.comparison, warnings: result.warnings } };
}

export async function handleGroceryCatalog(body: GroceryCatalogRequest): Promise<{ status: number; body: unknown }> {
  const result = await searchGroceryCatalog(body);
  if (!result.ok) return { status: 400, body: { error: result.error } };
  return { status: 200, body: { query: result.query, chains: result.chains } };
}
