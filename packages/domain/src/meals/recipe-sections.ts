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

function appendBeforeTrailingPunctuation(text: string, suffix: string): string {
  const match = /([.!?])\s*$/.exec(text);
  if (!match || match.index == null) return `${text}${suffix}`;
  const at = match.index;
  return `${text.slice(0, at)}${suffix}${text.slice(at)}`;
}

export type AmountInjectIngredient = { name: string; amount?: string | null | undefined };

function injectAmountIntoStepText(text: string, ingredient: AmountInjectIngredient, amount: string): string {
  const lower = text.toLowerCase();
  const amountLower = amount.toLowerCase();
  if (lower.includes(`(${amountLower})`) || lower.includes(amountLower)) return text;

  const hit = matchIndex(text, ingredient.name);
  if (!hit) return text;
  const end = hit.index + hit.length;
  const after = text.slice(end);
  const insert = ` (${amount.trim()})`;

  // If the ingredient is already followed by parentheses (e.g. "(or tamari)"), keep it simple and append.
  if (/^\s*\(/.test(after)) return appendBeforeTrailingPunctuation(text, insert);

  return `${text.slice(0, end)}${insert}${text.slice(end)}`;
}

/**
 * When enabled, injects best-match ingredient amounts into each method step.
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

  const candidates = ingredients
    .map((item) => ({
      name: item.name?.trim?.() ? String(item.name) : '',
      amount: typeof item.amount === 'string' ? item.amount.trim() : '',
    }))
    .filter((item) => item.name && item.amount);

  if (candidates.length === 0) return normalized;

  return normalized.map((step) => {
    let best: { ingredient: AmountInjectIngredient; amount: string; score: number; index: number } | null = null;
    for (const ing of candidates) {
      const hit = matchIndex(step.text, ing.name);
      if (!hit) continue;
      const score = ing.name.length;
      if (
        !best ||
        score > best.score ||
        (score === best.score && hit.index < best.index)
      ) {
        best = { ingredient: ing, amount: ing.amount!, score, index: hit.index };
      }
    }
    if (!best) return step;
    return { ...step, text: injectAmountIntoStepText(step.text, best.ingredient, best.amount) };
  });
}

