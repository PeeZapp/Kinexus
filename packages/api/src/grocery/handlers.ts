import { compareGroceryList, type GroceryCompareRequest } from './compare.js';

export async function handleGroceryCompare(body: GroceryCompareRequest): Promise<{ status: number; body: unknown }> {
  const result = await compareGroceryList(body);
  if (!result.ok) return { status: 400, body: { error: result.error } };
  return { status: 200, body: { comparison: result.comparison, warnings: result.warnings } };
}
