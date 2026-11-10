import { guessShareTarget, isListImportFileName, type ShareTargetGuess } from '@kinexus/domain';

export type ShareIntentFile = {
  fileName?: string | null;
  path?: string | null;
  mimeType?: string | null;
};

export type ShareIntentPayload = {
  files?: ShareIntentFile[] | null;
  webUrl?: string | null;
  text?: string | null;
  title?: string | null;
};

export type ShareIntentDecision =
  | { kind: 'file'; file: ShareIntentFile }
  | { kind: 'picker'; guess: ShareTargetGuess; payload: { url: string | null; text: string | null; title: string | null } }
  | { kind: 'empty' };

/** Decide whether a share opens list-file import or the target picker. */
export function decideShareIntent(payload: ShareIntentPayload): ShareIntentDecision {
  const file = payload.files?.[0] ?? null;
  const fileName = file?.fileName ?? '';
  if (file && isListImportFileName(fileName)) {
    return { kind: 'file', file };
  }

  const guess = guessShareTarget({
    url: payload.webUrl,
    text: payload.text,
    title: payload.title,
  });

  if (!guess.url && !guess.text) {
    return { kind: 'empty' };
  }

  return {
    kind: 'picker',
    guess,
    payload: {
      url: guess.url,
      text: guess.text,
      title: payload.title?.trim() || null,
    },
  };
}
