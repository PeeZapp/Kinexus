import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { recoveredHtmlLooksUsable } from './bot-page.js';

const BROWSER_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
  '--disable-blink-features=AutomationControlled',
];

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1';

type PlaywrightBrowser = {
  isConnected: () => boolean;
  newContext: (options: Record<string, unknown>) => Promise<PlaywrightContext>;
  close: () => Promise<void>;
  on: (event: string, listener: () => void) => void;
};

type PlaywrightContext = {
  newPage: () => Promise<PlaywrightPage>;
  close: () => Promise<void>;
};

type PlaywrightPage = {
  goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>;
  mouse: {
    move: (x: number, y: number, options?: { steps?: number }) => Promise<void>;
    wheel?: (deltaX: number, deltaY: number) => Promise<void>;
  };
  waitForLoadState: (state: string, options?: { timeout?: number }) => Promise<void>;
  waitForSelector: (selector: string, options?: { timeout?: number }) => Promise<unknown>;
  content: () => Promise<string>;
};

let browser: PlaywrightBrowser | null = null;
let launchPromise: Promise<PlaywrightBrowser> | null = null;

export function playwrightEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.PLAYWRIGHT_ENABLED === '0') return false;
  if (env.VERCEL === '1' && env.PLAYWRIGHT_ENABLED !== '1') return false;
  if (env.VITEST && env.PLAYWRIGHT_TEST !== '1') return false;
  return true;
}

function findChromium(): string | null {
  const fromEnv = [process.env.PLAYWRIGHT_CHROMIUM_PATH, process.env.CHROMIUM_PATH, process.env.CHROME_PATH].find(
    (candidate) => candidate && existsSync(candidate),
  );
  if (fromEnv) return fromEnv;

  if (process.platform === 'win32') {
    const windowsCandidates = [
      process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe` : null,
      process.env['PROGRAMFILES(X86)']
        ? `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`
        : null,
      process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : null,
      process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe` : null,
      process.env['PROGRAMFILES(X86)']
        ? `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`
        : null,
    ].filter((item): item is string => Boolean(item));
    for (const candidate of windowsCandidates) {
      if (existsSync(candidate)) return candidate;
    }
    try {
      const whereChrome = execSync('where chrome', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
        .split(/\r?\n/)
        .find(Boolean)
        ?.trim();
      if (whereChrome && existsSync(whereChrome)) return whereChrome;
    } catch {
      // ignore
    }
  }

  for (const bin of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try {
      const path = execSync(`which ${bin}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      if (path) return path;
    } catch {
      // try next
    }
  }
  return null;
}

async function getBrowser(): Promise<PlaywrightBrowser> {
  if (browser?.isConnected()) return browser;
  if (launchPromise) return launchPromise;

  launchPromise = (async () => {
    const chromiumPath = findChromium();
    const extra = (await import('playwright-extra')) as unknown as {
      chromium: {
        use: (plugin: unknown) => void;
        launch: (opts: Record<string, unknown>) => Promise<PlaywrightBrowser>;
      };
    };
    const stealthMod = (await import('puppeteer-extra-plugin-stealth')) as { default?: () => unknown };
    const stealthFactory = stealthMod.default;
    if (typeof stealthFactory === 'function') {
      extra.chromium.use(stealthFactory());
    }
    const attempts: Array<{ label: string; launch: () => Promise<PlaywrightBrowser> }> = [];
    if (chromiumPath) {
      attempts.push({
        label: 'executablePath',
        launch: () =>
          extra.chromium.launch({
            executablePath: chromiumPath,
            headless: true,
            args: BROWSER_LAUNCH_ARGS,
          }) as Promise<PlaywrightBrowser>,
      });
    }
    if (process.platform === 'win32') {
      attempts.push({
        label: 'chrome channel',
        launch: () =>
          extra.chromium.launch({
            channel: 'chrome',
            headless: true,
            args: BROWSER_LAUNCH_ARGS,
          }) as Promise<PlaywrightBrowser>,
      });
    }
    attempts.push({
      label: 'playwright-core',
      launch: async () => {
        const core = await import('playwright-core');
        return core.chromium.launch({ headless: true, args: BROWSER_LAUNCH_ARGS }) as Promise<PlaywrightBrowser>;
      },
    });

    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        const next = await attempt.launch();
        next.on('disconnected', () => {
          browser = null;
        });
        return next;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Chromium executable not found');
  })()
    .then((next) => {
      browser = next;
      launchPromise = null;
      return next;
    })
    .catch((err) => {
      launchPromise = null;
      browser = null;
      throw err;
    });

  return launchPromise;
}

function inferLocale(urlStr: string): { locale: string; timezoneId: string } {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    if (host.endsWith('.com.au')) return { locale: 'en-AU', timezoneId: 'Australia/Sydney' };
  } catch {
    // ignore
  }
  return { locale: 'en-AU', timezoneId: 'Australia/Sydney' };
}

async function scrapeVariant(url: string, variant: 'desktop' | 'mobile'): Promise<string> {
  const bw = await getBrowser();
  const mobile = variant === 'mobile';
  const loc = inferLocale(url);
  const context = await bw.newContext({
    userAgent: mobile ? MOBILE_UA : DESKTOP_UA,
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: mobile ? 3 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    locale: loc.locale,
    timezoneId: loc.timezoneId,
    extraHTTPHeaders: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': loc.locale === 'en-AU' ? 'en-AU,en;q=0.9,en-US;q=0.8' : 'en-US,en;q=0.9',
    },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  try {
    try {
      const origin = `${new URL(url).origin}/`;
      if (origin !== url) {
        await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    } catch {
      // warm-up is best-effort
    }
    await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
    try {
      await page.mouse.move(200, 200);
      await page.mouse.move(480, 360, { steps: 5 });
      await page.mouse.wheel?.(0, 280);
    } catch {
      // ignore
    }
    try {
      await page.waitForLoadState('networkidle', { timeout: 12_000 });
    } catch {
      // content may already be present
    }
    try {
      await page.waitForSelector('h1, script[type="application/ld+json"], table, .setheader', { timeout: 8_000 });
    } catch {
      // fall through
    }
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    const html = await page.content();
    await context.close();
    return html;
  } catch (err) {
    await context.close().catch(() => undefined);
    throw err;
  }
}

export async function fetchHtmlViaPlaywright(url: string): Promise<string | null> {
  if (!playwrightEnabled()) return null;
  const budget = Math.min(90_000, Math.max(25_000, Number.parseInt(process.env.PLAYWRIGHT_TIMEOUT_MS || '', 10) || 55_000));
  const run = async () => {
    let html = await scrapeVariant(url, 'desktop');
    if (!recoveredHtmlLooksUsable(html)) {
      html = await scrapeVariant(url, 'mobile');
    }
    return recoveredHtmlLooksUsable(html) ? html : null;
  };
  try {
    return await Promise.race([
      run(),
      new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Playwright timed out')), budget);
      }),
    ]);
  } catch {
    return null;
  }
}
