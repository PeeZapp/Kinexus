const KEY = 'kinexus_auth_return';

export function rememberAuthReturn(path: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(KEY, path);
}

export function takeAuthReturn(fallback = '/'): string {
  if (typeof sessionStorage === 'undefined') return fallback;
  const value = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
