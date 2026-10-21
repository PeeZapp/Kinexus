import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import type { OverviewPlace, WeatherDay, WeatherHour, WeatherKind, WeatherReport } from '@kinexus/domain';

import { Btn, ErrorText, Field } from '@/src/features/household/ui';
import { AppModal } from '@/src/features/shell/AppModal';
import { colors, radius } from '@/src/features/shell/theme';
import { fetchOverviewWeather, searchOverviewPlaces, type PlaceSuggestion } from '@/src/features/today/api';

const KIND_COLOR: Record<WeatherKind, string> = {
  clear: colors.warning,
  cloud: colors.textMuted,
  fog: colors.textDim,
  rain: colors.accent,
  snow: colors.text,
  storm: colors.danger,
};

const WEATHER_ART: Record<WeatherKind, ImageSourcePropType> = {
  clear: require('../../../assets/images/weather/weather-clear.jpg'),
  cloud: require('../../../assets/images/weather/weather-cloud.jpg'),
  fog: require('../../../assets/images/weather/weather-fog.jpg'),
  rain: require('../../../assets/images/weather/weather-rain.jpg'),
  snow: require('../../../assets/images/weather/weather-snow.jpg'),
  storm: require('../../../assets/images/weather/weather-storm.jpg'),
};

const WEATHER_WASH: Record<WeatherKind, string> = {
  clear: colors.warningBg,
  cloud: colors.bgHover,
  fog: colors.bgElevated,
  rain: colors.accentSoft,
  snow: colors.bgHover,
  storm: colors.dangerBg,
};

function placeShort(label: string): string {
  return label.split(',')[0]?.trim() || label;
}

function degrees(value: number): string {
  return `${Math.round(value)}°`;
}

function calendarStamp(timezone: string | null): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone ?? undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
    let hour = pick('hour');
    if (hour === '24') hour = '00';
    if (hour.length === 1) hour = `0${hour}`;
    return `${pick('year')}-${pick('month')}-${pick('day')}T${hour}`;
  } catch {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}`;
  }
}

function todayDate(timezone: string | null): string {
  return calendarStamp(timezone).slice(0, 10);
}

function weekdayLabel(date: string, timezone: string | null): string {
  if (date === todayDate(timezone)) return 'Today';
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short' });
}

function dayHeading(date: string, timezone: string | null): string {
  if (date === todayDate(timezone)) return 'Today';
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

function hourLabel(time: string): string {
  const hour = Number(time.slice(11, 13));
  if (!Number.isFinite(hour)) return time;
  const clock = hour % 12 || 12;
  return `${clock}${hour < 12 ? 'am' : 'pm'}`;
}

function rainLabel(chance: number | null): string | null {
  if (chance == null || chance <= 0) return null;
  return `${chance}%`;
}

function visibleHours(day: WeatherDay, timezone: string | null): WeatherHour[] {
  const hours = day.hours ?? [];
  if (day.date !== todayDate(timezone)) return hours;
  const now = calendarStamp(timezone);
  const upcoming = hours.filter((hour) => hour.time.slice(0, 13) >= now);
  return upcoming.length > 0 ? upcoming : hours;
}

function todayDay(report: WeatherReport, place: OverviewPlace): WeatherDay | null {
  const timezone = report.timezone ?? place.timezone;
  return report.days.find((day) => day.date === todayDate(timezone)) ?? report.days[0] ?? null;
}

export function WeatherReadout({ place, onPress }: { place: OverviewPlace | null; onPress: () => void }) {
  const forecast = useQuery({
    queryKey: ['overview-weather', 'hourly', place?.latitude, place?.longitude],
    enabled: place != null,
    queryFn: () => fetchOverviewWeather(place!),
    staleTime: 10 * 60 * 1000,
  });
  const current = forecast.data?.current;
  const today = forecast.data && place ? todayDay(forecast.data, place) : null;
  const kind = current?.kind ?? 'cloud';
  const label = !place ? 'Set a place' : forecast.isLoading ? 'Loading' : (current?.label ?? 'Weather');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={place ? 'Open the daily forecast' : 'Set a weather place'}
      onPress={onPress}
      style={[styles.weatherChip, { backgroundColor: current ? WEATHER_WASH[kind] : colors.bgCard, borderColor: current ? KIND_COLOR[kind] : colors.border }]}>
      <Image source={WEATHER_ART[kind]} accessibilityIgnoresInvertColors style={styles.weatherArt} />
      <View style={styles.weatherCopy}>
        <Text style={[styles.weatherTemp, current ? { color: KIND_COLOR[kind] } : null]}>{current ? degrees(current.temperature) : '—'}</Text>
        <Text style={styles.weatherLabel} numberOfLines={1}>
          {label}
          {today ? `  ${degrees(today.high)} / ${degrees(today.low)}` : ''}
        </Text>
        {place ? (
          <Text style={styles.weatherPlace} numberOfLines={1}>
            {placeShort(place.label)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function WeatherSheet({
  visible,
  place,
  pickingPlace,
  saving,
  saveError,
  onClose,
  onChangePlace,
  onBackToForecast,
  onPick,
}: {
  visible: boolean;
  place: OverviewPlace | null;
  pickingPlace: boolean;
  saving: boolean;
  saveError: string | null;
  onClose: () => void;
  onChangePlace: () => void;
  onBackToForecast: () => void;
  onPick: (place: OverviewPlace) => void;
}) {
  const choosingPlace = pickingPlace || place == null;
  const forecast = useQuery({
    queryKey: ['overview-weather', 'hourly', place?.latitude, place?.longitude],
    enabled: visible && place != null && !choosingPlace,
    queryFn: () => fetchOverviewWeather(place!),
    staleTime: 10 * 60 * 1000,
  });
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [place?.latitude, place?.longitude]);

  const timezone = forecast.data?.timezone ?? place?.timezone ?? null;
  const selectedDay =
    forecast.data?.days.find((day) => day.date === selected) ??
    (forecast.data && place ? todayDay(forecast.data, place) : null);
  const current = forecast.data?.current ?? null;
  const isToday = selectedDay != null && selectedDay.date === todayDate(timezone);
  const kind = (isToday ? current?.kind : selectedDay?.kind) ?? 'cloud';
  const hours = selectedDay ? visibleHours(selectedDay, timezone) : [];

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => undefined} accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {choosingPlace ? 'Weather place' : place ? placeShort(place.label) : 'Weather'}
            </Text>
            <Pressable
              onPress={choosingPlace && place ? onBackToForecast : onClose}
              hitSlop={8}
              accessibilityRole="button">
              <Text style={styles.link}>{choosingPlace && place ? 'Forecast' : 'Close'}</Text>
            </Pressable>
          </View>
          {choosingPlace ? (
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
              <PlaceSearch onPick={onPick} />
              <ErrorText message={saveError} />
              {saving ? <Text style={styles.credit}>Saving…</Text> : null}
            </ScrollView>
          ) : (
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              <ErrorText message={saveError} />
              {forecast.isLoading ? <Text style={styles.muted}>Loading the forecast…</Text> : null}
              {forecast.isError ? (
                <ErrorText message={forecast.error instanceof Error ? forecast.error.message : 'Weather is unavailable right now.'} />
              ) : null}
              {selectedDay ? (
                <>
                  <View style={[styles.hero, { backgroundColor: WEATHER_WASH[kind], borderColor: KIND_COLOR[kind] }]}>
                    <Image source={WEATHER_ART[kind]} accessibilityIgnoresInvertColors style={styles.heroArt} />
                    <View style={styles.heroCopy}>
                      {isToday && current ? (
                        <Text style={[styles.heroTemp, { color: KIND_COLOR[kind] }]}>{degrees(current.temperature)}</Text>
                      ) : (
                        <Text style={[styles.heroTemp, { color: KIND_COLOR[kind] }]}>
                          {degrees(selectedDay.high)}
                          <Text style={styles.heroLow}> / {degrees(selectedDay.low)}</Text>
                        </Text>
                      )}
                      <Text style={styles.heroLabel}>{isToday && current ? current.label : selectedDay.label}</Text>
                      <Text style={styles.muted}>
                        {dayHeading(selectedDay.date, timezone)}
                        {isToday ? ` · ${degrees(selectedDay.high)} / ${degrees(selectedDay.low)}` : ''}
                        {rainLabel(selectedDay.rainChance) ? ` · ${rainLabel(selectedDay.rainChance)} rain` : ''}
                      </Text>
                      {isToday && current ? (
                        <Text style={styles.muted}>
                          {current.humidity != null ? `${Math.round(current.humidity)}% humidity` : 'Humidity unavailable'}
                          {current.wind != null ? ` · ${Math.round(current.wind)} km/h wind` : ''}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.sectionLabel}>Hourly</Text>
                  {hours.length > 0 ? (
                    <ScrollView
                      horizontal
                      nestedScrollEnabled
                      showsHorizontalScrollIndicator={false}
                      style={styles.hourScroller}
                      contentContainerStyle={styles.hourRow}>
                      {hours.map((hour) => {
                        const rain = rainLabel(hour.rainChance);
                        return (
                          <View key={hour.time} style={styles.hourCell} accessibilityLabel={`${hourLabel(hour.time)}, ${hour.label}, ${degrees(hour.temperature)}`}>
                            <Text style={styles.hourTime}>{hourLabel(hour.time)}</Text>
                            <Image source={WEATHER_ART[hour.kind]} accessibilityIgnoresInvertColors style={styles.hourArt} />
                            <Text style={[styles.hourTemp, { color: KIND_COLOR[hour.kind] }]}>{degrees(hour.temperature)}</Text>
                            <Text style={styles.hourRain}>{rain ?? ' '}</Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <Text style={styles.muted}>Hourly detail isn’t available for this day.</Text>
                  )}
                  <Text style={styles.sectionLabel}>This week</Text>
                  {forecast.data?.days.map((day) => {
                    const active = day.date === selectedDay.date;
                    const rain = rainLabel(day.rainChance);
                    return (
                      <Pressable
                        key={day.date}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${weekdayLabel(day.date, timezone)}, ${day.label}, high ${degrees(day.high)}, low ${degrees(day.low)}`}
                        onPress={() => setSelected(day.date)}
                        style={[styles.dayRow, active && styles.dayRowOn]}>
                        <Text style={[styles.dayName, active && styles.dayNameOn]}>{weekdayLabel(day.date, timezone)}</Text>
                        <Image source={WEATHER_ART[day.kind]} accessibilityIgnoresInvertColors style={styles.dayArt} />
                        <Text style={styles.dayKind} numberOfLines={1}>
                          {day.label}
                        </Text>
                        <Text style={styles.dayRain}>{rain ?? ''}</Text>
                        <Text style={styles.dayHigh}>{degrees(day.high)}</Text>
                        <Text style={styles.dayLow}>{degrees(day.low)}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable onPress={onChangePlace} accessibilityRole="button" style={styles.changePlace}>
                    <Text style={styles.link}>Change place</Text>
                  </Pressable>
                  <Text style={styles.credit}>Forecast from Open-Meteo</Text>
                </>
              ) : null}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

function PlaceSearch({ onPick }: { onPick: (place: OverviewPlace) => void }) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canLocate = Platform.OS === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const places = useQuery({
    queryKey: ['overview-places', submitted],
    enabled: submitted.length >= 2,
    queryFn: () => searchOverviewPlaces({ query: submitted }),
  });

  const pick = (found: PlaceSuggestion) => {
    onPick({
      label: found.label,
      latitude: found.latitude,
      longitude: found.longitude,
      timezone: found.timezone,
    });
  };

  const locate = () => {
    if (!canLocate) return;
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void searchOverviewPlaces({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
          .then((found) => {
            const first = found[0];
            if (!first) throw new Error('No place matched this device.');
            pick(first);
          })
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Could not use this device’s location.');
          })
          .finally(() => setLocating(false));
      },
      () => {
        setLocating(false);
        setError('Location permission was denied. Search for a place instead.');
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    );
  };

  return (
    <View style={styles.search}>
      <Field
        label="Place"
        value={query}
        onChangeText={setQuery}
        placeholder="City or town"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => setSubmitted(query.trim())}
      />
      <View style={styles.inlineActions}>
        <Btn label="Search" variant="secondary" onPress={() => setSubmitted(query.trim())} />
        {canLocate ? <Btn label="Use this device" variant="ghost" busy={locating} onPress={locate} /> : null}
      </View>
      {submitted.length === 1 ? <Text style={styles.muted}>Enter at least two letters.</Text> : null}
      <ErrorText message={error ?? (places.error instanceof Error ? places.error.message : null)} />
      {places.data?.map((found) => (
        <Pressable key={`${found.id}-${found.label}`} onPress={() => pick(found)} style={styles.placeHit}>
          <Text style={styles.choiceTitle}>{found.label}</Text>
          {found.country ? <Text style={styles.muted}>{found.country}</Text> : null}
        </Pressable>
      ))}
      {places.data && places.data.length === 0 ? <Text style={styles.muted}>No places matched that name.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 360,
    paddingLeft: 6,
    paddingRight: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  weatherArt: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.bg,
  },
  weatherCopy: {
    flexShrink: 1,
    gap: 1,
  },
  weatherTemp: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  weatherLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  weatherPlace: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 12, 0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    maxWidth: 560,
    width: '100%',
    maxHeight: '88%',
    alignSelf: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    flexShrink: 1,
    minHeight: 0,
  },
  bodyContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 12,
  },
  heroArt: {
    width: 84,
    height: 84,
    borderRadius: 18,
    backgroundColor: colors.bg,
  },
  heroCopy: {
    flex: 1,
    gap: 2,
  },
  heroTemp: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  heroLow: {
    color: colors.textDim,
    fontSize: 22,
    fontWeight: '600',
  },
  heroLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  hourScroller: {
    marginHorizontal: -4,
  },
  hourRow: {
    gap: 4,
    paddingHorizontal: 4,
  },
  hourCell: {
    width: 72,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  hourTime: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  hourArt: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.bg,
  },
  hourTemp: {
    fontSize: 16,
    fontWeight: '700',
  },
  hourRain: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    minHeight: 14,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayRowOn: {
    backgroundColor: colors.bgHover,
    borderColor: colors.border,
  },
  dayName: {
    width: 64,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  dayNameOn: {
    color: colors.accent,
  },
  dayArt: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.bg,
  },
  dayKind: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  dayRain: {
    width: 36,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  dayHigh: {
    width: 36,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  dayLow: {
    width: 36,
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  changePlace: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  link: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  credit: {
    color: colors.textDim,
    fontSize: 12,
  },
  search: {
    gap: 10,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  placeHit: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 2,
  },
  choiceTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
