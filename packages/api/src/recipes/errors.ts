import type { RecipeImportErrorCode } from '@kinexus/domain';
import { RECIPE_NOT_FOUND_MESSAGE } from '@kinexus/domain';

export class RecipeImportFailure extends Error {
  readonly code: RecipeImportErrorCode;

  constructor(code: RecipeImportErrorCode, message: string) {
    super(message);
    this.name = 'RecipeImportFailure';
    this.code = code;
  }
}

export function failureFromUnknown(err: unknown): RecipeImportFailure {
  if (err instanceof RecipeImportFailure) return err;
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (code === 'no_access') {
      return new RecipeImportFailure('ai_no_access', 'AI is turned off for you in this household. Ask an admin.');
    }
    if (code === 'key_paused') {
      return new RecipeImportFailure(
        'ai_key_paused',
        "Your household's AI key isn't working. AI is paused until an admin fixes it.",
      );
    }
  }
  const name = err instanceof Error ? err.name : '';
  const message = err instanceof Error ? err.message : 'Could not import that recipe';
  if (name === 'SsrfError' || message.includes('not allowed')) {
    return new RecipeImportFailure('ssrf_blocked', 'That URL is not allowed');
  }
  if (message.includes('timeout') || message.includes('Timeout') || message.includes('abort')) {
    return new RecipeImportFailure('timeout', 'This is taking too long. Try again, or paste the recipe text.');
  }
  if (message.includes('valid http') || message.includes('valid URL')) {
    return new RecipeImportFailure('invalid_url', message);
  }
  return new RecipeImportFailure('fetch_failed', message.slice(0, 300));
}

export function notARecipeFailure(): RecipeImportFailure {
  return new RecipeImportFailure('not_a_recipe', RECIPE_NOT_FOUND_MESSAGE);
}
