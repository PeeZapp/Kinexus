import { useCallback, useEffect, useRef, useState } from 'react';
import type { PuzzleGameId } from '@kinexus/domain';

import { loadPuzzleState, savePuzzleState } from '@/src/features/today/puzzle-store';
import { useAuth } from '@/src/lib/auth';

export function usePuzzleState<T>(game: PuzzleGameId, date: string, fallback: T, revive: (raw: unknown) => T | null) {
  const { user } = useAuth();
  const [value, setValue] = useState(fallback);
  const [ready, setReady] = useState(false);
  const reviveRef = useRef(revive);
  const fallbackRef = useRef(fallback);
  reviveRef.current = revive;
  fallbackRef.current = fallback;

  useEffect(() => {
    if (!user) return;
    let live = true;
    setReady(false);
    void loadPuzzleState(user, date, game)
      .then((raw) => {
        if (!live) return;
        setValue(raw == null ? fallbackRef.current : (reviveRef.current(raw) ?? fallbackRef.current));
        setReady(true);
      })
      .catch(() => {
        if (!live) return;
        setValue(fallbackRef.current);
        setReady(true);
      });
    return () => {
      live = false;
    };
  }, [user, date, game]);

  const commit = useCallback(
    (next: T | ((current: T) => T)) => {
      setValue((current) => {
        const resolved = typeof next === 'function' ? (next as (value: T) => T)(current) : next;
        if (user) void savePuzzleState(user, date, game, resolved).catch(() => undefined);
        return resolved;
      });
    },
    [user, date, game],
  );

  return { value, commit, ready };
}
