export type AiFeature =
  | 'extract_recipe'
  | 'extract_recipe_from_url'
  | 'extract_recipe_from_photo'
  | 'generate_recipe_from_name'
  | 'estimate_recipe_nutrition'
  | 'classify_budget'
  | 'read_bank_screenshots'
  | 'recipe_import_structure'
  | 'catalog_refresh'
  | 'readlist_recommend';

/** Features that request provider web search when available. */
export const WEB_SEARCH_FEATURES: readonly AiFeature[] = [
  'extract_recipe_from_url',
  'generate_recipe_from_name',
  'estimate_recipe_nutrition',
] as const;

export function featureWantsWebSearch(feature: AiFeature): boolean {
  return (WEB_SEARCH_FEATURES as readonly string[]).includes(feature);
}
