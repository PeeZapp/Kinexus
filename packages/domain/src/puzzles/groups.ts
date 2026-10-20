import { rngFor, shuffle } from './rng';

export type WordGroup = {
  title: string;
  words: readonly [string, string, string, string];
  difficulty: 0 | 1 | 2 | 3;
};

export type GroupsPuzzle = {
  categories: readonly [WordGroup, WordGroup, WordGroup, WordGroup];
};

const GROUPS: readonly WordGroup[] = [
  { difficulty: 0, title: 'Citrus fruits', words: ['lemon', 'lime', 'orange', 'grapefruit'] },
  { difficulty: 0, title: 'Breakfast foods', words: ['waffle', 'oatmeal', 'yogurt', 'granola'] },
  { difficulty: 0, title: 'String instruments', words: ['violin', 'cello', 'harp', 'banjo'] },
  { difficulty: 0, title: 'Ocean mammals', words: ['dolphin', 'whale', 'otter', 'seal'] },
  { difficulty: 0, title: 'Trees', words: ['maple', 'birch', 'cedar', 'willow'] },
  { difficulty: 0, title: 'Winter clothes', words: ['scarf', 'mitten', 'parka', 'beanie'] },
  { difficulty: 0, title: 'Pets', words: ['puppy', 'kitten', 'hamster', 'gecko'] },
  { difficulty: 0, title: 'Board games', words: ['chess', 'checkers', 'sorry', 'clue'] },

  { difficulty: 1, title: 'Kitchen tools', words: ['whisk', 'ladle', 'grater', 'sieve'] },
  { difficulty: 1, title: 'Breads', words: ['bagel', 'brioche', 'pita', 'rye'] },
  { difficulty: 1, title: 'Dances', words: ['waltz', 'tango', 'salsa', 'ballet'] },
  { difficulty: 1, title: 'Weather words', words: ['drizzle', 'thunder', 'humid', 'breeze'] },
  { difficulty: 1, title: 'Parts of a book', words: ['chapter', 'index', 'preface', 'spine'] },
  { difficulty: 1, title: 'Camping gear', words: ['tent', 'lantern', 'compass', 'canteen'] },
  { difficulty: 1, title: 'Gemstones', words: ['ruby', 'topaz', 'garnet', 'jade'] },
  { difficulty: 1, title: 'Things with a lid', words: ['teapot', 'cooler', 'piano', 'trunk'] },

  { difficulty: 2, title: 'Mean “false”', words: ['bogus', 'phony', 'sham', 'faux'] },
  { difficulty: 2, title: 'Palindromes', words: ['kayak', 'level', 'radar', 'civic'] },
  { difficulty: 2, title: 'Have a double letter', words: ['llama', 'muffin', 'letter', 'coffee'] },
  { difficulty: 2, title: 'Things with teeth', words: ['comb', 'gear', 'saw', 'zipper'] },
  { difficulty: 2, title: 'Hold a liquid', words: ['flask', 'barrel', 'pitcher', 'thermos'] },
  { difficulty: 2, title: 'Travel through the air', words: ['glider', 'arrow', 'kite', 'frisbee'] },
  { difficulty: 2, title: 'Measured in degrees', words: ['angle', 'oven', 'latitude', 'fever'] },
  { difficulty: 2, title: 'Can be a color and a food', words: ['olive', 'peach', 'plum', 'cherry'] },

  { difficulty: 3, title: '___ board', words: ['surf', 'key', 'dash', 'skate'] },
  { difficulty: 3, title: '___ house', words: ['light', 'green', 'tree', 'court'] },
  { difficulty: 3, title: 'Sound like numbers', words: ['won', 'too', 'for', 'ate'] },
  { difficulty: 3, title: 'Anagrams of each other', words: ['star', 'rats', 'tars', 'arts'] },
  { difficulty: 3, title: 'Can follow “fire”', words: ['fly', 'man', 'place', 'work'] },
  { difficulty: 3, title: 'Can follow “snow”', words: ['ball', 'flake', 'storm', 'shoe'] },
  { difficulty: 3, title: 'Hide an animal', words: ['catch', 'beard', 'crowded', 'scat'] },
  { difficulty: 3, title: 'Start and end with the same letter', words: ['rehab', 'wow', 'kick', 'noun'] },
];

export const GROUP_LIVES = 4;

export function groupBank(): readonly WordGroup[] {
  return GROUPS;
}

export function dailyGroups(date: string): GroupsPuzzle {
  const rng = rngFor(`groups:${date}`);
  const used = new Set<string>();
  const categories: WordGroup[] = [];
  for (const difficulty of [0, 1, 2, 3] as const) {
    const pool = GROUPS.filter(
      (group) => group.difficulty === difficulty && group.words.every((word) => !used.has(word)),
    );
    const [choice] = shuffle(rng, pool);
    if (!choice) throw new Error(`No group of difficulty ${difficulty} for ${date}`);
    categories.push(choice);
    choice.words.forEach((word) => used.add(word));
  }
  return { categories: categories as unknown as GroupsPuzzle['categories'] };
}

export function groupWords(puzzle: GroupsPuzzle): string[] {
  return puzzle.categories.flatMap((group) => [...group.words]);
}

export type GroupGuess = 'correct' | 'one-away' | 'wrong';

export function judgeGroup(puzzle: GroupsPuzzle, selected: readonly string[]): { result: GroupGuess; title?: string } {
  if (selected.length !== 4) return { result: 'wrong' };
  const picked = new Set(selected);
  for (const group of puzzle.categories) {
    const overlap = group.words.filter((word) => picked.has(word)).length;
    if (overlap === 4) return { result: 'correct', title: group.title };
    if (overlap === 3) return { result: 'one-away' };
  }
  return { result: 'wrong' };
}
