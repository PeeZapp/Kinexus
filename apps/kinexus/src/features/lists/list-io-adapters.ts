import type {
  ExistingDedupeItem,
  ExportListInput,
  KinexusExportItem,
  StashListItem,
  StashProduct,
  WatchlistEntry,
  WatchlistSearchHit,
  WeightUnit,
} from '@kinexus/domain';

import { workoutWeightToKg, type ListImportWriters } from '@/src/features/lists/list-import-apply';
import type { ShoppingListItem } from '@/src/features/meals/mappers';
import type { WorkoutDraft } from '@/src/features/train/api';

export function watchlistExportInput(listName: string, listId: string | null, entries: readonly WatchlistEntry[]): ExportListInput {
  return {
    kind: 'watchlist',
    listName,
    listId,
    items: entries.map(
      (entry): KinexusExportItem => ({
        title: entry.title.title,
        year: entry.title.year,
        tmdbId: entry.title.tmdbId,
        mediaType: entry.title.mediaType,
        notes: entry.item.notes,
        url: entry.title.sourceUrl,
      }),
    ),
  };
}

export function wishlistExportInput(listName: string, listId: string | null, products: readonly StashProduct[]): ExportListInput {
  return {
    kind: 'wishlist',
    listName,
    listId,
    items: products.map((product) => ({
      title: product.title,
      url: product.sourceUrl || null,
      price: product.currentPrice != null ? String(product.currentPrice) : null,
      notes: product.notes,
    })),
  };
}

export function checklistExportInput(listName: string, listId: string | null, items: readonly StashListItem[]): ExportListInput {
  return {
    kind: 'checklist',
    listName,
    listId,
    items: items.map((item) => ({
      title: item.title,
      notes: item.notes,
    })),
  };
}

export function shoppingExportInput(weekStart: string, items: readonly ShoppingListItem[]): ExportListInput {
  return {
    kind: 'shopping',
    listName: `Shopping ${weekStart}`,
    items: items.map((item) => ({
      title: item.name,
      quantity: item.amount,
      notes: null,
    })),
  };
}

export function workoutExportInput(workout: WorkoutDraft, weightUnit: WeightUnit): ExportListInput {
  return {
    kind: 'workout',
    listName: workout.name,
    listId: workout.id,
    weightUnit,
    storedWeightIsKg: true,
    items: workout.exercises.map((exercise) => ({
      title: exercise.name,
      sets: exercise.targetSets,
      reps: exercise.targetReps,
      weight: exercise.targetWeight,
      notes: exercise.note || null,
    })),
  };
}

export function watchlistDedupe(entries: readonly WatchlistEntry[]): ExistingDedupeItem[] {
  return entries.map((entry) => ({ title: entry.title.title, tmdbId: entry.title.tmdbId }));
}

export function wishlistDedupe(products: readonly StashProduct[]): ExistingDedupeItem[] {
  return products.map((product) => ({ title: product.title, url: product.sourceUrl }));
}

export function checklistDedupe(items: readonly StashListItem[]): ExistingDedupeItem[] {
  return items.map((item) => ({ title: item.title }));
}

export function shoppingDedupe(items: readonly ShoppingListItem[]): ExistingDedupeItem[] {
  return items.map((item) => ({ title: item.name }));
}

export function asWatchlistHit(row: { title: string; year: number | null; tmdbId: number; mediaType: 'movie' | 'tv' | null }): WatchlistSearchHit {
  return {
    tmdbId: row.tmdbId,
    mediaType: row.mediaType ?? 'movie',
    title: row.title,
    year: row.year,
    overview: null,
    posterPath: null,
    backdropPath: null,
    imdbId: null,
  };
}

export { workoutWeightToKg };
export type { ListImportWriters };
