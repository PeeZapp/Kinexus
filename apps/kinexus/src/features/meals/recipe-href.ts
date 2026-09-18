import type { Href } from 'expo-router';

export function recipeHref(id: string): Href {
  return { pathname: '/meals/recipes/[id]', params: { id } };
}

export function recipeParam(id: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(id) ? id[0] : id;
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
