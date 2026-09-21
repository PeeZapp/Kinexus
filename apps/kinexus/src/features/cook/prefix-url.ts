import { RecipeUrlError, normalizeRecipeUrl } from '@kinexus/domain';

export function recipeUrlFromPathname(pathname: string, search = ''): string | null {
  if (!pathname) return null;
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }
  const withSearch = `${decoded}${search ?? ''}`;
  if (
    !/^\/https?:/i.test(decoded) &&
    !/^\/https\//i.test(decoded) &&
    !/^\/http\//i.test(decoded)
  ) {
    return null;
  }
  try {
    return normalizeRecipeUrl(withSearch).canonicalUrl;
  } catch (err) {
    if (err instanceof RecipeUrlError) return null;
    return null;
  }
}

export function recipeUrlFromHttpsSlug(slug: string | string[] | undefined, search = ''): string | null {
  const parts = Array.isArray(slug) ? slug : slug ? [slug] : [];
  if (parts.length === 0) return null;
  return recipeUrlFromPathname(`/https/${parts.join('/')}`, search);
}
