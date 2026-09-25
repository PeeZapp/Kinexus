import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  CHECKLIST_CATEGORIES,
  CHECKLIST_PRIORITIES,
  CHECKLIST_RECURRENCES,
  STASH_LIST_EMOJIS,
  STASH_LIST_THEMES,
  dueDatePresets,
  formatListLabel,
  formatMoney,
  detailNote,
  isIsoDate,
  linkTypeLabel,
  normalizeListEmoji,
  normalizeListTheme,
  SAVED_LINK_STATUSES,
  SAVED_LINK_TYPES,
  todayIso,
  type HouseholdPerson,
  type SavedLink,
  type SavedLinkCollection,
  type StashList,
  type StashListItem,
  type StashListItemPriority,
  type StashListRecurrence,
  type StashListVisibility,
  type StashProduct,
} from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import { StashPhoto } from '@/src/features/stash/StashShared';
import type { ChecklistItemDraft, LinkDraft, ListIdentityDraft, ListShareDraft, ProductDraft } from '@/src/features/stash/use-stash-sync';
import { colors, radius, space } from '@/src/features/shell/theme';

function openUrl(url: string) {
  if (!url) return;
  void Linking.openURL(url);
}

function SharePicker({
  share,
  onChange,
  people,
}: {
  share: ListShareDraft;
  onChange: (share: ListShareDraft) => void;
  people: HouseholdPerson[];
}) {
  function setVisibility(visibility: StashListVisibility) {
    onChange({ visibility, personIds: visibility === 'people' ? share.personIds : [] });
  }
  function togglePerson(id: string) {
    const on = share.personIds.includes(id);
    onChange({
      visibility: 'people',
      personIds: on ? share.personIds.filter((item) => item !== id) : [...share.personIds, id],
    });
  }
  return (
    <View style={styles.stackInner}>
      <Text style={styles.label}>Who can see this</Text>
      <View style={styles.wrap}>
        <Pill label="Whole family" active={share.visibility === 'household'} onPress={() => setVisibility('household')} />
        <Pill label="Private" active={share.visibility === 'private'} onPress={() => setVisibility('private')} />
        <Pill label="Specific people" active={share.visibility === 'people'} onPress={() => setVisibility('people')} />
      </View>
      {share.visibility === 'people' ? (
        people.length === 0 ? (
          <Text style={styles.meta}>Add people in Settings first, then share a list with them.</Text>
        ) : (
          <View style={styles.wrap}>
            {people.map((person) => (
              <Pill
                key={person.id}
                label={person.name}
                active={share.personIds.includes(person.id)}
                onPress={() => togglePerson(person.id)}
              />
            ))}
          </View>
        )
      ) : null}
      {share.visibility === 'private' ? (
        <Text style={styles.meta}>Only you and household admins can see this list.</Text>
      ) : null}
    </View>
  );
}

function ListIdentityPicker({
  identity,
  onChange,
}: {
  identity: ListIdentityDraft;
  onChange: (identity: ListIdentityDraft) => void;
}) {
  return (
    <View style={styles.stackInner}>
      <Text style={styles.label}>Emoji</Text>
      <View style={styles.wrap}>
        {STASH_LIST_EMOJIS.map((emoji) => {
          const active = identity.emoji === emoji;
          return (
            <Pressable
              key={emoji}
              onPress={() => onChange({ ...identity, emoji })}
              style={[styles.emojiChip, active && styles.emojiChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}>
              <Text style={styles.emojiChipText}>{emoji}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.label}>Theme</Text>
      <View style={styles.wrap}>
        {STASH_LIST_THEMES.map((theme) => {
          const active = identity.theme === theme.color;
          return (
            <Pressable
              key={theme.id}
              onPress={() => onChange({ ...identity, theme: theme.color })}
              style={[styles.themeChip, { backgroundColor: theme.color }, active && styles.themeChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={theme.id}
            />
          );
        })}
      </View>
    </View>
  );
}

export function AddListSheet({
  visible,
  title,
  people = [],
  showShare = false,
  showIdentity = true,
  defaultShare,
  defaultIdentity,
  placeholder = 'Birthday ideas',
  onClose,
  onSave,
  busy,
  error,
}: {
  visible: boolean;
  title: string;
  people?: HouseholdPerson[];
  showShare?: boolean;
  showIdentity?: boolean;
  defaultShare?: ListShareDraft;
  defaultIdentity?: ListIdentityDraft;
  placeholder?: string;
  onClose: () => void;
  onSave: (name: string, share: ListShareDraft, identity: ListIdentityDraft) => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [name, setName] = useState('');
  const [share, setShare] = useState<ListShareDraft>(defaultShare ?? { visibility: 'household', personIds: [] });
  const [identity, setIdentity] = useState<ListIdentityDraft>({
    emoji: normalizeListEmoji(defaultIdentity?.emoji),
    theme: normalizeListTheme(defaultIdentity?.theme),
  });
  useEffect(() => {
    if (!visible) return;
    setName('');
    setShare(defaultShare ?? { visibility: 'household', personIds: [] });
    setIdentity({
      emoji: normalizeListEmoji(defaultIdentity?.emoji),
      theme: normalizeListTheme(defaultIdentity?.theme),
    });
  }, [visible]);
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <View style={styles.stack}>
        <Field label="Name" value={name} onChangeText={setName} placeholder={placeholder} autoCapitalize="words" />
        {showIdentity ? <ListIdentityPicker identity={identity} onChange={setIdentity} /> : null}
        {showShare ? <SharePicker share={share} onChange={setShare} people={people} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn
          label="Create list"
          onPress={() => void onSave(name, share, identity)}
          busy={busy}
          disabled={!name.trim() || (showShare && share.visibility === 'people' && share.personIds.length === 0)}
        />
      </View>
    </Sheet>
  );
}

export function ListSettingsSheet({
  visible,
  name,
  onNameChange,
  share,
  onShareChange,
  identity,
  onIdentityChange,
  people,
  onClose,
  onSave,
  onDelete,
  busy,
  error,
}: {
  visible: boolean;
  name: string;
  onNameChange: (v: string) => void;
  share: ListShareDraft;
  onShareChange: (share: ListShareDraft) => void;
  identity: ListIdentityDraft;
  onIdentityChange: (identity: ListIdentityDraft) => void;
  people: HouseholdPerson[];
  onClose: () => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  return (
    <Sheet visible={visible} title="List settings" onClose={onClose}>
      <View style={styles.stack}>
        <Field label="Name" value={name} onChangeText={onNameChange} />
        <ListIdentityPicker identity={identity} onChange={onIdentityChange} />
        <SharePicker share={share} onChange={onShareChange} people={people} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn
          label="Save"
          onPress={() => void onSave()}
          busy={busy}
          disabled={!name.trim() || (share.visibility === 'people' && share.personIds.length === 0)}
        />
        {onDelete ? <Btn label="Delete list" variant="danger" onPress={() => void onDelete()} /> : null}
      </View>
    </Sheet>
  );
}

export function ChecklistItemSheet({
  visible,
  item,
  people = [],
  onClose,
  onSave,
  onDelete,
  busy,
  error,
}: {
  visible: boolean;
  item: StashListItem | null;
  people?: HouseholdPerson[];
  onClose: () => void;
  onSave: (draft: ChecklistItemDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [priority, setPriority] = useState<StashListItemPriority>(0);
  const [dueOn, setDueOn] = useState<string | null>(null);
  const [dueText, setDueText] = useState('');
  const [recurrence, setRecurrence] = useState<StashListRecurrence>('none');
  const [assignedPersonId, setAssignedPersonId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const today = todayIso();
  const presets = dueDatePresets(today);

  useEffect(() => {
    if (!visible) return;
    setTitle(item?.title ?? '');
    setNotes(item?.notes ?? '');
    setCategory(item?.category ?? null);
    setPriority(item?.priority ?? 0);
    setDueOn(item?.dueOn ?? null);
    setDueText(item?.dueOn ?? '');
    setRecurrence(item?.recurrence ?? 'none');
    setAssignedPersonId(item?.assignedPersonId ?? null);
    setLocalError(null);
  }, [item, visible]);

  function chooseDue(next: string | null) {
    setDueOn(next);
    setDueText(next ?? '');
  }

  async function save() {
    const typed = dueText.trim();
    let nextDue = dueOn;
    if (typed) {
      if (!isIsoDate(typed)) {
        setLocalError('Due date needs to be YYYY-MM-DD');
        return;
      }
      nextDue = typed;
    } else {
      nextDue = null;
    }
    if (recurrence !== 'none' && !nextDue) nextDue = today;
    setLocalError(null);
    await onSave({ title, notes, category, priority, dueOn: nextDue, recurrence, assignedPersonId });
  }

  const presetMatch = presets.some((preset) => preset.dueOn === dueOn);

  return (
    <Sheet visible={visible} title={item ? 'Edit item' : 'Add item'} onClose={onClose}>
      <View style={styles.stack}>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Milk, take bins out…" autoCapitalize="sentences" />
        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional details"
          autoCapitalize="sentences"
          multiline
          numberOfLines={4}
        />
        <Text style={styles.label}>Due</Text>
        <View style={styles.wrap}>
          {presets.map((preset) => (
            <Pill key={preset.id} label={preset.label} active={dueOn === preset.dueOn} onPress={() => chooseDue(preset.dueOn)} />
          ))}
          {dueOn && !presetMatch ? <Pill label={dueOn} active /> : null}
        </View>
        <Field
          label="Or a specific date"
          value={dueText}
          onChangeText={(value) => {
            setDueText(value);
            setDueOn(isIsoDate(value.trim()) ? value.trim() : dueOn);
          }}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />
        <Text style={styles.label}>Repeat</Text>
        <View style={styles.wrap}>
          {CHECKLIST_RECURRENCES.map((entry) => (
            <Pill key={entry.id} label={entry.label} active={recurrence === entry.id} onPress={() => setRecurrence(entry.id)} />
          ))}
        </View>
        <Text style={styles.label}>Assigned to</Text>
        <View style={styles.wrap}>
          <Pill label="Anyone" active={!assignedPersonId} onPress={() => setAssignedPersonId(null)} />
          {people.map((person) => (
            <Pill
              key={person.id}
              label={person.name}
              active={assignedPersonId === person.id}
              onPress={() => setAssignedPersonId(person.id)}
            />
          ))}
        </View>
        {people.length === 0 ? <Text style={styles.meta}>Add people in Settings to assign chores.</Text> : null}
        <Text style={styles.label}>Category</Text>
        <View style={styles.wrap}>
          <Pill label="None" active={!category} onPress={() => setCategory(null)} />
          {CHECKLIST_CATEGORIES.map((entry) => (
            <Pill key={entry.id} label={entry.label} active={category === entry.id} onPress={() => setCategory(entry.id)} />
          ))}
        </View>
        <Text style={styles.label}>Priority</Text>
        <View style={styles.wrap}>
          {CHECKLIST_PRIORITIES.map((entry) => (
            <Pill key={entry.id} label={entry.label} active={priority === entry.id} onPress={() => setPriority(entry.id)} />
          ))}
        </View>
        {localError || error ? <Text style={styles.error}>{localError ?? error}</Text> : null}
        <Btn label={item ? 'Save item' : 'Add item'} onPress={() => void save()} busy={busy} disabled={!title.trim()} />
        {item && dueOn !== today ? (
          <Btn
            label="Add to today"
            variant="secondary"
            onPress={() => {
              chooseDue(today);
              void onSave({
                title,
                notes,
                category,
                priority,
                dueOn: today,
                recurrence,
                assignedPersonId,
              });
            }}
            busy={busy}
            disabled={!title.trim() || busy}
          />
        ) : null}
        {item && onDelete ? <Btn label="Delete item" variant="danger" onPress={() => void onDelete()} /> : null}
      </View>
    </Sheet>
  );
}

export function AddProductSheet({
  visible,
  lists,
  defaultListId,
  onClose,
  onScrape,
  onSave,
  busy,
  error,
}: {
  visible: boolean;
  lists: StashList[];
  defaultListId: string | null;
  onClose: () => void;
  onScrape: (url: string) => Promise<ProductDraft>;
  onSave: (draft: ProductDraft) => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [store, setStore] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [listId, setListId] = useState<string | null>(defaultListId);
  const [scrapeBusy, setScrapeBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [priceDeferred, setPriceDeferred] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setUrl('');
    setTitle('');
    setPrice('');
    setStore('');
    setImageUrl('');
    setNotes('');
    setListId(defaultListId);
    setLocalError(null);
    setPriceDeferred(false);
  }, [defaultListId, visible]);

  async function scrape() {
    setLocalError(null);
    setScrapeBusy(true);
    try {
      const draft = await onScrape(url);
      setTitle(draft.title || title);
      if (draft.currentPrice != null && String(draft.currentPrice).trim() !== '') setPrice(String(draft.currentPrice));
      if (draft.storeName) setStore(draft.storeName);
      if (draft.imageUrl) setImageUrl(draft.imageUrl);
      if (draft.notes) setNotes(draft.notes);
      setPriceDeferred(!String(draft.currentPrice ?? '').trim());
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not look up that URL');
    } finally {
      setScrapeBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Add item" onClose={onClose}>
      <View style={styles.stack}>
        <Field label="Product URL" value={url} onChangeText={setUrl} placeholder="https://" autoCapitalize="none" />
        <Btn label={scrapeBusy ? 'Looking up…' : 'Look up URL'} onPress={() => void scrape()} busy={scrapeBusy} disabled={!url.trim()} variant="secondary" />
        <Field label="Name" value={title} onChangeText={setTitle} placeholder="What is it?" autoCapitalize="words" />
        <Field
          label="Price"
          value={price}
          onChangeText={(next) => {
            setPrice(next);
            if (next.trim()) setPriceDeferred(false);
          }}
          placeholder="49.00"
          keyboardType="decimal-pad"
        />
        <Field label="Store" value={store} onChangeText={setStore} placeholder="Store name" />
        <Field label="Image URL" value={imageUrl} onChangeText={setImageUrl} placeholder="Optional" autoCapitalize="none" />
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Size, colour, who it’s for" />
        {lists.length > 0 ? (
          <View style={styles.wrap}>
            <Pill label="No list" active={!listId} onPress={() => setListId(null)} />
            {lists.map((list) => (
              <Pill key={list.id} label={formatListLabel(list, lists)} active={listId === list.id} onPress={() => setListId(list.id)} />
            ))}
          </View>
        ) : null}
        {priceDeferred && !price.trim() ? <Text style={styles.note}>{detailNote('pending', 0)}</Text> : null}
        {localError || error ? <Text style={styles.error}>{localError ?? error}</Text> : null}
        <Btn
          label="Save item"
          onPress={() =>
            void onSave({
              title,
              sourceUrl: url,
              currentPrice: price,
              storeName: store,
              imageUrl,
              notes,
              listId,
              priceSource: url.trim() ? 'scraped' : 'manual',
            })
          }
          busy={busy}
          disabled={!title.trim()}
        />
      </View>
    </Sheet>
  );
}

export function ProductSheet({
  product,
  lists,
  membershipIds,
  currency,
  onClose,
  onSave,
  onToggleList,
  onRefresh,
  onDelete,
  busy,
  error,
}: {
  product: StashProduct | null;
  lists: StashList[];
  membershipIds: string[];
  currency: string;
  onClose: () => void;
  onSave: (draft: ProductDraft) => Promise<void>;
  onToggleList: (listId: string, on: boolean) => Promise<void>;
  onRefresh: () => Promise<void>;
  onDelete: () => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [original, setOriginal] = useState('');
  const [store, setStore] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!product) return;
    setTitle(product.title);
    setPrice(product.currentPrice != null ? String(product.currentPrice) : '');
    setOriginal(product.originalPrice != null ? String(product.originalPrice) : '');
    setStore(product.storeName ?? '');
    setNotes(product.notes ?? '');
  }, [product]);

  return (
    <Sheet visible={Boolean(product)} title={product?.title ?? 'Item'} onClose={onClose}>
      {product ? (
        <View style={styles.stack}>
          <StashPhoto uri={product.imageUrl} size={180} />
          {product.detailStatus === 'pending' ? (
            <Text style={styles.note}>{detailNote(product.detailStatus, product.detailAttempts)}</Text>
          ) : (
            <Text style={styles.heroPrice}>{formatMoney(product.currentPrice, currency)}</Text>
          )}
          {product.isOnSale ? <Text style={styles.sale}>Was {formatMoney(product.originalPrice, currency)}</Text> : null}
          <Field label="Name" value={title} onChangeText={setTitle} />
          <Field label="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          <Field label="Original price" value={original} onChangeText={setOriginal} keyboardType="decimal-pad" />
          <Field label="Store" value={store} onChangeText={setStore} />
          <Field label="Notes" value={notes} onChangeText={setNotes} />
          <View style={styles.wrap}>
            {lists.map((list) => {
              const on = membershipIds.includes(list.id);
              return <Pill key={list.id} label={formatListLabel(list, lists)} active={on} onPress={() => void onToggleList(list.id, !on)} />;
            })}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Btn
            label="Save changes"
            onPress={() =>
              void onSave({
                title,
                currentPrice: price,
                originalPrice: original,
                storeName: store,
                notes,
              })
            }
            busy={busy}
          />
          {product.sourceUrl ? (
            <>
              <Btn label="Open listing" variant="secondary" onPress={() => openUrl(product.sourceUrl)} />
              <Btn label="Refresh from URL" variant="secondary" onPress={() => void onRefresh()} busy={busy} />
            </>
          ) : null}
          <Btn label="Remove item" variant="danger" onPress={() => void onDelete()} />
        </View>
      ) : null}
    </Sheet>
  );
}

function readyToScrape(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

export function AddLinkSheet({
  visible,
  collections,
  defaultCollectionId,
  onClose,
  onScrape,
  onSave,
  busy,
  error,
}: {
  visible: boolean;
  collections: SavedLinkCollection[];
  defaultCollectionId: string | null;
  onClose: () => void;
  onScrape: (url: string) => Promise<LinkDraft>;
  onSave: (draft: LinkDraft) => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [collectionId, setCollectionId] = useState<string | null>(defaultCollectionId);
  const [draft, setDraft] = useState<Partial<LinkDraft>>({});
  const [scrapedForUrl, setScrapedForUrl] = useState<string | null>(null);
  const [scrapeBusy, setScrapeBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const scrapeRef = useRef(onScrape);
  const requestId = useRef(0);
  scrapeRef.current = onScrape;

  useEffect(() => {
    if (!visible) {
      requestId.current += 1;
      return;
    }
    requestId.current += 1;
    setUrl('');
    setTitle('');
    setNotes('');
    setCollectionId(defaultCollectionId);
    setDraft({});
    setScrapedForUrl(null);
    setLocalError(null);
  }, [defaultCollectionId, visible]);

  async function lookup(target: string): Promise<LinkDraft | null> {
    const trimmed = target.trim();
    if (!readyToScrape(trimmed)) return null;
    const id = ++requestId.current;
    setLocalError(null);
    setScrapeBusy(true);
    try {
      const next = await scrapeRef.current(trimmed);
      if (id !== requestId.current) return next;
      setDraft(next);
      setTitle((prev) => prev.trim() || next.title?.trim() || '');
      setScrapedForUrl(trimmed);
      if (!next.title && !next.imageUrl) {
        setLocalError('No title or image on that page. You can still save the link.');
      }
      return next;
    } catch (err) {
      if (id !== requestId.current) return null;
      setScrapedForUrl(trimmed);
      setLocalError(err instanceof Error ? err.message : 'Could not look up that URL');
      return null;
    } finally {
      if (id === requestId.current) setScrapeBusy(false);
    }
  }

  useEffect(() => {
    if (!visible) return;
    const trimmed = url.trim();
    if (trimmed !== scrapedForUrl) setDraft({});
    if (!readyToScrape(trimmed) || scrapedForUrl === trimmed) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) void lookup(trimmed);
    }, 650);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scrapedForUrl, url, visible]);

  async function submit() {
    const trimmed = url.trim();
    let next = draft;
    if (scrapedForUrl !== trimmed) {
      const scraped = await lookup(trimmed);
      if (scraped) next = scraped;
    }
    await onSave({
      url: trimmed,
      title: title || next.title,
      description: next.description,
      imageUrl: next.imageUrl,
      siteName: next.siteName,
      faviconUrl: next.faviconUrl,
      linkType: next.linkType,
      notes,
      collectionId,
    });
  }

  const preview = draft.imageUrl || draft.faviconUrl || draft.title || draft.siteName || draft.description;

  return (
    <Sheet visible={visible} title="Save a link" onClose={onClose}>
      <View style={styles.stack}>
        <Field
          label="URL"
          value={url}
          onChangeText={setUrl}
          placeholder="https://"
          autoCapitalize="none"
          keyboardType="url"
        />
        <Text style={styles.meta}>Paste a link — we’ll fill in the title and image.</Text>
        <Btn
          label={scrapeBusy ? 'Looking up…' : 'Look up URL'}
          variant="secondary"
          onPress={() => void lookup(url)}
          busy={scrapeBusy}
          disabled={!url.trim()}
        />
        {preview ? (
          <View style={styles.preview}>
            <StashPhoto uri={draft.imageUrl || draft.faviconUrl} fallback="🔗" size={72} />
            <View style={styles.previewBody}>
              {draft.siteName || draft.linkType ? (
                <Text style={styles.meta} numberOfLines={1}>
                  {draft.siteName || draft.linkType}
                </Text>
              ) : null}
              {draft.description ? (
                <Text style={styles.previewDesc} numberOfLines={3}>
                  {draft.description}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Optional — we’ll fill this in" />
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Why you saved it" />
        {collections.length > 0 ? (
          <View style={styles.wrap}>
            <Pill label="No collection" active={!collectionId} onPress={() => setCollectionId(null)} />
            {collections.map((collection) => (
              <Pill
                key={collection.id}
                label={collection.name}
                active={collectionId === collection.id}
                onPress={() => setCollectionId(collection.id)}
              />
            ))}
          </View>
        ) : null}
        {localError || error ? <Text style={styles.error}>{localError ?? error}</Text> : null}
        <Btn label="Save link" onPress={() => void submit()} busy={busy || scrapeBusy} disabled={!url.trim()} />
      </View>
    </Sheet>
  );
}

export function LinkSheet({
  link,
  collections,
  onClose,
  onSave,
  onDelete,
  busy,
  error,
}: {
  link: SavedLink | null;
  collections: SavedLinkCollection[];
  onClose: () => void;
  onSave: (patch: { title?: string; notes?: string | null; status?: SavedLink['status']; linkType?: SavedLink['linkType']; collectionIds?: string[] }) => Promise<void>;
  onDelete: () => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [collectionIds, setCollectionIds] = useState<string[]>([]);

  useEffect(() => {
    if (!link) return;
    setTitle(link.title);
    setNotes(link.notes ?? '');
    setCollectionIds(link.collectionIds);
  }, [link]);

  return (
    <Sheet visible={Boolean(link)} title={link?.title ?? 'Link'} onClose={onClose}>
      {link ? (
        <View style={styles.stack}>
          <StashPhoto uri={link.imageUrl || link.faviconUrl} fallback="🔗" size={180} />
          <Text style={styles.meta}>
            {link.siteName || link.url} · {linkTypeLabel(link.linkType)}
          </Text>
          <Field label="Title" value={title} onChangeText={setTitle} />
          <Field label="Notes" value={notes} onChangeText={setNotes} />
          <Text style={styles.label}>Status</Text>
          <View style={styles.wrap}>
            {SAVED_LINK_STATUSES.map((status) => (
              <Pill key={status.id} label={status.label} active={link.status === status.id} onPress={() => void onSave({ status: status.id })} />
            ))}
          </View>
          <Text style={styles.label}>Type</Text>
          <View style={styles.wrap}>
            {SAVED_LINK_TYPES.map((type) => (
              <Pill key={type.id} label={type.label} active={link.linkType === type.id} onPress={() => void onSave({ linkType: type.id })} />
            ))}
          </View>
          {collections.length > 0 ? (
            <>
              <Text style={styles.label}>Collections</Text>
              <View style={styles.wrap}>
                {collections.map((collection) => {
                  const on = collectionIds.includes(collection.id);
                  return (
                    <Pill
                      key={collection.id}
                      label={collection.name}
                      active={on}
                      onPress={() => {
                        const next = on ? collectionIds.filter((id) => id !== collection.id) : [...collectionIds, collection.id];
                        setCollectionIds(next);
                        void onSave({ collectionIds: next });
                      }}
                    />
                  );
                })}
              </View>
            </>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Btn label="Save" onPress={() => void onSave({ title, notes })} busy={busy} />
          <Btn label="Open link" variant="secondary" onPress={() => openUrl(link.url)} />
          <Btn
            label="Read archived"
            variant="secondary"
            onPress={() => {
              onClose();
              router.push({ pathname: '/lists/reader', params: { url: link.url } });
            }}
          />
          <Btn label="Remove link" variant="danger" onPress={() => void onDelete()} />
        </View>
      ) : null}
    </Sheet>
  );
}

export function ConfirmRename({
  visible,
  title,
  value,
  onChange,
  onClose,
  onSave,
  onDelete,
  busy,
}: {
  visible: boolean;
  title: string;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  busy?: boolean;
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <View style={styles.stack}>
        <Field label="Name" value={value} onChangeText={onChange} />
        <Btn label="Save" onPress={() => void onSave()} busy={busy} disabled={!value.trim()} />
        {onDelete ? <Btn label="Delete" variant="danger" onPress={() => void onDelete()} /> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: space.lg },
  stackInner: { gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  heroPrice: { color: colors.text, fontSize: 22, fontWeight: '800' },
  sale: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  preview: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  previewBody: { flex: 1, gap: 4, minWidth: 0 },
  previewDesc: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiChipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  emojiChipText: { fontSize: 22 },
  themeChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeChipOn: {
    borderColor: colors.text,
  },
});
