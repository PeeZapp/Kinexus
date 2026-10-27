const TOKEN = /[a-z0-9]+/g;

/** Lower score is a closer match. `null` means the query does not match. */
export function exerciseSearchScore(query: string, haystack: string): number | null {
  const needles = query.toLowerCase().match(TOKEN) ?? [];
  if (needles.length === 0) return 0;
  const words = haystack.toLowerCase().match(TOKEN) ?? [];
  if (words.length === 0) return null;

  let score = 0;
  for (const needle of needles) {
    let best = Number.POSITIVE_INFINITY;
    for (const word of words) {
      const cost = tokenCost(needle, word);
      if (cost !== null && cost < best) best = cost;
      if (best === 0) break;
    }
    if (!Number.isFinite(best)) return null;
    score += best;
  }
  return score;
}

function tokenCost(needle: string, word: string): number | null {
  if (needle === word) return 0;
  const [shorter, longer] = needle.length <= word.length ? [needle, word] : [word, needle];
  if (shorter.length >= 2 && longer.startsWith(shorter)) return 1;
  if (needle.length >= 3 && word.includes(needle)) return 4;
  const limit = fuzzyLimit(needle.length);
  if (limit === 0) return null;
  const distance = editDistanceWithin(needle, word, limit);
  if (distance === null) return null;
  return 8 + distance;
}

function fuzzyLimit(length: number): number {
  if (length < 5) return 0;
  if (length < 8) return 1;
  return 2;
}

/** Optimal string alignment distance, or null once it exceeds `max`. */
function editDistanceWithin(a: string, b: string, max: number): number | null {
  if (Math.abs(a.length - b.length) > max) return null;
  const aLen = a.length;
  const bLen = b.length;
  let prevPrev = new Array<number>(bLen + 1).fill(0);
  let prev = Array.from({ length: bLen + 1 }, (_, index) => index);
  let curr = new Array<number>(bLen + 1).fill(0);

  for (let i = 1; i <= aLen; i += 1) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bLen; j += 1) {
      const substitution = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + substitution);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, prevPrev[j - 2] + 1);
      }
      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return null;
    const recycled = prevPrev;
    prevPrev = prev;
    prev = curr;
    curr = recycled;
  }

  return prev[bLen] <= max ? prev[bLen] : null;
}
