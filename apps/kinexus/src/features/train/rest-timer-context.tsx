import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Vibration } from 'react-native';

import { type RestExtra } from '@kinexus/domain';

import { useWakeLock } from '@/src/features/cook/use-wake-lock';

type RestCompleteInfo = {
  extra: RestExtra;
  score: number;
  totalSec: number;
  label: string;
  sessionHref: string | null;
};

type RestTimerState = {
  active: boolean;
  minimized: boolean;
  endsAt: number | null;
  remainingSec: number;
  totalSec: number;
  extra: RestExtra;
  score: number;
  label: string;
  sessionHref: string | null;
  sessionPath: string | null;
};

type RestTimerActions = {
  start: (input: { seconds: number; label?: string; sessionHref?: string | null; extra?: RestExtra }) => void;
  minimize: () => void;
  expand: () => void;
  dismiss: () => void;
  setScore: (score: number) => void;
  setOnComplete: (handler: ((info: RestCompleteInfo) => void) | null) => void;
};

const RestTimerContext = createContext<(RestTimerState & RestTimerActions) | null>(null);

function pathFromHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const [path] = href.split('?');
  return path || null;
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const onCompleteRef = useRef<((info: RestCompleteInfo) => void) | null>(null);
  const [active, setActive] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [totalSec, setTotalSec] = useState(0);
  const [extra, setExtra] = useState<RestExtra>('off');
  const [score, setScoreState] = useState(0);
  const [label, setLabel] = useState('Rest');
  const [sessionHref, setSessionHref] = useState<string | null>(null);
  const [sessionPath, setSessionPath] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useWakeLock(active, 'kinexus-rest');

  useEffect(() => {
    if (!active || !endsAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [active, endsAt]);

  const remainingSec = useMemo(() => {
    if (!active || !endsAt) return 0;
    return Math.max(0, Math.ceil((endsAt - now) / 1000));
  }, [active, endsAt, now]);

  const dismiss = useCallback(() => {
    setActive(false);
    setEndsAt(null);
    setMinimized(false);
    setTotalSec(0);
    setExtra('off');
    setScoreState(0);
    setLabel('Rest');
    setSessionHref(null);
    setSessionPath(null);
  }, []);

  useEffect(() => {
    if (!active || !endsAt) return;
    if (remainingSec > 0) return;
    // Complete once when time runs out.
    Vibration.vibrate(200);
    const info: RestCompleteInfo = {
      extra,
      score,
      totalSec,
      label,
      sessionHref,
    };
    try {
      onCompleteRef.current?.(info);
    } finally {
      dismiss();
    }
  }, [active, dismiss, endsAt, extra, label, remainingSec, score, sessionHref, totalSec]);

  const start = useCallback(
    (input: { seconds: number; label?: string; sessionHref?: string | null; extra?: RestExtra }) => {
      const seconds = Math.max(1, Math.floor(input.seconds || 0));
      const href = input.sessionHref ?? null;
      setActive(true);
      setMinimized(false);
      setTotalSec(seconds);
      setExtra(input.extra ?? 'off');
      setScoreState(0);
      setLabel((input.label ?? 'Rest').trim() || 'Rest');
      setSessionHref(href);
      setSessionPath(pathFromHref(href));
      const until = Date.now() + seconds * 1000;
      setEndsAt(until);
      setNow(Date.now());
    },
    [],
  );

  const minimize = useCallback(() => {
    setMinimized((current) => (active ? true : current));
  }, [active]);

  const expand = useCallback(() => {
    setMinimized(false);
  }, []);

  const setScore = useCallback((next: number) => {
    setScoreState((current) => Math.max(current, Number.isFinite(next) ? next : 0));
  }, []);

  const setOnComplete = useCallback((handler: ((info: RestCompleteInfo) => void) | null) => {
    onCompleteRef.current = handler;
  }, []);

  const value = useMemo(
    () => ({
      active,
      minimized,
      endsAt,
      remainingSec,
      totalSec,
      extra,
      score,
      label,
      sessionHref,
      sessionPath,
      start,
      minimize,
      expand,
      dismiss,
      setScore,
      setOnComplete,
    }),
    [
      active,
      minimized,
      endsAt,
      remainingSec,
      totalSec,
      extra,
      score,
      label,
      sessionHref,
      sessionPath,
      start,
      minimize,
      expand,
      dismiss,
      setScore,
      setOnComplete,
    ],
  );

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

export function useRestTimer() {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error('useRestTimer must be used within RestTimerProvider');
  return ctx;
}

