import { useEffect, useState } from 'react';

/** True when the trolley extension marker is on the page (web only). */
export function hasTrolleyExtension(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.documentElement.dataset.kinexusTrolley);
}

/** Re-checks on focus/visibility so installing then returning to the tab works. */
export function useTrolleyExtension(): boolean {
  const [present, setPresent] = useState(hasTrolleyExtension);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => setPresent(hasTrolleyExtension());
    check();
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return present;
}
