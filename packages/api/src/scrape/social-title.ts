const TITLE_MAX = 90;
const TITLE_MIN_SENTENCE = 36;
const DESCRIPTION_MAX = 800;

const VIEWS_CHROME =
  /^\s*[\d.,]+[KkMmBb]?\s+views(?:\s*[·•]\s*[\d.,]+[KkMmBb]?\s+reactions?)?\s*(?:[|·•-]\s*)?/i;

export function looksLikeFacebookShareTitle(raw: string | null | undefined): boolean {
  const title = (raw ?? '').replace(/\u00a0/g, ' ').trim();
  if (!title.includes('|')) return false;
  return /views|\breactions?\b/i.test(title) || /\s+\|\s+Facebook\s*$/i.test(title);
}

export function isFacebookShareUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.replace(/^www\./i, '').toLowerCase();
    return (
      host === 'facebook.com' ||
      host.endsWith('.facebook.com') ||
      host === 'fb.watch' ||
      host === 'fb.com' ||
      host === 'fb.me'
    );
  } catch {
    return false;
  }
}

export function parseFacebookShareTitle(raw: string): { caption?: string; authorName?: string } {
  const decoded = raw.replace(/\u00a0/g, ' ').trim().replace(/\s+\|\s+Facebook\s*$/i, '').trim();
  if (!decoded) return {};
  const parts = decoded.split(/\s+\|\s+/).map((part) => part.trim()).filter(Boolean);
  let authorName: string | undefined;
  if (parts.length >= 2) {
    const last = parts[parts.length - 1] ?? '';
    if (last.length <= 48 && !/[.!?]$/.test(last) && !/views|\breactions?\b/i.test(last)) {
      authorName = parts.pop();
    }
  }
  if (parts[0] && /views|\breactions?\b|\bshares\b|\bcomments\b/i.test(parts[0]) && parts[0].length < 80) {
    parts.shift();
  }
  const caption = parts.join(' | ').replace(VIEWS_CHROME, '').trim();
  return { caption: caption || undefined, authorName: authorName || undefined };
}

export function shortSocialTitle(caption: string, max = TITLE_MAX): string | null {
  const line = caption.split(/\n+/)[0]?.replace(/\s+/g, ' ').trim() ?? '';
  if (!line) return null;
  if (line.length <= max) return line;
  const pieces = line.match(/[^.!?]+[.!?]+(?:["'”’)]*)(?:\s|$)|[^.!?]+$/g) ?? [line];
  let out = '';
  for (const piece of pieces) {
    const next = `${out} ${piece}`.replace(/\s+/g, ' ').trim();
    if (out && next.length > max) break;
    out = next;
    if (out.length >= TITLE_MIN_SENTENCE) break;
  }
  if (!out) out = line;
  if (out.length > max) return `${out.slice(0, max - 1).trim()}…`;
  return out;
}

export function polishSharePreview<T extends { title: string | null; description: string | null; siteName: string | null }>(
  draft: T,
  pageUrl: string,
): Omit<T, 'title' | 'description' | 'siteName'> & {
  title: string | null;
  description: string | null;
  siteName: string | null;
} {
  const facebook = isFacebookShareUrl(pageUrl) || looksLikeFacebookShareTitle(draft.title);
  let title = draft.title?.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() || null;
  let description = draft.description?.replace(/\u00a0/g, ' ').trim() || null;
  let siteName = draft.siteName;

  if (title && (facebook || looksLikeFacebookShareTitle(title))) {
    const parsed = parseFacebookShareTitle(title);
    if (parsed.caption) {
      if (!description || description === title || description.length < parsed.caption.length) {
        description = parsed.caption;
      }
      title = shortSocialTitle(parsed.caption);
      if (parsed.authorName && (!siteName || /^facebook$/i.test(siteName))) {
        siteName = parsed.authorName;
      }
    }
  } else if (title && title.length > TITLE_MAX + 20) {
    if (!description || description === title) description = title;
    title = shortSocialTitle(title);
  }

  if (description && description.length > DESCRIPTION_MAX) {
    description = `${description.slice(0, DESCRIPTION_MAX - 1).trim()}…`;
  }

  return { ...draft, title, description, siteName };
}
