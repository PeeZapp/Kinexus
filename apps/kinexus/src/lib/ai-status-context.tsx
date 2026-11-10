import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { useHousehold } from '@/src/lib/household';
import { aiBlockedMessage, getAiStatus, type AiBlockedReason, type AiStatus } from '@/src/lib/ai-status';

type AiStatusContextValue = {
  status: AiStatus | null;
  blocked: AiBlockedReason | null;
  bannerDismissed: boolean;
  dismissBanner: () => void;
  refresh: () => Promise<void>;
  guardAi: () => boolean;
  blockedMessage: string | null;
  goFixKey: () => void;
};

const AiStatusContext = createContext<AiStatusContextValue | null>(null);

export function AiStatusProvider({ children }: { children: ReactNode }) {
  const { activeHousehold, canManageHousehold } = useHousehold();
  const router = useRouter();
  const householdId = activeHousehold?.id;
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const refresh = useCallback(async () => {
    if (!householdId) {
      setStatus(null);
      return;
    }
    const next = await getAiStatus(householdId);
    setStatus(next);
  }, [householdId]);

  useEffect(() => {
    setBannerDismissed(false);
    let cancel = false;
    void refresh().catch(() => {
      if (!cancel) setStatus(null);
    });
    return () => {
      cancel = true;
    };
  }, [householdId, refresh]);

  const blocked = status?.blocked ?? null;
  const blockedMessage = blocked ? aiBlockedMessage(blocked, Boolean(status?.isAdmin || canManageHousehold)) : null;

  const value = useMemo<AiStatusContextValue>(
    () => ({
      status,
      blocked,
      bannerDismissed,
      dismissBanner: () => setBannerDismissed(true),
      refresh,
      guardAi: () => {
        if (!blocked || !blockedMessage) return true;
        return false;
      },
      blockedMessage,
      goFixKey: () => router.push('/settings' as Href),
    }),
    [status, blocked, bannerDismissed, refresh, blockedMessage, router],
  );

  return <AiStatusContext.Provider value={value}>{children}</AiStatusContext.Provider>;
}

export function useAiStatus(): AiStatusContextValue {
  const ctx = useContext(AiStatusContext);
  if (!ctx) {
    return {
      status: null,
      blocked: null,
      bannerDismissed: true,
      dismissBanner: () => undefined,
      refresh: async () => undefined,
      guardAi: () => true,
      blockedMessage: null,
      goFixKey: () => undefined,
    };
  }
  return ctx;
}
