import type { KinexusListKind } from '@kinexus/domain';

import type { PickedListFile } from '@/src/features/lists/list-file-io';

export type StashedListImport = PickedListFile & {
  kindHint?: KinexusListKind | null;
  /** IMDb/Letterboxd list URL for link import. */
  linkUrl?: string | null;
};

let stashed: StashedListImport | null = null;

export function stashListImport(payload: StashedListImport): void {
  stashed = payload;
}

export function takeStashedListImport(): StashedListImport | null {
  const next = stashed;
  stashed = null;
  return next;
}

export function peekStashedListImport(): StashedListImport | null {
  return stashed;
}
