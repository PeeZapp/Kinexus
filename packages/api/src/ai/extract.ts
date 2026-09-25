import type { AiClient } from './provider.js';
import { normalizeRecipeDraft, parseJsonObject, type RecipeDraft } from '../recipe-draft.js';

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

export async function extractRecipeFromText(client: AiClient, content: string): Promise<RecipeDraft> {
  const text = await client.complete({
    json: true,
    prompt: `You are a recipe extraction expert. Extract the recipe from the following text.\n\n${RECIPE_JSON_SCHEMA}\n\nContent:\n${content}`,
  });
  return normalizeRecipeDraft(parseJsonObject(text));
}

export async function extractRecipeFromUrlHint(client: AiClient, url: string): Promise<RecipeDraft> {
  const text = await client.complete({
    json: true,
    prompt: `A user wants to import a recipe from this URL: ${url}\n\nYou cannot browse the web, but you may recognise this recipe from your training data. Provide the full recipe.\nIf you recognise it (even partially), include every detail you know.\nIf you do not recognise this specific URL, infer the dish from the URL path and provide a solid home-cook version.\n\n${RECIPE_JSON_SCHEMA}`,
  });
  return normalizeRecipeDraft(parseJsonObject(text));
}
