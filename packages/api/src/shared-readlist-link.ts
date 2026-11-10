import { createServiceClient, isServiceRoleConfigured } from './supabase-admin.js';

export type SharedReadlistBook = {
  workId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  year: number | null;
  status: 'want_to_read' | 'reading' | 'finished';
};

export type SharedReadlistPayload = {
  name: string;
  ownerUsername: string | null;
  books: SharedReadlistBook[];
};

export type SharedReadlistLinkDeps = {
  isConfigured: () => boolean;
  createClient: () => ReturnType<typeof createServiceClient>;
};

const defaultDeps: SharedReadlistLinkDeps = {
  isConfigured: isServiceRoleConfigured,
  createClient: createServiceClient,
};

const STATUSES = new Set(['want_to_read', 'reading', 'finished']);

function asUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function authorsFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) {
      out.push(entry.trim());
      continue;
    }
    if (entry && typeof entry === 'object' && 'name' in entry && typeof (entry as { name: unknown }).name === 'string') {
      const name = (entry as { name: string }).name.trim();
      if (name) out.push(name);
    }
  }
  return out;
}

export async function handleGetSharedReadlist(
  token: string,
  deps: SharedReadlistLinkDeps = defaultDeps,
): Promise<{ status: number; body: SharedReadlistPayload | { error: string } }> {
  const trimmed = token.trim();
  if (!trimmed) return { status: 400, body: { error: 'Share token required' } };
  if (!deps.isConfigured()) {
    return { status: 503, body: { error: 'Shared readlists are not configured' } };
  }

  const client = deps.createClient();
  const { data: list, error: listError } = await client
    .from('readlist_lists')
    .select('id, name, created_by, is_shared')
    .eq('share_token', trimmed)
    .eq('is_shared', true)
    .maybeSingle();

  if (listError) return { status: 500, body: { error: listError.message } };
  if (!list) {
    return { status: 404, body: { error: 'List not found or not shared' } };
  }

  let ownerUsername: string | null = null;
  if (list.created_by) {
    const { data: profiles } = await client.rpc('public_profiles', { p_ids: [list.created_by] });
    const profile = Array.isArray(profiles) ? profiles[0] : null;
    ownerUsername = asUsername(profile?.username) ?? asUsername(profile?.global_handle);
  }

  const { data: items, error: itemsError } = await client
    .from('readlist_items')
    .select('work_id, status')
    .eq('list_id', list.id);
  if (itemsError) return { status: 500, body: { error: itemsError.message } };

  const rows = items ?? [];
  if (rows.length === 0) {
    return { status: 200, body: { name: list.name, ownerUsername, books: [] } };
  }

  const workIds = [...new Set(rows.map((row) => row.work_id))];
  const { data: works, error: worksError } = await client
    .from('readlist_works')
    .select('id, title, authors, cover_url, first_published_year')
    .in('id', workIds);
  if (worksError) return { status: 500, body: { error: worksError.message } };

  const workById = new Map((works ?? []).map((row) => [row.id, row]));
  const books: SharedReadlistBook[] = [];
  for (const row of rows) {
    const work = workById.get(row.work_id);
    if (!work) continue;
    const status = STATUSES.has(row.status) ? (row.status as SharedReadlistBook['status']) : 'want_to_read';
    books.push({
      workId: work.id,
      title: work.title,
      authors: authorsFromJson(work.authors),
      coverUrl: work.cover_url,
      year: work.first_published_year,
      status,
    });
  }
  books.sort((a, b) => a.title.localeCompare(b.title));

  return {
    status: 200,
    body: {
      name: list.name,
      ownerUsername,
      books,
    },
  };
}
