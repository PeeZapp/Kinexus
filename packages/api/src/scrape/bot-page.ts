/** Challenge / WAF HTML — used to decide whether to escalate to the home proxy or Playwright. */

export function isBotProtectedPage(html: string, httpStatus?: number): boolean {
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 503) return true;
  const h = html.toLowerCase();
  const sansRecaptcha = h.replace(/recaptcha/gi, '');
  const captchaWall =
    sansRecaptcha.includes('hcaptcha') ||
    /\bvisual\s*captcha\b/i.test(html) ||
    /\bplease\s+complete\s+(the\s+)?captcha\b/i.test(h);
  return (
    html.includes('<title>Just a moment...</title>') ||
    html.includes('cf-browser-verification') ||
    html.includes('cf_chl_') ||
    html.includes('Checking your browser before accessing') ||
    html.includes('Enable JavaScript and cookies to continue') ||
    html.includes('challenge-platform') ||
    /just a moment|attention required|cf-browser-verification/i.test(html) ||
    (html.includes('edgesuite.net') && html.includes('Access Denied') && html.length < 5_000) ||
    (html.includes('Reference&#32;&#35;') && html.includes('Access Denied')) ||
    captchaWall
  );
}

export function isStillBotBlocked(html: string): boolean {
  return (
    html.includes('<title>Just a moment...</title>') ||
    html.includes('cf-browser-verification') ||
    html.includes('cf_chl_') ||
    html.includes('Enable JavaScript and cookies to continue') ||
    (html.includes('Access Denied') && html.includes('permission to access') && html.length < 5_000) ||
    html.length < 1_000
  );
}

export function recoveredHtmlLooksUsable(html: string): boolean {
  if (!html || html.length < 1_200) return false;
  if (isStillBotBlocked(html) && html.length < 12_000) return false;
  return !isStillBotBlocked(html) || html.length > 12_000;
}
