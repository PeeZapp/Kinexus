import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { filterSavedLinks, type SavedLink, type SavedLinkType } from '@kinexus/domain';

import { ErrorText } from '@/src/features/household/ui';
import { AddLinkSheet, AddListSheet, ConfirmRename, LinkSheet } from '@/src/features/stash/sheets';
import { SavesDesktop } from '@/src/features/stash/saves/SavesDesktop';
import { SavesMobile } from '@/src/features/stash/saves/SavesMobile';
import { useStashSync, actionErrorMessage } from '@/src/features/stash/use-stash-sync';
import { LoadingState } from '@/src/features/shell/states';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function SavesScreen() {
  const { mode } = useExperienceMode();
  const stash = useStashSync();
  const [query, setQuery] = useState('');
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [type, setType] = useState<SavedLinkType | null>(null);
  const [addLink, setAddLink] = useState(false);
  const [addCollection, setAddCollection] = useState(false);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const links = useMemo(
    () =>
      filterSavedLinks(stash.links, {
        search: query,
        collectionId,
        type,
        hideArchived: true,
        sort: 'newest',
      }),
    [collectionId, query, stash.links, type],
  );
  const selected = stash.links.find((item) => item.id === linkId) ?? null;

  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setActionError(null);
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (err) {
      setActionError(actionErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const layout = {
    query,
    setQuery,
    collections: stash.collections,
    collectionId,
    setCollectionId,
    type,
    setType,
    links,
    onOpen: (link: SavedLink) => setLinkId(link.id),
    onAddLink: () => setAddLink(true),
    onAddCollection: () => setAddCollection(true),
    onRenameCollection: (id: string) => {
      const collection = stash.collections.find((item) => item.id === id);
      setRenameId(id);
      setRenameValue(collection?.name ?? '');
    },
    online: stash.online,
  };

  if (stash.loading && stash.links.length === 0 && stash.collections.length === 0) {
    return <LoadingState label="Loading saves" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ErrorText message={actionError ?? stash.error} />
      {mode === 'desktop' ? <SavesDesktop {...layout} /> : <SavesMobile {...layout} />}
      <AddListSheet
        visible={addCollection}
        title="New collection"
        busy={busy}
        error={actionError}
        onClose={() => setAddCollection(false)}
        onSave={async (name) => {
          if (await run(() => stash.createCollection(name))) setAddCollection(false);
        }}
      />
      <AddLinkSheet
        visible={addLink}
        collections={stash.collections}
        defaultCollectionId={collectionId}
        busy={busy}
        error={actionError}
        onClose={() => setAddLink(false)}
        onScrape={async (url) => {
          const scraped = await stash.scrapeLink(url);
          return {
            url,
            title: scraped.title ?? '',
            description: scraped.description ?? undefined,
            imageUrl: scraped.imageUrl ?? undefined,
            siteName: scraped.siteName ?? undefined,
            faviconUrl: scraped.faviconUrl ?? undefined,
            linkType: scraped.linkType,
          };
        }}
        onSave={async (draft) => {
          if (await run(() => stash.createLink(draft))) setAddLink(false);
        }}
      />
      <LinkSheet
        link={selected}
        collections={stash.collections}
        busy={busy}
        error={actionError}
        onClose={() => setLinkId(null)}
        onSave={async (patch) => {
          if (!selected) return;
          await run(() => stash.updateLink(selected.id, patch));
        }}
        onDelete={async () => {
          if (!selected) return;
          if (await run(() => stash.deleteLink(selected.id))) setLinkId(null);
        }}
      />
      <ConfirmRename
        visible={Boolean(renameId)}
        title="Rename collection"
        value={renameValue}
        onChange={setRenameValue}
        busy={busy}
        onClose={() => setRenameId(null)}
        onSave={async () => {
          if (!renameId) return;
          if (await run(() => stash.renameCollection(renameId, renameValue))) setRenameId(null);
        }}
        onDelete={async () => {
          if (!renameId) return;
          if (await run(() => stash.deleteCollection(renameId))) {
            if (collectionId === renameId) setCollectionId(null);
            setRenameId(null);
          }
        }}
      />
    </View>
  );
}
