import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useExperienceMode } from '@/src/lib/experience-mode';

import { useFrameOverlayHost } from './frame-overlay';

export type AppModalProps = {
  visible?: boolean;
  transparent?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  onRequestClose?: () => void;
  children: ReactNode;
};

if (typeof document !== 'undefined' && !document.getElementById('kinexus-frame-modal-motion')) {
  const style = document.createElement('style');
  style.id = 'kinexus-frame-modal-motion';
  style.textContent =
    '@keyframes kinexus-frame-sheet-in{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes kinexus-frame-fade-in{from{opacity:0}to{opacity:1}}';
  document.head.appendChild(style);
}

function layerStyle(animationType: AppModalProps['animationType'], fixed: boolean): CSSProperties {
  return {
    position: fixed ? 'fixed' : 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation:
      animationType === 'slide'
        ? 'kinexus-frame-sheet-in 220ms ease-out'
        : animationType === 'fade'
          ? 'kinexus-frame-fade-in 160ms ease-out'
          : undefined,
  };
}

export function AppModal({
  visible = false,
  animationType = 'none',
  onRequestClose,
  children,
}: AppModalProps) {
  const frameHost = useFrameOverlayHost();
  const { isPreview } = useExperienceMode();
  const host = isPreview ? frameHost : typeof document !== 'undefined' ? document.body : null;

  useEffect(() => {
    if (!visible || !host || !onRequestClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [host, onRequestClose, visible]);

  if (!visible || !host) return null;
  return createPortal(
    <div style={layerStyle(animationType, !isPreview)} role="presentation">
      {children}
    </div>,
    host,
  );
}
