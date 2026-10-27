import { buildRestQuiz, type QuizQuestion } from './quiz-bank';

export type { QuizQuestion };

const QUESTIONS = buildRestQuiz();

export function restQuizCount(): number {
  return QUESTIONS.length;
}

export function quizForRest(seed: number): QuizQuestion {
  const index = Math.abs(Math.floor(seed)) % QUESTIONS.length;
  return QUESTIONS[index] ?? QUESTIONS[0]!;
}

export function shuffledRestQuiz(seed: number): QuizQuestion[] {
  const order = QUESTIONS.map((_, index) => index);
  const random = mulberry32(seed || 1);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = order[i];
    const swap = order[j];
    if (current === undefined || swap === undefined) continue;
    order[i] = swap;
    order[j] = current;
  }
  return order.map((index) => QUESTIONS[index] ?? QUESTIONS[0]!);
}

export function memoryPairs(labels: readonly string[], seed: number): string[] {
  const unique = [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
  const first = unique[Math.abs(seed) % Math.max(unique.length, 1)] ?? 'Press';
  const second = unique[(Math.abs(seed) + 3) % Math.max(unique.length, 1)] ?? 'Row';
  const pairB = second === first ? 'Row' : second;
  const cards = [first, first, pairB, pairB];
  const random = mulberry32(seed);
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = cards[i];
    const swap = cards[j];
    if (current === undefined || swap === undefined) continue;
    cards[i] = swap;
    cards[j] = current;
  }
  return cards;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
