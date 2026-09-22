import { Platform } from 'react-native';

import type { ScrapedLink, ScrapedProduct } from '@kinexus/domain';

import { supabase } from '@/src/lib/supabase';

function configuredUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

export function isStashApiConfigured(): boolean {
  if (configuredUrl()) return true;
  return Platform.OS === 'web';
}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!isStashApiConfigured()) {
    throw new Error('Stash API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  if (!supabase) throw new Error('Sign in required');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  const res = await fetch(`${configuredUrl()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error ?? `Request failed (${res.status})`);
  return payload;
}

export type ProductScrapeResponse =
  | { source: 'json-ld' | 'og'; product: ScrapedProduct }
  | { source: 'blocked'; blocked: true };

export type LinkScrapeResponse =
  | { source: 'oembed' | 'og'; link: ScrapedLink }
  | { source: 'blocked'; blocked: true };

export type ReaderSource = 'jina' | 'wayback' | 'archive_is';

export type ArchiveViewProvider = 'wayback' | 'archive_is' | 'ghostarchive' | 'google_cache';

export type ArchiveViewSource = {
  id: ArchiveViewProvider;
  label: string;
  url: string;
};

export type ReaderDocument = {
  url: string;
  canonicalUrl: string;
  title: string | null;
  text: string;
  source: ReaderSource;
  sourceUrl: string;
  viewUrl: string | null;
  views: ArchiveViewSource[];
  fetchedAt: string;
};

export type ReaderResponse = { document: ReaderDocument };

export async function scrapeStashProduct(url: string): Promise<ProductScrapeResponse> {
  return post<ProductScrapeResponse>('/scrape-product', { url });
}

export async function scrapeStashLink(url: string): Promise<LinkScrapeResponse> {
  return post<LinkScrapeResponse>('/scrape-link', { url });
}

export async function fetchStashReader(url: string): Promise<ReaderResponse> {
  return post<ReaderResponse>('/scrape-reader', { url });
}

/** Same-origin proxy URL so frame-blocking archives (archive.is, etc.) can render in the viewer. */
export async function buildArchiveFrameUrl(archiveUrl: string): Promise<string> {
  if (!isStashApiConfigured()) {
    throw new Error('Stash API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  if (!supabase) throw new Error('Sign in required');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  const params = new URLSearchParams({
    url: archiveUrl,
    access_token: token,
  });
  return `${configuredUrl()}/archive-frame?${params.toString()}`;
}
