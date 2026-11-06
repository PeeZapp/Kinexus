export type GoogleAvatarIntent = {
  intentId: string;
  expectedUserId: string;
};

export type GoogleAvatarOptInResult =
  | { ok: true; avatarSource: 'google' }
  | { ok: false; error: string; keepPreset: true };

export type GoogleAvatarReauthFn = (expectedUserId: string) => Promise<
  | { ok: true; providerToken: string; userId: string }
  | { ok: false; code: 'cancelled' | 'mismatch' | 'no_token' | 'oauth'; error: string }
>;

const INTENT_STORAGE_KEY = 'kinexus.avatarGoogle.intent';

function readSessionStorage(key: string): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionStorage(key: string, value: string): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function clearSessionStorage(key: string): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** In-memory + sessionStorage for the OAuth round trip only. Never stores Google tokens. */
let memoryIntent: GoogleAvatarIntent | null = null;

export function storeGoogleAvatarIntent(intent: GoogleAvatarIntent): void {
  memoryIntent = intent;
  writeSessionStorage(INTENT_STORAGE_KEY, JSON.stringify(intent));
}

export function takeGoogleAvatarIntent(): GoogleAvatarIntent | null {
  const fromMemory = memoryIntent;
  memoryIntent = null;
  const raw = readSessionStorage(INTENT_STORAGE_KEY);
  clearSessionStorage(INTENT_STORAGE_KEY);
  if (fromMemory?.intentId && fromMemory.expectedUserId) return fromMemory;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GoogleAvatarIntent>;
    if (typeof parsed.intentId === 'string' && typeof parsed.expectedUserId === 'string') {
      return { intentId: parsed.intentId, expectedUserId: parsed.expectedUserId };
    }
  } catch {
    // ignore
  }
  return null;
}

export function clearGoogleAvatarIntent(): void {
  memoryIntent = null;
  clearSessionStorage(INTENT_STORAGE_KEY);
}

export function sessionHasLinkedGoogleIdentity(
  identities: Array<{ provider?: string }> | null | undefined,
): boolean {
  if (!identities?.length) return false;
  return identities.some((identity) => identity.provider === 'google');
}

export type GoogleAvatarOptInDeps = {
  expectedUserId: string;
  createIntent: () => Promise<{ intentId: string; expiresAt?: string }>;
  reauth: GoogleAvatarReauthFn;
  complete: (
    intentId: string,
    googleAccessToken: string,
  ) => Promise<{ ok: true; avatarSource: 'google' }>;
  storeIntent?: typeof storeGoogleAvatarIntent;
  takeIntent?: typeof takeGoogleAvatarIntent;
  clearIntent?: typeof clearGoogleAvatarIntent;
};

/**
 * Opt-in flow: intent → Google re-auth → complete.
 * Failures leave the current preset selection; never throws.
 */
export async function runGoogleAvatarOptIn(deps: GoogleAvatarOptInDeps): Promise<GoogleAvatarOptInResult> {
  const storeIntent = deps.storeIntent ?? storeGoogleAvatarIntent;
  const takeIntent = deps.takeIntent ?? takeGoogleAvatarIntent;
  const clearIntent = deps.clearIntent ?? clearGoogleAvatarIntent;

  let intentId: string;
  try {
    const intent = await deps.createIntent();
    intentId = intent.intentId;
    storeIntent({ intentId, expectedUserId: deps.expectedUserId });
  } catch (err) {
    clearIntent();
    return {
      ok: false,
      keepPreset: true,
      error: err instanceof Error ? err.message : 'Could not start Google photo',
    };
  }

  const reauth = await deps.reauth(deps.expectedUserId);
  if (!reauth.ok) {
    clearIntent();
    return { ok: false, keepPreset: true, error: reauth.error };
  }

  if (reauth.userId !== deps.expectedUserId) {
    clearIntent();
    return {
      ok: false,
      keepPreset: true,
      error: 'Google sign-in did not match your account',
    };
  }

  const pending = takeIntent();
  if (pending && pending.expectedUserId !== deps.expectedUserId) {
    clearIntent();
    return {
      ok: false,
      keepPreset: true,
      error: 'Google sign-in did not match your account',
    };
  }

  try {
    const result = await deps.complete(intentId, reauth.providerToken);
    clearIntent();
    return { ok: true, avatarSource: result.avatarSource };
  } catch (err) {
    clearIntent();
    return {
      ok: false,
      keepPreset: true,
      error: err instanceof Error ? err.message : 'Could not use Google photo',
    };
  }
}
