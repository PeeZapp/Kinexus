import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import {
  isStandalonePwa,
  resolveExperienceMode,
  type ExperienceMode,
  type PreviewSurface,
} from '@/src/lib/pwa';

const PREVIEW_STORAGE_KEY = 'kinexus.previewSurface';
const LEGACY_PREVIEW_STORAGE_KEY = 'kinexus.mobilePreview';

export const isMobilePreviewEnabled =
  Platform.OS === 'web' && process.env.EXPO_PUBLIC_ENABLE_MOBILE_PREVIEW === '1';

export type { ExperienceMode, PreviewSurface };

type ExperienceContextValue = {
  mode: ExperienceMode;
  isNative: boolean;
  isStandalone: boolean;
  previewEnabled: boolean;
  previewSurface: PreviewSurface;
  /** Phone or tablet frame on desktop. Modals stay inside the frame. */
  isPreview: boolean;
  setPreview: (surface: PreviewSurface) => void;
};

const ExperienceContext = createContext<ExperienceContextValue | null>(null);

function readStoredPreview(): PreviewSurface {
  if (typeof window === 'undefined') return 'desktop';
  try {
    const stored = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    if (stored === 'tablet' || stored === 'phone' || stored === 'desktop') return stored;
    if (window.localStorage.getItem(LEGACY_PREVIEW_STORAGE_KEY) === '1') return 'phone';
    return 'desktop';
  } catch {
    return 'desktop';
  }
}

function writeStoredPreview(surface: PreviewSurface) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, surface);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
  const { width } = useWindowDimensions();
  const [previewSurface, setPreviewSurface] = useState<PreviewSurface>('desktop');
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (!isMobilePreviewEnabled) return;
    setPreviewSurface(readStoredPreview());
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const update = () => setStandalone(isStandalonePwa());
    update();
    const media = window.matchMedia('(display-mode: standalone)');
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const value = useMemo<ExperienceContextValue>(() => {
    const surface: PreviewSurface = isMobilePreviewEnabled ? previewSurface : 'desktop';
    const framed = surface === 'phone' || surface === 'tablet';
    return {
      mode: resolveExperienceMode({
        isNative,
        standalone: Platform.OS === 'web' && standalone,
        width: Platform.OS === 'web' ? width : 0,
        preview: surface,
      }),
      isNative,
      isStandalone: standalone,
      previewEnabled: isMobilePreviewEnabled,
      previewSurface: surface,
      isPreview: framed,
      setPreview: (next: PreviewSurface) => {
        if (!isMobilePreviewEnabled) return;
        setPreviewSurface(next);
        writeStoredPreview(next);
      },
    };
  }, [isNative, previewSurface, standalone, width]);

  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

export function useExperienceMode(): ExperienceContextValue {
  const ctx = useContext(ExperienceContext);
  if (!ctx) {
    throw new Error('useExperienceMode must be used within ExperienceProvider');
  }
  return ctx;
}
