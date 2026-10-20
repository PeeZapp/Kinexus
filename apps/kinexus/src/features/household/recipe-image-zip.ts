import { unzipSync } from 'fflate';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

/** Collapse dish / file names so "Za'atar" and "Zaatar.jpg" still match. */
export function normalizeDishKey(value: string): string {
  const base = value.replace(/^.*[\\/]/, '').replace(IMAGE_EXT, '');
  return base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function mimeForName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

export type ZipImageEntry = {
  fileName: string;
  key: string;
  file: File;
};

export type ZipMatchResult = {
  matched: Array<{ recipeId: string; recipeName: string; entry: ZipImageEntry }>;
  unmatchedFiles: string[];
  unmatchedRecipes: string[];
};

export async function readRecipeImageZip(file: File): Promise<ZipImageEntry[]> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const unzipped = unzipSync(buffer);
  const entries: ZipImageEntry[] = [];

  for (const [path, bytes] of Object.entries(unzipped)) {
    if (!bytes || path.endsWith('/')) continue;
    const fileName = path.replace(/^.*[\\/]/, '');
    if (fileName.startsWith('.')) continue;
    if (!IMAGE_EXT.test(fileName)) continue;
    const key = normalizeDishKey(fileName);
    if (!key) continue;
    entries.push({
      fileName,
      key,
      file: new File([bytes], fileName, { type: mimeForName(fileName) }),
    });
  }

  return entries;
}

export function matchZipToRecipes(
  entries: ZipImageEntry[],
  recipes: readonly { id: string; name: string }[],
): ZipMatchResult {
  const byKey = new Map<string, { id: string; name: string }>();
  for (const recipe of recipes) {
    byKey.set(normalizeDishKey(recipe.name), recipe);
  }

  const matched: ZipMatchResult['matched'] = [];
  const unmatchedFiles: string[] = [];
  const used = new Set<string>();

  for (const entry of entries) {
    const recipe = byKey.get(entry.key);
    if (!recipe || used.has(recipe.id)) {
      unmatchedFiles.push(entry.fileName);
      continue;
    }
    used.add(recipe.id);
    matched.push({ recipeId: recipe.id, recipeName: recipe.name, entry });
  }

  const unmatchedRecipes = recipes
    .filter((recipe) => !used.has(recipe.id))
    .map((recipe) => recipe.name);

  return { matched, unmatchedFiles, unmatchedRecipes };
}
