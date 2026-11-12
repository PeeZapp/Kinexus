export type StashedBudgetTxnScreenshot = {
  fileName: string;
  mimeType: string | null;
  bytes: Uint8Array;
};

export type StashedBudgetTxnShare =
  | { kind: 'screenshots'; screenshots: StashedBudgetTxnScreenshot[] }
  | { kind: 'statement'; fileName: string; mimeType: string | null; text: string };

let stashed: StashedBudgetTxnShare | null = null;

export function stashBudgetTxnShare(payload: StashedBudgetTxnShare): void {
  stashed = payload;
}

export function takeStashedBudgetTxnShare(): StashedBudgetTxnShare | null {
  const next = stashed;
  stashed = null;
  return next;
}

export function clearStashedBudgetTxnShare(): void {
  stashed = null;
}

export function peekStashedBudgetTxnShare(): StashedBudgetTxnShare | null {
  return stashed;
}
