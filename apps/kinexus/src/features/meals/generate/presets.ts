import type { NutritionGoals } from '@kinexus/domain';

export const GOAL_PRESETS: { id: string; name: string; goals: NutritionGoals }[] = [
  { id: 'maintenance', name: 'Maintenance', goals: { calories: 2000, protein: 120, carbs: 250, fat: 65 } },
  { id: 'weight_loss', name: 'Weight loss', goals: { calories: 1600, protein: 140, carbs: 140, fat: 50 } },
  { id: 'muscle_gain', name: 'Muscle gain', goals: { calories: 2800, protein: 200, carbs: 320, fat: 80 } },
  { id: 'keto', name: 'Keto', goals: { calories: 1800, protein: 130, carbs: 25, fat: 145 } },
];
