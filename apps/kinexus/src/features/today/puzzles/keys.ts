import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export function useGameKeys(enabled: boolean, onKey: (key: string, event: KeyboardEvent) => void) {
  const handler = useRef(onKey);
  handler.current = onKey;

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      handler.current(event.key, event);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [enabled]);
}
