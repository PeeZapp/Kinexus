import type { Href } from 'expo-router';

export function recipeHref(id: string, opts?: { from?: 'shopping'; serves?: number }): Href {
  const params: Record<string, string> = { id };
  if (opts?.from === 'shopping') params.from = 'shopping';
  if (opts?.serves != null && opts.serves > 0) params.serves = String(Math.round(opts.serves));
  if (Object.keys(params).length === 1) {
    return { pathname: '/meals/recipes/[id]', params: { id } };
  }
  return { pathname: '/meals/recipes/[id]', params };
}

export function recipeEditHref(id: string): Href {
  return { pathname: '/meals/recipes/edit/[id]', params: { id } };
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
