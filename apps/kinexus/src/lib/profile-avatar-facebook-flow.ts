export type FacebookAvatarIntent = {
  intentId: string;
  expectedUserId: string;
};

export type FacebookAvatarOptInResult =
  | { ok: true; avatarSource: 'facebook' }
  | { ok: false; error: string; keepSelection: true };

export type FacebookAvatarReauthFn = (expectedUserId: string) => Promise<
  | { ok: true; providerToken: string; userId: string }
  | { ok: false; code: 'cancelled' | 'mismatch' | 'no_token' | 'oauth'; error: string }
>;

export type FacebookLinkResult =
  | { ok: true; userId: string; providerToken?: string }
  | {
      ok: false;
      code: 'cancelled' | 'mismatch' | 'already_linked_elsewhere' | 'oauth';
      error: string;
    };

const INTENT_STORAGE_KEY = 'kinexus.avatarFacebook.intent';

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

/** In-memory + sessionStorage for the OAuth round trip only. Never stores Facebook tokens. */
let memoryIntent: FacebookAvatarIntent | null = null;

export function storeFacebookAvatarIntent(intent: FacebookAvatarIntent): void {
  memoryIntent = intent;
  writeSessionStorage(INTENT_STORAGE_KEY, JSON.stringify(intent));
}

export function takeFacebookAvatarIntent(): FacebookAvatarIntent | null {
  const fromMemory = memoryIntent;
  memoryIntent = null;
  const raw = readSessionStorage(INTENT_STORAGE_KEY);
  clearSessionStorage(INTENT_STORAGE_KEY);
  if (fromMemory?.intentId && fromMemory.expectedUserId) return fromMemory;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FacebookAvatarIntent>;
    if (typeof parsed.intentId === 'string' && typeof parsed.expectedUserId === 'string') {
      return { intentId: parsed.intentId, expectedUserId: parsed.expectedUserId };
    }
  } catch {
    // ignore
  }
  return null;
}

export function clearFacebookAvatarIntent(): void {
  memoryIntent = null;
  clearSessionStorage(INTENT_STORAGE_KEY);
}

export function sessionHasLinkedFacebookIdentity(
  identities: Array<{ provider?: string }> | null | undefined,
): boolean {
  if (!identities?.length) return false;
  return identities.some((identity) => identity.provider === 'facebook');
}

/** Map Supabase / Auth errors when a Facebook identity belongs to another Kinexus user. */
export function facebookIdentityAlreadyLinkedElsewhere(message: string | null | undefined): boolean {
  if (!message) return false;
  const text = message.toLowerCase();
  return (
    (text.includes('already') && text.includes('link')) ||
    text.includes('identity is already associated') ||
    text.includes('already linked to another') ||
    text.includes('user already registered')
  );
}

export type FacebookAvatarOptInDeps = {
  expectedUserId: string;
  createIntent: () => Promise<{ intentId: string; expiresAt?: string }>;
  reauth: FacebookAvatarReauthFn;
  complete: (
    intentId: string,
    facebookAccessToken: string,
  ) => Promise<{ ok: true; avatarSource: 'facebook' }>;
  storeIntent?: typeof storeFacebookAvatarIntent;
  takeIntent?: typeof takeFacebookAvatarIntent;
  clearIntent?: typeof clearFacebookAvatarIntent;
};

/**
 * Opt-in flow: intent → Facebook re-auth (token in memory) → complete.
 * Failures leave the current selection; never throws.
 */
export async function runFacebookAvatarOptIn(
  deps: FacebookAvatarOptInDeps,
): Promise<FacebookAvatarOptInResult> {
  const storeIntent = deps.storeIntent ?? storeFacebookAvatarIntent;
  const takeIntent = deps.takeIntent ?? takeFacebookAvatarIntent;
  const clearIntent = deps.clearIntent ?? clearFacebookAvatarIntent;

  let intentId: string;
  try {
    const intent = await deps.createIntent();
    intentId = intent.intentId;
    storeIntent({ intentId, expectedUserId: deps.expectedUserId });
  } catch (err) {
    clearIntent();
    return {
      ok: false,
      keepSelection: true,
      error: err instanceof Error ? err.message : 'Could not start Facebook photo',
    };
  }

  const reauth = await deps.reauth(deps.expectedUserId);
  if (!reauth.ok) {
    clearIntent();
    return { ok: false, keepSelection: true, error: reauth.error };
  }

  if (reauth.userId !== deps.expectedUserId) {
    clearIntent();
    return {
      ok: false,
      keepSelection: true,
      error: 'Facebook did not match your account',
    };
  }

  const pending = takeIntent();
  if (pending && pending.expectedUserId !== deps.expectedUserId) {
    clearIntent();
    return {
      ok: false,
      keepSelection: true,
      error: 'Facebook did not match your account',
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
      keepSelection: true,
      error: err instanceof Error ? err.message : 'Could not use Facebook photo',
    };
  }
}
