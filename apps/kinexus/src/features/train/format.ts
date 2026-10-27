const HIDDEN = new Set(['', 'other']);

export function prettyLabel(value: string): string {
  const clean = value.trim();
  if (HIDDEN.has(clean.toLowerCase())) return '';
  return exerciseTitle(clean);
}

export function exerciseTitle(value: string): string {
  return value.trim().replace(/(^|[\s\-/()])([a-z])/g, (_match, lead: string, char: string) => `${lead}${char.toUpperCase()}`);
}

export function exerciseFacts(exercise: { bodyPart: string; equipment: string; targetMuscle: string }): string[] {
  const seen = new Set<string>();
  const facts: string[] = [];
  for (const value of [exercise.bodyPart, exercise.targetMuscle, exercise.equipment]) {
    const label = prettyLabel(value);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    facts.push(label);
  }
  return facts;
}

export function instructionSteps(instructions: string[]): string[] {
  const pieces: string[] = [];
  for (const block of instructions) {
    const clean = block.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    const parts = clean
      .split(/(?=\bStep:\s*\d+)/i)
      .flatMap((part) => part.split(/(?<=\s)(?=\d+[\.\)]\s)/));
    for (const part of parts) {
      const body = part.replace(/^Step:\s*\d+\s*/i, '').replace(/^\d+[\.\)]\s*/, '').trim();
      if (!body) continue;
      if (body.length > 220) {
        const sentences = body.split(/(?<=[.!])\s+(?=[A-Z])/).map((sentence) => sentence.trim()).filter(Boolean);
        pieces.push(...(sentences.length > 1 ? sentences : [body]));
      } else {
        pieces.push(body);
      }
    }
  }

  const steps: string[] = [];
  for (const piece of pieces) {
    const previous = steps[steps.length - 1];
    if (previous && /^[a-z(]/.test(piece)) steps[steps.length - 1] = `${previous} ${piece}`;
    else steps.push(piece);
  }
  return steps;
}

export function clock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}
