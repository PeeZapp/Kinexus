import { normalizeRecipeDraft, parseJsonObject, type RecipeDraft } from '../recipe-draft.js';
import type { AiImageInput } from './provider.js';
import { completeResolved, type ResolvedAiClient } from './resolve.js';

export const RECIPE_JSON_SCHEMA = `Return ONLY a valid JSON object with these fields:
- name (string — the dish. If there is no title, name it from the ingredients, e.g. "Spicy peanut noodles". Never "Unknown", "Unknown Recipe", or "Imported recipe")
- emoji (1 relevant food emoji)
- cuisine (string, e.g. "Italian", "Thai" — omit if the source does not say)
- cookTime (number, total minutes — omit if not stated. Never 0)
- servings (number — omit if not stated. Never 0)
- calories, protein, carbs, fat (numbers per serving — omit unless the source states them. Never 0 as a placeholder)
- vegetarian (boolean)
- ingredients (array of { name: string, amount: string, category: string })
  categories: "meat","seafood","dairy","vegetables","fruit","grains","condiments","herbs","other"
  Include amount only when the source states one.
- method (array of clear step strings taken from the source)
- chefTip (string, a useful tip — omit if there is none)
- mealSlots (array from: "breakfast","morning_snack","lunch","afternoon_snack","dinner","night_snack","dessert")
- imageUrl (string, only if an image URL is present in the source)

Spoken captions and comments are the recipe when the post text is only a teaser. Ignore other videos.
Return ONLY the JSON. No markdown, no explanation.`;

export type AiDraftResult<T> = {
  value: T;
  provider: string;
  resultsMayVary: boolean;
};

export async function extractRecipeFromText(
  resolved: ResolvedAiClient,
  content: string,
): Promise<AiDraftResult<RecipeDraft>> {
  const out = await completeResolved(resolved, {
    json: true,
    prompt: `You are a recipe extraction expert. Extract the recipe from the following text.\n\n${RECIPE_JSON_SCHEMA}\n\nContent:\n${content}`,
  });
  return {
    value: normalizeRecipeDraft(parseJsonObject(out.text)),
    provider: out.provider,
    resultsMayVary: out.resultsMayVary,
  };
}

export async function generateRecipeFromName(
  resolved: ResolvedAiClient,
  name: string,
): Promise<AiDraftResult<RecipeDraft>> {
  const out = await completeResolved(resolved, {
    json: true,
    prompt: `Write a practical home-cook recipe for this dish: ${name}

The user could not import an original recipe and asked for one created from the dish name.
Use common quantities and clear steps. Do not claim this came from a specific website, creator, or video.

${RECIPE_JSON_SCHEMA}`,
  });
  return {
    value: normalizeRecipeDraft(parseJsonObject(out.text)),
    provider: out.provider,
    resultsMayVary: out.resultsMayVary,
  };
}

export async function extractRecipeFromUrlHint(
  resolved: ResolvedAiClient,
  url: string,
): Promise<AiDraftResult<RecipeDraft>> {
  const out = await completeResolved(resolved, {
    json: true,
    prompt: `A user wants to import a recipe from this URL: ${url}\n\nYou cannot browse the web, but you may recognise this recipe from your training data. Provide the full recipe.\nIf you recognise it (even partially), include every detail you know.\nIf you do not recognise this specific URL, infer the dish from the URL path and provide a solid home-cook version.\n\n${RECIPE_JSON_SCHEMA}`,
  });
  return {
    value: normalizeRecipeDraft(parseJsonObject(out.text)),
    provider: out.provider,
    resultsMayVary: out.resultsMayVary,
  };
}

export async function extractRecipeFromPhoto(
  resolved: ResolvedAiClient,
  images: AiImageInput[],
): Promise<AiDraftResult<RecipeDraft>> {
  const out = await completeResolved(resolved, {
    json: true,
    images,
    prompt: `You are a recipe extraction expert. Read the recipe from the attached photo(s) of a cookbook page, handwritten card, screenshot, or packaging.

Transcribe ingredients and steps faithfully. Fix obvious OCR mistakes. If multiple recipes appear, extract the clearest primary one.
Do not invent ingredients or steps that are not visible. Omit fields the photo does not state.

${RECIPE_JSON_SCHEMA}`,
  });
  return {
    value: normalizeRecipeDraft(parseJsonObject(out.text)),
    provider: out.provider,
    resultsMayVary: out.resultsMayVary,
  };
}
