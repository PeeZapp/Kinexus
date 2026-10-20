import { DAYS, MEAL_SLOTS, mondayWeekStart, type Day, type MealSlotKey } from '@kinexus/domain';

import { supabase } from '@/src/lib/supabase';

export type MenuCourse = {
  slotKey: MealSlotKey;
  label: string;
  name: string;
  emoji: string | null;
  recipeId: string | null;
  audiencePersonIds?: string[];
};

const SLOT_LABEL = new Map(MEAL_SLOTS.map((slot) => [slot.key, slot.label]));

function dayName(iso: string): Day {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  const index = date.getDay();
  return DAYS[index === 0 ? 6 : index - 1] ?? 'monday';
}

export async function loadDayMenu(householdId: string, date: string): Promise<MenuCourse[]> {
  if (!supabase) return [];
  const weekStart = mondayWeekStart(new Date(`${date}T12:00:00`));
  const day = dayName(date);
  const { data: plan, error } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('household_id', householdId)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (error) throw error;
  if (!plan) return [];

  const { data: slots, error: slotError } = await supabase
    .from('meal_slots')
    .select('slot_key, recipe_name, emoji, recipe_id, hidden, audience_person_ids')
    .eq('meal_plan_id', plan.id)
    .eq('day', day);
  if (slotError) throw slotError;

  const courses: MenuCourse[] = [];
  for (const slot of MEAL_SLOTS) {
    const rows = (slots ?? []).filter((row) => row.slot_key === slot.key && !row.hidden);
    for (const row of rows) {
      const name = row.recipe_name?.trim();
      if (!name) continue;
      courses.push({
        slotKey: slot.key,
        label: SLOT_LABEL.get(slot.key) ?? slot.label,
        name,
        emoji: row.emoji?.trim() || null,
        recipeId: row.recipe_id,
        audiencePersonIds: row.audience_person_ids ?? [],
      });
    }
  }
  return courses;
}
