import { describe, expect, it } from 'vitest';

import { quizForRest, restQuizCount, shuffledRestQuiz } from './quiz';
import { burnScore, foodKcal } from './quiz-bank';

describe('rest quiz', () => {
  it('has about a thousand questions with three distinct choices', () => {
    expect(restQuizCount()).toBe(1000);
    const ids = new Set<string>();
    for (let index = 0; index < restQuizCount(); index += 1) {
      const question = quizForRest(index);
      ids.add(question.id);
      expect(question.choices).toHaveLength(3);
      expect(new Set(question.choices).size).toBe(3);
      expect(question.answer).toBeGreaterThanOrEqual(0);
      expect(question.answer).toBeLessThan(3);
      expect(question.prompt.trim().length).toBeGreaterThan(0);
    }
    expect(ids.size).toBe(1000);
  });

  it('shuffles the deck instead of keeping catalog order', () => {
    const deck = shuffledRestQuiz(42);
    expect(deck).toHaveLength(1000);
    expect(new Set(deck.map((question) => question.id)).size).toBe(1000);
    const sameOrder = deck.every((question, index) => question.id === quizForRest(index).id);
    expect(sameOrder).toBe(false);
  });

  it('does not reuse the same foods on most calorie questions', () => {
    const counts = new Map<string, number>();
    let compared = 0;
    for (let index = 0; index < restQuizCount(); index += 1) {
      const question = quizForRest(index);
      if (question.prompt.includes('burns')) continue;
      if (!question.prompt.includes('more calories') && !question.prompt.includes('fewer calories')) continue;
      compared += 1;
      for (const label of question.choices) {
        if (foodKcal(label) == null) continue;
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    const peak = Math.max(...counts.values());
    expect(compared).toBeGreaterThan(40);
    expect(peak).toBeLessThanOrEqual(36);
    expect(counts.size).toBeGreaterThan(20);
  });

  it('asks more about exercise than about food calories', () => {
    let exercise = 0;
    let food = 0;
    for (let index = 0; index < restQuizCount(); index += 1) {
      const prompt = quizForRest(index).prompt;
      if (
        prompt.includes('mainly train') ||
        prompt.includes('kind of movement') ||
        prompt.includes('usually done with') ||
        prompt.includes('mainly a ') ||
        prompt.includes('mainly core') ||
        (prompt.startsWith('Pick the ') && !prompt.includes('calories'))
      ) {
        exercise += 1;
      }
      if (
        ((prompt.includes('more calories') || prompt.includes('fewer calories')) && !prompt.includes('burns')) ||
        prompt.startsWith('About how many calories')
      ) {
        food += 1;
      }
    }
    expect(exercise).toBeGreaterThan(550);
    expect(food).toBeLessThan(200);
    expect(exercise).toBeGreaterThan(food * 2);
  });

  it('keeps calorie and burn answers on the food that actually leads', () => {
    for (let index = 0; index < restQuizCount(); index += 1) {
      const question = quizForRest(index);
      const choice = question.choices[question.answer];
      if (!choice) continue;
      if (question.prompt.includes('more calories') && !question.prompt.includes('burns')) {
        const values = question.choices.map((label) => foodKcal(label) ?? -1);
        expect(foodKcal(choice)).toBe(Math.max(...values));
      }
      if (question.prompt.includes('fewer calories')) {
        const values = question.choices.map((label) => foodKcal(label) ?? 9999);
        expect(foodKcal(choice)).toBe(Math.min(...values));
      }
      if (question.prompt === 'Which usually burns more calories for the same person?') {
        const values = question.choices.map((label) => burnScore(label) ?? -1);
        expect(burnScore(choice)).toBe(Math.max(...values));
      }
      if (question.prompt.startsWith('About how many calories is ')) {
        const label = question.prompt.slice('About how many calories is '.length).replace(/\?$/, '');
        expect(choice).toBe(`${foodKcal(label)} kcal`);
      }
    }
  });
});
