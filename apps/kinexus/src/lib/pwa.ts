export const MOBILE_SHELL_MAX_WIDTH = 900;

/** iPhone-class viewport used by the dev phone frame. */
export const PHONE_PREVIEW = { width: 390, height: 844 } as const;

/** Landscape iPad viewport used by the dev tablet frame. Wider than the mobile shell breakpoint, so it uses the wide layout. */
export const TABLET_PREVIEW = { width: 1180, height: 820 } as const;

export type ExperienceMode = 'desktop' | 'mobile';

export type PreviewSurface = 'desktop' | 'tablet' | 'phone';

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
  standalone: boolean;
  width: number;
  preview?: PreviewSurface;
}): ExperienceMode {
  if (input.isNative || input.standalone) return 'mobile';
  if (input.preview === 'phone') return 'mobile';
  const width = input.preview === 'tablet' ? TABLET_PREVIEW.width : input.width;
  if (width > 0 && width < MOBILE_SHELL_MAX_WIDTH) return 'mobile';
  return 'desktop';
}
