import { useEffect } from 'react';
import { Platform } from 'react-native';

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
};

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    async function request() {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        sentinel = (await nav.wakeLock?.request('screen')) ?? null;
      } catch {
        sentinel = null;
      }
    }

    void request();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel && !sentinel.released) {
        void sentinel.release();
      }
      sentinel = null;
    };
  }, [active]);
}
