export const MOBILE_SHELL_MAX_WIDTH = 900;

export type ExperienceMode = 'desktop' | 'mobile';

export type PwaInstallPlatform = 'ios' | 'android' | 'other';

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  );
}

export function getPwaInstallPlatform(): PwaInstallPlatform {
  if (typeof window === 'undefined') return 'other';
  const ua = window.navigator.userAgent;
  const iPadOs = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/.test(ua) || iPadOs) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

export function resolveExperienceMode(input: {
  isNative: boolean;
  isPreview: boolean;
  standalone: boolean;
  width: number;
}): ExperienceMode {
  if (input.isNative || input.isPreview || input.standalone) return 'mobile';
  if (input.width > 0 && input.width < MOBILE_SHELL_MAX_WIDTH) return 'mobile';
  return 'desktop';
}
