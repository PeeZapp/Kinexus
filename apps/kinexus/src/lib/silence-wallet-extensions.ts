import { LogBox } from 'react-native';

/**
 * Installed browser wallets inject page scripts and then fail their own
 * handshake. Kinexus does not use those providers. Drop the noise so Expo
 * does not report it as an app error.
 */
const WALLET_NOISE =
  /Failed to connect to MetaMask|Error restoring session|Cannot redefine property: ethereum|Cannot redefine property: solana|domHealthCheck|hasEternlApi|nkbihfbeogaeaoehlefnkodbefgpgknn/i;

const CONSOLE_LEVELS = ['log', 'info', 'warn', 'error', 'debug'] as const;

type ConsoleLevel = (typeof CONSOLE_LEVELS)[number];

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name} ${value.message}\n${value.stack ?? ''}`;
  if (value && typeof value === 'object') {
    const record = value as { message?: unknown; stack?: unknown; name?: unknown };
    const parts = [record.name, record.message, record.stack].filter(
      (part) => typeof part === 'string',
    ) as string[];
    if (parts.length) return parts.join('\n');
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return '';
}

export function isWalletExtensionNoise(args: unknown[]): boolean {
  return WALLET_NOISE.test(args.map(textOf).join('\n'));
}

function installConsoleFilter(): void {
  for (const level of CONSOLE_LEVELS) {
    const current = console[level] as ((...args: unknown[]) => void) & {
      __kinexusWalletFilter?: boolean;
    };
    if (current.__kinexusWalletFilter) continue;
    const wrapped = ((...args: unknown[]) => {
      if (isWalletExtensionNoise(args)) return;
      current.apply(console, args);
    }) as typeof current;
    wrapped.__kinexusWalletFilter = true;
    console[level] = wrapped;
  }
}

function swallowWalletEvent(event: Event): void {
  const reason =
    'reason' in event
      ? (event as PromiseRejectionEvent).reason
      : 'error' in event
        ? [(event as ErrorEvent).message, (event as ErrorEvent).error]
        : [];
  const args = Array.isArray(reason) ? reason : [reason];
  if (!isWalletExtensionNoise(args)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

if (typeof window !== 'undefined') {
  LogBox.ignoreLogs([WALLET_NOISE]);
  installConsoleFilter();
  queueMicrotask(installConsoleFilter);
  window.addEventListener('error', swallowWalletEvent, true);
  window.addEventListener('unhandledrejection', swallowWalletEvent, true);
}
