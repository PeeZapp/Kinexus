export type FoodTagOption = {
  id: string;
  label: string;
  emoji: string;
};

export const CUISINE_SUGGESTIONS: readonly string[] = [
  'Italian',
  'Mexican',
  'American',
  'Greek',
  'French',
  'Spanish',
  'Turkish',
  'Middle Eastern',
  'Lebanese',
  'Moroccan',
  'Indian',
  'Sri Lankan',
  'Thai',
  'Vietnamese',
  'Chinese',
  'Japanese',
  'Korean',
  'Filipino',
  'Indonesian',
  'Caribbean',
  'Brazilian',
  'Ethiopian',
];

/** Recipe contains these allergens (not "free from"). */
export const ALLERGEN_OPTIONS: readonly FoodTagOption[] = [
  { id: 'gluten', label: 'Gluten', emoji: '🌾' },
  { id: 'dairy', label: 'Dairy', emoji: '🥛' },
  { id: 'egg', label: 'Egg', emoji: '🥚' },
  { id: 'nuts', label: 'Nuts', emoji: '🥜' },
  { id: 'soy', label: 'Soy', emoji: '🫘' },
  { id: 'sesame', label: 'Sesame', emoji: '🫓' },
  { id: 'fish', label: 'Fish', emoji: '🐟' },
  { id: 'shellfish', label: 'Shellfish', emoji: '🦐' },
];

export const EQUIPMENT_OPTIONS: readonly FoodTagOption[] = [
  { id: 'oven', label: 'Oven', emoji: '🔥' },
  { id: 'air-fryer', label: 'Air fryer', emoji: '💨' },
  { id: 'slow-cooker', label: 'Slow cooker', emoji: '🍲' },
  { id: 'pressure-cooker', label: 'Pressure cooker', emoji: '⏲️' },
  { id: 'rice-cooker', label: 'Rice cooker', emoji: '🍚' },
  { id: 'blender', label: 'Blender', emoji: '🌀' },
  { id: 'food-processor', label: 'Food processor', emoji: '⚙️' },
  { id: 'stand-mixer', label: 'Stand mixer', emoji: '🥣' },
  { id: 'grill', label: 'Grill', emoji: '🍖' },
];

export function normalizeFoodTags(list: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

