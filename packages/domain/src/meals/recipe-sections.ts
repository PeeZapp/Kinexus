import { shoppingMergeKey } from './ingredient-merge';
import type { RecipeMethodStep } from './types';

export type SectionGroup<T> = {
  key: string;
  section?: string;
  items: T[];
};

function cleanSection(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** Strip "For the" / "For" prefixes so "For the sauce" matches "sauce ingredients". */
function sectionMatchLabel(section: string): string {
  return section.replace(/^(?:for\s+the\s+|for\s+)/i, '').trim() || section.trim();
}

export type NormalizedMethodStep = { text: string; section?: string };

/**
 * Normalizes saved household recipe method steps into a flat list of step objects.
 *
 * Back-compat:
 * - `string[]` is accepted
 * - `"# Heading"` strings are treated as section headings for following steps
 * - `{ text, section }[]` is accepted
 */
export function normalizeRecipeMethodSteps(method: readonly RecipeMethodStep[] | null | undefined): NormalizedMethodStep[] {
  if (!Array.isArray(method) || method.length === 0) return [];
  const steps: NormalizedMethodStep[] = [];
  let currentSection: string | undefined;

  for (const item of method) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('# ')) {
        currentSection = cleanSection(trimmed.slice(2));
        continue;
      }
      steps.push({ text: trimmed, section: currentSection });
      continue;
    }

    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const text = typeof rec.text === 'string' ? rec.text.trim() : '';
    if (!text) continue;
    if (text.startsWith('# ') && rec.section == null) {
      currentSection = cleanSection(text.slice(2));
      continue;
    }
    steps.push({ text, section: cleanSection(rec.section) ?? currentSection });
  }

  return steps;
}

export function groupBySection<T>(
  items: readonly T[],
  sectionOf: (item: T) => string | null | undefined,
): SectionGroup<T>[] {
  const groups: SectionGroup<T>[] = [];
  for (const item of items) {
    const section = cleanSection(sectionOf(item));
    const last = groups[groups.length - 1];
    if (last && last.section === section) {
      last.items.push(item);
    } else {
      groups.push({ key: `${section ?? 'all'}-${groups.length}`, section, items: [item] });
    }
  }
  return groups;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchIndex(haystack: string, needle: string): { index: number; length: number } | null {
  const name = needle.trim();
  if (!name) return null;
  // Too short: avoids noisy hits like "a", "in", "on", "oil" in "boil".
  if (name.length < 3) return null;

  const hay = haystack;
  if (name.includes(' ')) {
    const index = hay.toLowerCase().indexOf(name.toLowerCase());
    return index >= 0 ? { index, length: name.length } : null;
  }

  const re = new RegExp(`\\b${escapeRegex(name)}\\b`, 'i');
  const hit = re.exec(hay);
  if (!hit || hit.index == null) return null;
  return { index: hit.index, length: hit[0]?.length ?? name.length };
}

/**
 * Find where an ingredient is mentioned in a step.
 * Prefers the raw name, then the shopping merge key (so "garlic cloves" /
 * "minced garlic" / "cloves of garlic" all align).
 */
function findIngredientHit(stepText: string, ingredientName: string): { index: number; length: number; score: number } | null {
  const exact = matchIndex(stepText, ingredientName);
  if (exact) return { ...exact, score: ingredientName.trim().length + 100 };

  const key = shoppingMergeKey(ingredientName);
  if (!key || key.length < 3) return null;
  if (key.toLowerCase() === ingredientName.trim().toLowerCase()) return null;

  const keyHit = matchIndex(stepText, key);
  if (!keyHit) return null;
  return { ...keyHit, score: key.length };
}

function appendBeforeTrailingPunctuation(text: string, suffix: string): string {
  const match = /([.!?])\s*$/.exec(text);
  if (!match || match.index == null) return `${text}${suffix}`;
  const at = match.index;
  return `${text.slice(0, at)}${suffix}${text.slice(at)}`;
}

function insertAfterSpan(text: string, index: number, length: number, insert: string): string {
  const end = index + length;
  const after = text.slice(end);
  if (/^\s*\(/.test(after)) return appendBeforeTrailingPunctuation(text, insert);
  return `${text.slice(0, end)}${insert}${text.slice(end)}`;
}

export type AmountInjectIngredient = {
  name: string;
  amount?: string | null | undefined;
  /** Ingredient section / group heading, e.g. "Sauce". */
  section?: string | null | undefined;
};

type InjectCandidate = {
  name: string;
  amount: string;
  section?: string;
  sectionKey: string;
};

function formatSectionAmountList(items: readonly InjectCandidate[]): string {
  return items.map((item) => `${item.amount} ${item.name}`.trim()).join(', ');
}

function findSectionPhraseHit(
  stepText: string,
  sectionLabel: string,
): { index: number; length: number } | null {
  const label = sectionMatchLabel(sectionLabel);
  if (!label || label.length < 3) return null;
  const escaped = escapeRegex(label);
  const patterns = [
    new RegExp(`\\ball\\s+(?:of\\s+)?(?:the\\s+)?${escaped}(?:\\s+ingredients)?\\b`, 'i'),
    new RegExp(`\\bthe\\s+${escaped}\\s+ingredients\\b`, 'i'),
    new RegExp(`\\bthe\\s+${escaped}\\s+(?:mixture|mix|components)\\b`, 'i'),
    new RegExp(`\\bingredients\\s+(?:for|of|in)\\s+(?:the\\s+)?${escaped}\\b`, 'i'),
  ];

  let best: { index: number; length: number } | null = null;
  for (const re of patterns) {
    const hit = re.exec(stepText);
    if (!hit || hit.index == null) continue;
    const length = hit[0]?.length ?? 0;
    if (!best || length > best.length || (length === best.length && hit.index < best.index)) {
      best = { index: hit.index, length };
    }
  }
  return best;
}

function amountAlreadyPresent(text: string, amount: string): boolean {
  const lower = text.toLowerCase();
  const amountLower = amount.toLowerCase();
  return lower.includes(`(${amountLower})`) || lower.includes(amountLower);
}

function rangesOverlap(a: { index: number; length: number }, b: { index: number; length: number }): boolean {
  const aEnd = a.index + a.length;
  const bEnd = b.index + b.length;
  return a.index < bEnd && b.index < aEnd;
}

/**
 * When enabled, injects ingredient amounts into each method step.
 * - Fuzzy name match via shopping merge keys (garlic cloves ≈ minced garlic)
 * - Section phrases ("the sauce ingredients") expand to that group's amounts
 * Returns a normalized list of `{ text, section }` steps (headings excluded).
 */
export function injectAmountsIntoMethod(
  method: readonly RecipeMethodStep[] | null | undefined,
  ingredients: readonly AmountInjectIngredient[] | null | undefined,
  enabled: boolean,
): NormalizedMethodStep[] {
  const normalized = normalizeRecipeMethodSteps(method);
  if (!enabled) return normalized;
  if (!ingredients?.length) return normalized;

  const candidates: InjectCandidate[] = ingredients
    .map((item) => {
      const name = item.name?.trim?.() ? String(item.name).trim() : '';
      const amount = typeof item.amount === 'string' ? item.amount.trim() : '';
      const section = cleanSection(item.section);
      return {
        name,
        amount,
        section,
        sectionKey: section ? sectionMatchLabel(section).toLowerCase() : '',
      };
    })
    .filter((item) => item.name && item.amount);

  if (candidates.length === 0) return normalized;

  const sectionKeys = [
    ...new Map(
      candidates
        .filter((item) => item.section && item.sectionKey)
        .map((item) => [item.sectionKey, item.section!] as const),
    ).entries(),
  ].sort((a, b) => b[0].length - a[0].length);

  return normalized.map((step) => {
    let text = step.text;
    const covered = new Set<InjectCandidate>();
    const occupied: { index: number; length: number }[] = [];

    type PendingInsert = { index: number; length: number; insert: string; cover: InjectCandidate[] };
    const pending: PendingInsert[] = [];

    for (const [sectionKey, section] of sectionKeys) {
      const hit = findSectionPhraseHit(text, section);
      if (!hit) continue;
      if (occupied.some((range) => rangesOverlap(range, hit))) continue;

      const groupItems = candidates.filter((item) => item.sectionKey === sectionKey);
      if (groupItems.length === 0) continue;

      const list = formatSectionAmountList(groupItems);
      if (!list) continue;
      if (amountAlreadyPresent(text, list)) {
        for (const item of groupItems) covered.add(item);
        occupied.push(hit);
        continue;
      }

      pending.push({
        index: hit.index,
        length: hit.length,
        insert: ` (${list})`,
        cover: groupItems,
      });
      occupied.push(hit);
      for (const item of groupItems) covered.add(item);
    }

    const individualHits: { candidate: InjectCandidate; index: number; length: number; score: number }[] = [];
    for (const ing of candidates) {
      if (covered.has(ing)) continue;
      const hit = findIngredientHit(text, ing.name);
      if (!hit) continue;
      if (amountAlreadyPresent(text, ing.amount)) continue;
      if (occupied.some((range) => rangesOverlap(range, hit))) continue;
      individualHits.push({ candidate: ing, ...hit });
    }

    // Prefer longer / more specific mentions; drop overlapping weaker hits.
    individualHits.sort((a, b) => b.score - a.score || a.index - b.index);
    const chosenIndividuals: typeof individualHits = [];
    for (const hit of individualHits) {
      if (chosenIndividuals.some((other) => rangesOverlap(other, hit))) continue;
      if (occupied.some((range) => rangesOverlap(range, hit))) continue;
      chosenIndividuals.push(hit);
      occupied.push(hit);
      pending.push({
        index: hit.index,
        length: hit.length,
        insert: ` (${hit.candidate.amount})`,
        cover: [hit.candidate],
      });
    }

    // Apply from the end so earlier indices stay valid.
    pending.sort((a, b) => b.index - a.index);
    for (const item of pending) {
      text = insertAfterSpan(text, item.index, item.length, item.insert);
    }

    return text === step.text ? step : { ...step, text };
  });
}
