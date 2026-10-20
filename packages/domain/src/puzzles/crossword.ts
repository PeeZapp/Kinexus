export type CrosswordDirection = 'across' | 'down';

export type CrosswordClue = {
  number: number;
  direction: CrosswordDirection;
  clue: string;
  answer: string;
  cells: number[];
};

export type CrosswordCell = {
  letter: string;
  number: number | null;
};

export type CrosswordPuzzle = {
  size: number;
  cells: (CrosswordCell | null)[];
  clues: CrosswordClue[];
};

const CLUE: Record<string, string> = {
  am: 'Morning hours',
  an: 'Article before a vowel',
  ace: 'One in cards, or an expert',
  add: 'Find a sum',
  age: 'Years lived',
  ago: 'In the past',
  air: 'What we breathe',
  ant: 'Picnic insect',
  ape: 'Large primate',
  are: 'Plural of is',
  armor: 'Protective suit',
  art: 'Painting or sculpture',
  ash: 'Fire residue',
  at: 'Where @ points',
  bar: 'Saloon counter',
  bat: 'Nocturnal flyer',
  bed: 'Place to sleep',
  bee: 'Hive insect',
  bet: 'A wager',
  cab: 'Taxi',
  cat: 'Purring pet',
  dad: 'Father',
  den: 'Cozy room, or a lair',
  dry: 'Not wet',
  ear: 'Hearing organ',
  eat: 'Have a meal',
  end: 'The finish',
  era: 'A period of history',
  eye: 'Sight organ',
  fat: 'Opposite of lean',
  fed: 'Gave food to',
  get: 'Obtain',
  go: 'Proceed',
  gun: 'Firearm',
  guy: 'A fellow',
  had: 'Possessed',
  ham: 'Deli meat',
  hat: 'Headwear',
  her: 'That woman',
  hey: 'A greeting',
  human: 'A person',
  ice: 'Frozen water',
  it: 'The thing mentioned',
  jam: 'Fruit spread',
  jet: 'Airplane',
  key: 'Lock opener',
  lab: 'Science room',
  lap: 'One circuit of a track',
  leg: 'Limb used for walking',
  let: 'Allow',
  lie: 'Rest flat, or a fib',
  limit: 'A maximum',
  lip: 'Edge of the mouth',
  ma: 'Mom, informally',
  man: 'An adult male',
  map: 'A drawn chart',
  mat: 'Floor pad',
  me: 'Object of I',
  men: 'Adult males',
  net: 'Mesh trap',
  oak: 'Acorn tree',
  oil: 'Slippery liquid',
  old: 'Not new',
  one: 'Single unit',
  pan: 'Frying vessel',
  pat: 'A light tap',
  paw: 'Animal foot',
  pea: 'Round green vegetable',
  pet: 'Animal kept at home',
  pie: 'Dessert with a crust',
  plain: 'Simple, or a flat land',
  proud: 'Feeling pleased with yourself',
  rag: 'Scrap of cloth',
  ran: 'Moved quickly on foot',
  rat: 'Long-tailed rodent',
  red: 'Stop-sign color',
  rib: 'Chest bone',
  rigid: 'Stiff and unbending',
  sap: 'Tree juice',
  sat: 'Took a seat',
  sea: 'The ocean',
  set: 'A matching collection',
  she: 'That woman, as a subject',
  so: 'Therefore',
  spa: 'Place for a soak',
  tan: 'Beach-made skin tone',
  tar: 'Road blacktop',
  tea: 'A hot leaf drink',
  ten: 'A pair of fives',
  title: 'Name of a book or film',
  toe: 'Digit on a foot',
  ton: 'A very heavy weight',
  two: 'A pair',
  win: 'Take the victory',
  woman: 'An adult female',
  yet: 'So far, or still',
};

const MINIS: readonly (readonly string[])[] = [
  ['#paw#', 'armor', 'so#ma', 'human', '#den#'],
  ['#tar#', 'limit', 'at#go', 'plain', '#end#'],
  ['add', 'pea', 'end'],
  ['age', 'guy', 'one'],
  ['ape', 'sea', 'hat'],
  ['bar', 'era', 'den'],
  ['cab', 'age', 'toe'],
  ['had', 'era', 'red'],
  ['jam', 'era', 'ten'],
  ['oak', 'lie', 'dry'],
  ['sap', 'pie', 'art'],
  ['sea', 'pan', 'art'],
  ['she', 'pea', 'art'],
  ['toe', 'win', 'old'],
  ['ham', 'era', 'yet'],
  ['lap', 'era', 'ten'],
  ['map', 'era', 'net'],
  ['sat', 'era', 'ten'],
  ['tar', 'era', 'net'],
  ['fat', 'era', 'den'],
  ['lab', 'era', 'get'],
  ['rag', 'ice', 'bet'],
];

type Slot = { direction: CrosswordDirection; cells: number[] };

function slotsFor(pattern: string, size: number): Slot[] {
  const slots: Slot[] = [];
  for (let row = 0; row < size; row += 1) {
    let col = 0;
    while (col < size) {
      if (pattern[row * size + col] === '#') {
        col += 1;
        continue;
      }
      const start = col;
      while (col < size && pattern[row * size + col] !== '#') col += 1;
      if (col - start >= 2) {
        const cells: number[] = [];
        for (let cursor = start; cursor < col; cursor += 1) cells.push(row * size + cursor);
        slots.push({ direction: 'across', cells });
      }
    }
  }
  for (let col = 0; col < size; col += 1) {
    let row = 0;
    while (row < size) {
      if (pattern[row * size + col] === '#') {
        row += 1;
        continue;
      }
      const start = row;
      while (row < size && pattern[row * size + col] !== '#') row += 1;
      if (row - start >= 2) {
        const cells: number[] = [];
        for (let cursor = start; cursor < row; cursor += 1) cells.push(cursor * size + col);
        slots.push({ direction: 'down', cells });
      }
    }
  }
  return slots;
}

function fromRows(rows: readonly string[]): CrosswordPuzzle {
  const size = rows.length;
  const pattern = rows.join('');
  const slots = slotsFor(pattern, size);
  const numbers = new Map<number, number>();
  let next = 1;
  for (let cell = 0; cell < pattern.length; cell += 1) {
    if (pattern[cell] === '#') continue;
    if (slots.some((slot) => slot.cells[0] === cell)) numbers.set(cell, next++);
  }
  const clues: CrosswordClue[] = slots.map((slot) => {
    const answer = slot.cells.map((cell) => pattern[cell] ?? '').join('');
    return {
      number: numbers.get(slot.cells[0]!) ?? 0,
      direction: slot.direction,
      clue: CLUE[answer] ?? answer,
      answer,
      cells: slot.cells,
    };
  });
  clues.sort((a, b) => a.direction.localeCompare(b.direction) || a.number - b.number);
  const cells: (CrosswordCell | null)[] = [];
  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern[index] === '#') cells.push(null);
    else cells.push({ letter: pattern[index] ?? '', number: numbers.get(index) ?? null });
  }
  return { size, cells, clues };
}

function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return 0;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function dailyCrossword(date: string): CrosswordPuzzle {
  const index = ((dayNumber(date) % MINIS.length) + MINIS.length) % MINIS.length;
  return fromRows(MINIS[index] ?? MINIS[0]!);
}

export function crosswordSolved(puzzle: CrosswordPuzzle, entries: readonly string[]): boolean {
  return puzzle.cells.every((cell, index) => cell == null || entries[index] === cell.letter);
}

export function crosswordWrong(puzzle: CrosswordPuzzle, entries: readonly string[]): boolean[] {
  return puzzle.cells.map((cell, index) => Boolean(cell && entries[index] && entries[index] !== cell.letter));
}
