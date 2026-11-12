import {
  guessShareFiles,
  guessShareTarget,
  type ShareTargetGuess,
} from '@kinexus/domain';

export type ShareIntentFile = {
  fileName?: string | null;
  path?: string | null;
  mimeType?: string | null;
  /** Optional text peek for CSV / statement classification. */
  textPreview?: string | null;
  /** Optional web File / blob handle when available. */
  file?: File | null;
};

export type ShareIntentPayload = {
  files?: ShareIntentFile[] | null;
  webUrl?: string | null;
  text?: string | null;
  title?: string | null;
};

export type ShareIntentDecision =
  | {
      kind: 'files';
      files: ShareIntentFile[];
      guess: ShareTargetGuess;
      auto: boolean;
    }
  | { kind: 'picker'; guess: ShareTargetGuess; payload: { url: string | null; text: string | null; title: string | null } }
  | { kind: 'empty' };

/** Decide whether a share opens file handoff, the target picker, or nothing. */
export function decideShareIntent(payload: ShareIntentPayload): ShareIntentDecision {
  const files = (payload.files ?? []).filter(
    (file) => Boolean(file.fileName?.trim() || file.path?.trim() || file.mimeType?.trim() || file.file),
  );

  if (files.length > 0) {
    const guess = guessShareFiles(
      files.map((file) => ({
        fileName: file.fileName,
        mimeType: file.mimeType,
        textPreview: file.textPreview,
      })),
    );
    return {
      kind: 'files',
      files,
      guess,
      auto: guess.targets.length <= 1,
    };
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
