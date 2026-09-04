import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const sync = () => setOnline(window.navigator.onLine);
      sync();
      window.addEventListener('online', sync);
      window.addEventListener('offline', sync);
      return () => {
        mounted = false;
        window.removeEventListener('online', sync);
        window.removeEventListener('offline', sync);
      };
    }

    let unsubscribe: (() => void) | undefined;
    void import('@react-native-community/netinfo').then((NetInfo) => {
      if (!mounted) return;
      unsubscribe = NetInfo.default.addEventListener((state) => {
        const reachable = state.isInternetReachable;
        setOnline(Boolean(state.isConnected) && reachable !== false);
      });
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  return online;
}
