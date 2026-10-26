export function isPublicHttps(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) return false;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export function normalizeOrigin(value: string | null | undefined): string {
  const raw = value?.trim() ?? '';
  if (!raw) return '';
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProto).origin;
  } catch {
    return '';
  }
}

export type PublicOriginInput = {
  groceryPublicOrigin?: string | null;
  webUrl?: string | null;
  productionHost?: string | null;
  deploymentHost?: string | null;
  vercelEnv?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  requestOrigin?: string | null;
};

/** Permanent public site for Grok. Preview deploys use their own host so the route exists. */
export function publicSiteOrigin(input: PublicOriginInput): string {
  const explicit = normalizeOrigin(input.groceryPublicOrigin);
  if (isPublicHttps(explicit)) return explicit;

  const web = normalizeOrigin(input.webUrl);
  if (isPublicHttps(web)) return web;

  const production = normalizeOrigin(input.productionHost);
  const deployment = normalizeOrigin(input.deploymentHost);
  const forwardedHost = input.forwardedHost?.split(',')[0]?.trim() ?? '';
  const forwardedProto = input.forwardedProto?.split(',')[0]?.trim() || 'https';
  const forwarded = forwardedHost ? normalizeOrigin(`${forwardedProto}://${forwardedHost}`) : '';

  if (input.vercelEnv === 'preview' && isPublicHttps(deployment)) return deployment;
  if (isPublicHttps(production)) return production;
  if (isPublicHttps(forwarded)) return forwarded;
  if (isPublicHttps(deployment)) return deployment;

  const request = normalizeOrigin(input.requestOrigin);
  if (request) return request;
  return 'http://localhost:5301';
}

export function publicSiteOriginFromRequest(request: Request): string {
  let requestOrigin = '';
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    requestOrigin = '';
  }
  return publicSiteOrigin({
    groceryPublicOrigin: process.env.GROCERY_PUBLIC_ORIGIN,
    webUrl: process.env.EXPO_PUBLIC_WEB_URL || process.env.WEB_URL,
    productionHost: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    deploymentHost: process.env.VERCEL_URL,
    vercelEnv: process.env.VERCEL_ENV,
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
    requestOrigin,
  });
}

export function mcpConnectorUrl(siteOrigin: string, token: string): string {
  const url = new URL('/mcp', siteOrigin.endsWith('/') ? siteOrigin : `${siteOrigin}/`);
  url.searchParams.set('token', token);
  return url.toString();
}
