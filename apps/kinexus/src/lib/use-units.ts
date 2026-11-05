import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  defaultsForRegion,
  measurementSystemFrom,
  weightUnitFrom,
  type MeasurementSystem,
  type WeightUnit,
} from '@kinexus/domain';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';

export type UnitPrefs = {
  weightUnit: WeightUnit;
  measurementSystem: MeasurementSystem;
};

function storageKey(userId: string) {
  return `kinexus.unitPrefs.${userId}`;
}

function regionFromLocale(): string | null {
  try {
    const tag =
      (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) ||
      (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().locale : '') ||
      '';
    const parts = tag.replace('_', '-').split('-').filter(Boolean);
    const region = parts.length >= 2 ? parts[parts.length - 1] : null;
    return region && /^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : null;
  } catch {
    return null;
  }
}

function localeDefaults(): UnitPrefs {
  return defaultsForRegion(regionFromLocale());
}

function fromStored(value: unknown, fallback: UnitPrefs): UnitPrefs {
  if (!value || typeof value !== 'object') return fallback;
  const row = value as Record<string, unknown>;
  return {
    weightUnit: weightUnitFrom(row.weightUnit) ?? fallback.weightUnit,
    measurementSystem: measurementSystemFrom(row.measurementSystem) ?? fallback.measurementSystem,
  };
}

async function readCached(userId: string, fallback: UnitPrefs): Promise<UnitPrefs> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    return fromStored(raw ? JSON.parse(raw) : null, fallback);
  } catch {
    return fallback;
  }
}

async function loadUnitPrefs(userId: string, isDevBypass: boolean): Promise<UnitPrefs> {
  const fallback = localeDefaults();
  const cached = await readCached(userId, fallback);

  if (isDevBypass || !supabase) return cached;

  const { data, error } = await supabase
    .from('profiles')
    .select('weight_unit, measurement_system')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;

  const next: UnitPrefs = {
    weightUnit: weightUnitFrom(data?.weight_unit) ?? cached.weightUnit,
    measurementSystem: measurementSystemFrom(data?.measurement_system) ?? cached.measurementSystem,
  };
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
  return next;
}

async function persistUnitPrefs(userId: string, isDevBypass: boolean, prefs: UnitPrefs): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(prefs));
  if (isDevBypass || !supabase) return;
  const { error } = await supabase
    .from('profiles')
    .update({
      weight_unit: prefs.weightUnit,
      measurement_system: prefs.measurementSystem,
    })
    .eq('id', userId);
  if (error) throw error;
}

export function useUnits() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<UnitPrefs>(() => localeDefaults());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) {
      setPrefs(localeDefaults());
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    void loadUnitPrefs(user.id, user.isDevBypass)
      .then((next) => {
        if (!cancelled) {
          setPrefs(next);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrefs(localeDefaults());
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setWeightUnit = useCallback(
    async (weightUnit: WeightUnit) => {
      if (!user) {
        setPrefs((current) => ({ ...current, weightUnit }));
        return;
      }
      const next = { ...prefs, weightUnit };
      setPrefs(next);
      await persistUnitPrefs(user.id, user.isDevBypass, next);
    },
    [prefs, user],
  );

  const setMeasurementSystem = useCallback(
    async (measurementSystem: MeasurementSystem) => {
      if (!user) {
        setPrefs((current) => ({ ...current, measurementSystem }));
        return;
      }
      const next = { ...prefs, measurementSystem };
      setPrefs(next);
      await persistUnitPrefs(user.id, user.isDevBypass, next);
    },
    [prefs, user],
  );

  return {
    ready,
    weightUnit: prefs.weightUnit,
    measurementSystem: prefs.measurementSystem,
    setWeightUnit,
    setMeasurementSystem,
  };
}
