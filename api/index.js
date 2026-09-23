/**
 * Vercel non-Next functions only support one dynamic path segment, so nested
 * API routes are rewritten to this entry with ?__path=... and restored here.
 */
import listener from './_handler.mjs';

function restoreUrl(req) {
  try {
    const incoming = req.url || '/';
    const url = new URL(incoming, 'http://localhost');
    const path = url.searchParams.get('__path');
    if (!path) return incoming;
    url.searchParams.delete('__path');
    const qs = url.searchParams.toString();
    return path + (qs ? `?${qs}` : '');
  } catch {
    return req.url || '/';
  }
}

export default function kinexusApi(req, res) {
  req.url = restoreUrl(req);
  return listener(req, res);
}
