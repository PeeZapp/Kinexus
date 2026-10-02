import { createContext, useContext, type ReactNode } from 'react';

const FrameOverlayContext = createContext<HTMLElement | null>(null);

export function FrameOverlayProvider({ host, children }: { host: HTMLElement | null; children: ReactNode }) {
  return <FrameOverlayContext.Provider value={host}>{children}</FrameOverlayContext.Provider>;
}

export function useFrameOverlayHost() {
  return useContext(FrameOverlayContext);
}
