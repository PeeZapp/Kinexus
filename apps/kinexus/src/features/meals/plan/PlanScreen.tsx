import { useState } from 'react';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { nutritionFitScore, recipesForSlot, type Day, type MealSlotKey, type Recipe } from '@kinexus/domain';

import { PlanDesktop } from '@/src/features/meals/plan/PlanDesktop';
import { PlanMobile } from '@/src/features/meals/plan/PlanMobile';
import { SlotSheet } from '@/src/features/meals/plan/SlotSheet';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { todayDay } from '@/src/features/meals/week-labels';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function PlanScreen() {
  const { mode } = useExperienceMode();
  const router = useRouter();
  const meals = useMealsSync();
  const [expandedDay, setExpandedDay] = useState<Day | null>(todayDay);
  const [sheetDay, setSheetDay] = useState<Day | null>(null);
  const [sheetSlot, setSheetSlot] = useState<MealSlotKey | null>(null);

  function openSlot(day: Day, slot: MealSlotKey) {
    setSheetDay(day);
    setSheetSlot(slot);
  }

  async function assign(recipe: Recipe) {
    if (!sheetDay || !sheetSlot) return;
    await meals.assignSlot(sheetDay, sheetSlot, recipe);
    setSheetDay(null);
    setSheetSlot(null);
  }

  async function shuffle() {
    if (!sheetDay || !sheetSlot) return;
    const current = meals.slotMap.get(`${sheetDay}_${sheetSlot}`);
    const pool = recipesForSlot(meals.recipes, sheetSlot).filter((r) => r.id !== current?.recipeId);
    if (pool.length === 0) return;
    const target = { calories: current?.calories ?? 500, protein: current?.protein ?? 25 };
    const scored = [...pool].sort((a, b) => nutritionFitScore(a, target) - nutritionFitScore(b, target));
    const pick = scored[Math.floor(Math.random() * Math.min(8, scored.length))];
    if (pick) await meals.assignSlot(sheetDay, sheetSlot, pick);
  }

  const sheet = (
    <SlotSheet
      visible={sheetDay !== null && sheetSlot !== null}
      day={sheetDay}
      slotKey={sheetSlot}
      slot={sheetDay && sheetSlot ? meals.slotMap.get(`${sheetDay}_${sheetSlot}`) : undefined}
      recipes={meals.recipes}
      onClose={() => {
        setSheetDay(null);
        setSheetSlot(null);
      }}
      onAssign={(recipe) => void assign(recipe)}
      onClear={() => {
        if (sheetDay && sheetSlot) void meals.clearSlot(sheetDay, sheetSlot);
        setSheetDay(null);
        setSheetSlot(null);
      }}
      onHide={() => {
        if (sheetDay && sheetSlot) void meals.hideSlot(sheetDay, sheetSlot, true);
        setSheetDay(null);
        setSheetSlot(null);
      }}
      onShuffle={() => void shuffle()}
      onOpenRecipe={(id) => {
        setSheetDay(null);
        setSheetSlot(null);
        router.push(`/meals/recipes/${id}` as Href);
      }}
    />
  );

  const goGenerate = () => router.push('/meals/generate' as Href);
  const goShopping = () => router.push('/meals/shopping' as Href);

  if (mode === 'desktop') {
    return (
      <>
        <PlanDesktop meals={meals} onOpenSlot={openSlot} onGenerate={goGenerate} onShopping={goShopping} />
        {sheet}
      </>
    );
  }

  return (
    <>
      <PlanMobile
        meals={meals}
        expandedDay={expandedDay}
        setExpandedDay={setExpandedDay}
        onOpenSlot={openSlot}
        onGenerate={goGenerate}
        onShopping={goShopping}
      />
      {sheet}
    </>
  );
}
