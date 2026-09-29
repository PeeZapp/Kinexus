import { Linking, Platform } from 'react-native';

export const LINK_ONLY_NOTE = 'Full recipe not found. It can be viewed at this link.';

export function isLinkOnlyRecipe(recipe: { notes?: string | null; sourceUrl?: string | null }): boolean {
  return Boolean(recipe.sourceUrl) && (recipe.notes ?? '').includes('Full recipe not found');
}

export function openRecipeLink(url: string | null | undefined) {
  if (!url) return;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void Linking.openURL(url);
}
