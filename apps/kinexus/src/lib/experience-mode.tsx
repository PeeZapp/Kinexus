import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

export type ExperienceMode = 'desktop' | 'mobile';

const PREVIEW_STORAGE_KEY = 'kinexus.mobilePreview';

export const isMobilePreviewEnabled =
  Platform.OS === 'web' && process.env.EXPO_PUBLIC_ENABLE_MOBILE_PREVIEW === '1';

type ExperienceContextValue = {
  mode: ExperienceMode;
  isNative: boolean;
  previewEnabled: boolean;
  isPreview: boolean;
  setPreview: (on: boolean) => void;
};

const ExperienceContext = createContext<ExperienceContextValue | null>(null);

function readStoredPreview(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PREVIEW_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStoredPreview(on: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, on ? '1' : '0');
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    if (!isMobilePreviewEnabled) return;
    setIsPreview(readStoredPreview());
  }, []);

  const value = useMemo<ExperienceContextValue>(() => {
    const preview = isMobilePreviewEnabled && isPreview;
    return {
      mode: isNative || preview ? 'mobile' : 'desktop',
      isNative,
      previewEnabled: isMobilePreviewEnabled,
      isPreview: preview,
      setPreview: (on: boolean) => {
        if (!isMobilePreviewEnabled) return;
        setIsPreview(on);
        writeStoredPreview(on);
      },
    };
  }, [isNative, isPreview]);

  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

export function useExperienceMode(): ExperienceContextValue {
  const ctx = useContext(ExperienceContext);
  if (!ctx) {
    throw new Error('useExperienceMode must be used within ExperienceProvider');
  }
  return ctx;
}
