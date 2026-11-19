import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import {
  canCreateLists,
  canEditShared,
  filterSavedLinks,
  listShareLabel,
  normalizeListEmoji,
  normalizeListTheme,
  type SavedLink,
  type SavedLinkCollection,
  type SavedLinkStatus,
  type SavedLinkType,
} from '@kinexus/domain';

import { ErrorText } from '@/src/features/household/ui';
import { AddLinkSheet, AddListSheet, ListSettingsSheet, LinkSheet } from '@/src/features/stash/sheets';
import { SavesDesktop, UNCATEGORIZED_COLLECTION_ID } from '@/src/features/stash/saves/SavesDesktop';
import { SavesMobile } from '@/src/features/stash/saves/SavesMobile';
import type { WishlistListCardModel } from '@/src/features/stash/StashShared';
import {
  useStashSync,
  actionErrorMessage,
  type ListIdentityDraft,
  type ListShareDraft,
} from '@/src/features/stash/use-stash-sync';
import { LoadingState } from '@/src/features/shell/states';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';

const FAMILY_SHARE: ListShareDraft = { visibility: 'household', personIds: [] };
const DEFAULT_IDENTITY: ListIdentityDraft = {
  emoji: normalizeListEmoji('🔗'),
  theme: normalizeListTheme(null),
};
const SAVES_EMOJI = '🔗';

function toCollectionCard(
  collection: SavedLinkCollection,
  links: readonly SavedLink[],
  shareLabel: string,
): WishlistListCardModel {
  const items = links.filter((link) => link.collectionIds.includes(collection.id));
  return {
    id: collection.id,
    name: collection.name,
    emoji: SAVES_EMOJI,
    theme: normalizeListTheme(collection.color),
    coverUrl: items.find((link) => link.imageUrl)?.imageUrl ?? null,
    itemCount: items.length,
    totalCost: 0,
    hasSale: false,
    subListCount: 0,
    shareLabel,
  };
}

export function SavesScreen() {
  const { mode } = useExperienceMode();
  const { user } = useAuth();
  const { people, role } = useHousehold();
  const stash = useStashSync();
  const router = useRouter();
  const params = useLocalSearchParams<{ shareUrl?: string | string[]; listId?: string | string[] }>();
  const shareUrl = typeof params.shareUrl === 'string' ? params.shareUrl : params.shareUrl?.[0] ?? null;
  const shareListId = typeof params.listId === 'string' ? params.listId : params.listId?.[0] ?? null;
  const shareHandled = useRef(false);
  const personId = people.find((person) => person.userId === user?.id)?.id ?? null;
  const canCreate = canCreateLists(role);
  const [query, setQuery] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [type, setType] = useState<SavedLinkType | null>(null);
  const [status, setStatus] = useState<SavedLinkStatus | null>(null);
  const [addLink, setAddLink] = useState(false);
  const [shareLinkUrl, setShareLinkUrl] = useState<string | null>(null);
  const [addCollection, setAddCollection] = useState(false);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [share, setShare] = useState<ListShareDraft>(FAMILY_SHARE);
  const [identity, setIdentity] = useState<ListIdentityDraft>(DEFAULT_IDENTITY);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (shareHandled.current || !shareUrl) return;
    if (stash.loading) return;
    shareHandled.current = true;
    const targetId =
      shareListId && stash.collections.some((collection) => collection.id === shareListId)
        ? shareListId
        : null;
    if (targetId) setSelectedCollectionId(targetId);
    setShareLinkUrl(shareUrl);
    setAddLink(true);
    router.replace('/lists/saves' as Href);
  }, [router, shareListId, shareUrl, stash.collections, stash.loading]);

  const selectedCollection =
    selectedCollectionId && selectedCollectionId !== UNCATEGORIZED_COLLECTION_ID
      ? stash.collections.find((collection) => collection.id === selectedCollectionId) ?? null
      : null;
  const viewingUncategorized = selectedCollectionId === UNCATEGORIZED_COLLECTION_ID;

  const collectionCards = useMemo(() => {
    const cards = stash.collections
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((collection) =>
        toCollectionCard(collection, stash.links, listShareLabel(collection, people)),
      );
    const orphaned = stash.links.filter((link) => link.collectionIds.length === 0);
    if (orphaned.length > 0) {
      cards.push({
        id: UNCATEGORIZED_COLLECTION_ID,
        name: 'Uncategorized',
        emoji: SAVES_EMOJI,
        theme: normalizeListTheme(null),
        coverUrl: orphaned.find((link) => link.imageUrl)?.imageUrl ?? null,
        itemCount: orphaned.length,
        totalCost: 0,
        hasSale: false,
        subListCount: 0,
        shareLabel: 'Family',
      });
    }
    return cards;
  }, [people, stash.collections, stash.links]);

  const links = useMemo(() => {
    if (!selectedCollectionId) return [];
    if (viewingUncategorized) {
      return filterSavedLinks(
        stash.links.filter((link) => link.collectionIds.length === 0),
        {
          search: query,
          type,
          status,
          hideArchived: status == null,
          sort: 'newest',
        },
      );
    }
    return filterSavedLinks(stash.links, {
      search: query,
      collectionId: selectedCollectionId,
      type,
      status,
      hideArchived: status == null,
      sort: 'newest',
    });
  }, [query, selectedCollectionId, stash.links, status, type, viewingUncategorized]);

  const itemCount = useMemo(() => {
    if (!selectedCollectionId) return 0;
    if (viewingUncategorized) {
      return stash.links.filter((link) => link.collectionIds.length === 0).length;
    }
    return stash.links.filter((link) => link.collectionIds.includes(selectedCollectionId)).length;
  }, [selectedCollectionId, stash.links, viewingUncategorized]);

  const selected = stash.links.find((item) => item.id === linkId) ?? null;

  function openCollection(id: string) {
    setSelectedCollectionId(id);
    setQuery('');
    setType(null);
    setStatus(null);
  }

  function goBack() {
    setSelectedCollectionId(null);
    setQuery('');
    setType(null);
    setStatus(null);
  }

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

  function canEditCollection(collection: SavedLinkCollection) {
    return canEditShared({
      role,
      userId: user?.id ?? null,
      personId,
      createdBy: collection.createdBy,
      visibility: collection.visibility,
      personIds: collection.personIds,
    });
  }

  const layout = {
    query,
    setQuery,
    collectionCards,
    selectedCollectionId,
    selectedCollectionName: viewingUncategorized
      ? 'Uncategorized'
      : selectedCollection?.name ?? 'Saves',
    itemCount,
    onBack: goBack,
    onOpenCollection: openCollection,
    type,
    setType,
    status,
    setStatus,
    links,
    onOpen: (link: SavedLink) => setLinkId(link.id),
    onAddLink: canCreate ? () => setAddLink(true) : undefined,
    onAddCollection: canCreate ? () => setAddCollection(true) : undefined,
    onRenameCollection: (id: string) => {
      if (id === UNCATEGORIZED_COLLECTION_ID) return;
      const collection = stash.collections.find((item) => item.id === id);
      if (!collection || !canEditCollection(collection)) return;
      setRenameId(id);
      setRenameValue(collection.name);
      setShare({
        visibility: collection.visibility,
        personIds: collection.personIds,
      });
      setIdentity(DEFAULT_IDENTITY);
    },
    emptyCollections: canCreate
      ? 'Create a collection, then save links into it.'
      : 'No collections shared with you yet.',
    emptyItems: canCreate
      ? 'Paste a URL to keep a recipe, video, article, or anything else.'
      : 'Nothing in this collection yet.',
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
        placeholder="Recipes, videos, articles…"
        showIdentity={false}
        showShare
        people={people}
        busy={busy}
        error={actionError}
        onClose={() => setAddCollection(false)}
        onSave={async (name, nextShare) => {
          setActionError(null);
          setBusy(true);
          try {
            const id = await stash.createCollection(name, nextShare);
            setSelectedCollectionId(id);
            setAddCollection(false);
          } catch (err) {
            setActionError(actionErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />
      <AddLinkSheet
        visible={addLink}
        collections={stash.collections}
        people={people}
        defaultCollectionId={viewingUncategorized ? null : selectedCollectionId}
        initialUrl={shareLinkUrl}
        busy={busy}
        error={actionError}
        onClose={() => {
          setAddLink(false);
          setShareLinkUrl(null);
        }}
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
          if (await run(() => stash.createLink(draft))) {
            setAddLink(false);
            setShareLinkUrl(null);
          }
        }}
      />
      <LinkSheet
        link={selected}
        collections={stash.collections}
        people={people}
        canEdit={
          selected
            ? canEditShared({
                role,
                userId: user?.id ?? null,
                personId,
                createdBy: selected.createdBy,
                visibility: selected.visibility,
                personIds: selected.personIds,
              })
            : false
        }
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
      <ListSettingsSheet
        visible={Boolean(renameId)}
        name={renameValue}
        onNameChange={setRenameValue}
        share={share}
        onShareChange={setShare}
        identity={identity}
        onIdentityChange={setIdentity}
        people={people}
        showIdentity={false}
        busy={busy}
        error={actionError}
        onClose={() => setRenameId(null)}
        onSave={async () => {
          if (!renameId) return;
          if (await run(() => stash.renameCollection(renameId, renameValue, share))) setRenameId(null);
        }}
        onDelete={async () => {
          if (!renameId) return;
          if (await run(() => stash.deleteCollection(renameId))) {
            if (selectedCollectionId === renameId) setSelectedCollectionId(null);
            setRenameId(null);
          }
        }}
      />
    </View>
  );
}
