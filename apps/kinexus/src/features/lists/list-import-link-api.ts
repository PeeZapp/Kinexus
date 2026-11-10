import { Platform } from 'react-native';

import { supabase } from '@/src/lib/supabase';

function configuredUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

export type ListImportLinkRow = {
  key: string;
  title: string;
  year: number | null;
  imdbId: string | null;
};

export type ListImportLinkResponse = {
  source: 'imdb' | 'letterboxd';
  suggestedName: string;
  url: string;
  pageCount: number;
  rows: ListImportLinkRow[];
};

export async function importListFromLink(url: string): Promise<ListImportLinkResponse> {
  if (!configuredUrl() && Platform.OS !== 'web') {
    throw new Error('Watchlist API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  if (!supabase) throw new Error('Sign in required');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  let res: Response;
  try {
    res = await fetch(`${configuredUrl()}/lists/import/link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch (err) {
    if (err instanceof TypeError || (err instanceof Error && /failed to fetch|networkerror|econnrefused/i.test(err.message))) {
      throw new Error('Could not reach the API. Restart with npm run dev so the API on port 5301 is running.');
    }
    throw err;
  }
  const payload = (await res.json().catch(() => ({}))) as ListImportLinkResponse & { error?: string };
  if (!res.ok) throw new Error(payload.error ?? `Request failed (${res.status})`);
  return payload;
}
