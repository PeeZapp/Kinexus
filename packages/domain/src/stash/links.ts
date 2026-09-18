import type { SavedLink, SavedLinkStatus, SavedLinkType } from './types';

export const SAVED_LINK_STATUSES: { id: SavedLinkStatus; label: string }[] = [
  { id: 'saved', label: 'Saved' },
  { id: 'try_next', label: 'Try next' },
  { id: 'tried', label: 'Tried' },
  { id: 'liked', label: 'Liked' },
  { id: 'not_for_me', label: 'Not for me' },
  { id: 'archived', label: 'Archived' },
];

export const SAVED_LINK_TYPES: { id: SavedLinkType; label: string }[] = [
  { id: 'recipe', label: 'Recipe' },
  { id: 'video', label: 'Video' },
  { id: 'article', label: 'Article' },
  { id: 'tool', label: 'Tool' },
  { id: 'place', label: 'Place' },
  { id: 'product', label: 'Product' },
  { id: 'other', label: 'Other' },
];

export function linkTypeLabel(type: SavedLinkType): string {
  return SAVED_LINK_TYPES.find((item) => item.id === type)?.label ?? 'Link';
}

export function statusLabel(status: SavedLinkStatus): string {
  return SAVED_LINK_STATUSES.find((item) => item.id === status)?.label ?? status;
}

export function canonicalizeUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    const host = url.hostname.toLowerCase();
    if (host.includes('youtube.com')) {
      const video = url.searchParams.get('v');
      if (video) return `https://www.youtube.com/watch?v=${video}`;
    }
    if (host.startsWith('www.')) url.hostname = host.slice(4);
    return url.href;
  } catch {
    return raw.trim();
  }
}

export function inferLinkType(rawUrl: string): SavedLinkType {
  let host = '';
  let path = '';
  try {
    const url = new URL(rawUrl);
    host = url.hostname.toLowerCase();
    path = url.pathname.toLowerCase();
  } catch {
    return 'other';
  }
  if (
    host.includes('youtube.com') ||
    host === 'youtu.be' ||
    host.includes('vimeo.com') ||
    host.includes('tiktok.com')
  ) {
    return 'video';
  }
  if (host.includes('maps.google') || host.includes('tripadvisor') || path.includes('/place')) return 'place';
  if (host.includes('github.com') || host.includes('npmjs.com') || path.includes('/docs')) return 'tool';
  if (path.includes('recipe') || host.includes('allrecipes') || host.includes('nytcooking')) return 'recipe';
  if (
    host.includes('amazon.') ||
    host.includes('ebay.') ||
    path.includes('/product') ||
    path.includes('/dp/') ||
    path.includes('/item')
  ) {
    return 'product';
  }
  if (path.includes('/blog') || path.includes('/article') || path.includes('/news')) return 'article';
  return 'other';
}

export type SavedLinkSort = 'newest' | 'title' | 'status' | 'type';

export function filterSavedLinks(
  links: readonly SavedLink[],
  opts: {
    search?: string;
    collectionId?: string | null;
    type?: SavedLinkType | null;
    status?: SavedLinkStatus | null;
    hideArchived?: boolean;
    sort?: SavedLinkSort;
  },
): SavedLink[] {
  let out = [...links];
  const query = opts.search?.trim().toLowerCase();
  if (query) {
    out = out.filter((link) => {
      const hay = [link.title, link.description, link.notes, link.siteName, link.url, ...link.tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }
  if (opts.collectionId) {
    out = out.filter((link) => link.collectionIds.includes(opts.collectionId!));
  }
  if (opts.type) out = out.filter((link) => link.linkType === opts.type);
  if (opts.status) out = out.filter((link) => link.status === opts.status);
  if (opts.hideArchived) out = out.filter((link) => link.status !== 'archived');

  const sort = opts.sort ?? 'newest';
  out.sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (sort === 'status') return a.status.localeCompare(b.status);
    if (sort === 'type') return a.linkType.localeCompare(b.linkType);
    return b.createdAt.localeCompare(a.createdAt);
  });
  return out;
}
