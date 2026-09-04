import { type ReactNode } from 'react';
import { MEAL_SLOTS, type MealSlotKey } from '@kinexus/domain';

import { Btn, Card, ErrorText, Field } from '@/src/features/household/ui';
import { Chip } from '@/src/features/meals/meals-kit';
import type { ImportSource } from '@/src/lib/meals-api';
import { colors, space } from '@/src/features/shell/theme';
import { StyleSheet, Text, View } from 'react-native';

export type ImportFormState = {
  url: string;
  name: string;
  emoji: string;
  cuisine: string;
  cookTime: string;
  servings: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  ingredientsText: string;
  methodText: string;
  slots: MealSlotKey[];
  imageUrl: string;
};

export type ImportRecipeViewProps = {
  desktop: boolean;
  online: boolean;
  apiReady: boolean;
  tab: 'url' | 'text';
  setTab: (tab: 'url' | 'text') => void;
  paste: string;
  setPaste: (v: string) => void;
  form: ImportFormState;
  setForm: (patch: Partial<ImportFormState>) => void;
  phase: 'idle' | 'fetching' | 'extracting';
  source: ImportSource | null;
  error: string | null;
  blockedReason: string | null;
  busy: boolean;
  onExtract: () => void;
  onSave: () => void;
};

const SOURCE_COPY: Record<ImportSource, { title: string; body: string }> = {
  'json-ld': {
    title: 'Exact recipe data',
    body: 'Read from the page’s structured data. Review amounts before you cook.',
  },
  'text-scraped': {
    title: 'Extracted from the page',
    body: 'AI structured the page text. Wording may differ from the original.',
  },
  'blocked-ai': {
    title: 'AI reconstruction',
    body: 'The site blocked a direct fetch. This is from model knowledge — check it carefully.',
  },
  'text-paste': {
    title: 'Extracted from your text',
    body: 'AI structured what you pasted. Edit anything that looks off.',
  },
};

export function ImportExtractCard(props: ImportRecipeViewProps) {
  const loading = props.phase !== 'idle';
  return (
    <Card>
      <Text style={styles.heading}>Fetch or paste</Text>
      <View style={styles.chips}>
        <Chip label="URL" active={props.tab === 'url'} onPress={() => props.setTab('url')} />
        <Chip label="Paste text" active={props.tab === 'text'} onPress={() => props.setTab('text')} />
      </View>
      {props.tab === 'url' ? (
        <Field
          label="Recipe URL"
          value={props.form.url}
          onChangeText={(url) => props.setForm({ url })}
          placeholder="https://…"
        />
      ) : (
        <Field
          label="Recipe text"
          value={props.paste}
          onChangeText={props.setPaste}
          placeholder="Paste ingredients and method…"
          multiline
        />
      )}
      <Text style={styles.hint}>
        {props.tab === 'url'
          ? 'We try structured data first, then AI. If the site blocks us, AI reconstructs from the URL.'
          : 'Paste anything — a site, a message, notes. AI will structure it into the form.'}
      </Text>
      {!props.apiReady ? (
        <Text style={styles.hint}>
          Scrape/AI needs the API (`EXPO_PUBLIC_API_URL`) and `pnpm --filter @kinexus/api dev`. You can still fill the form
          by hand.
        </Text>
      ) : null}
      <Btn
        label={
          loading
            ? props.phase === 'fetching'
              ? 'Fetching page…'
              : 'Extracting with AI…'
            : props.tab === 'url'
              ? 'Fetch recipe'
              : 'Extract from text'
        }
        variant="secondary"
        disabled={!props.online || !props.apiReady || loading}
        busy={loading}
        onPress={props.onExtract}
      />
      {props.source ? (
        <View>
          <Text style={styles.sourceTitle}>{SOURCE_COPY[props.source].title}</Text>
          <Text style={styles.hint}>{SOURCE_COPY[props.source].body}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export function ImportFieldsCard(props: ImportRecipeViewProps) {
  const { form } = props;
  return (
    <>
      <View style={props.desktop ? styles.cols : styles.stack}>
        <Card>
          <Field label="Name" value={form.name} onChangeText={(name) => props.setForm({ name })} placeholder="Weeknight pasta" />
          <Field label="Emoji" value={form.emoji} onChangeText={(emoji) => props.setForm({ emoji })} />
          <Field label="Cuisine" value={form.cuisine} onChangeText={(cuisine) => props.setForm({ cuisine })} placeholder="Italian" />
          <Field
            label="Cook time (min)"
            value={form.cookTime}
            onChangeText={(cookTime) => props.setForm({ cookTime })}
            keyboardType="numeric"
          />
          <Field
            label="Servings"
            value={form.servings}
            onChangeText={(servings) => props.setForm({ servings })}
            keyboardType="numeric"
          />
        </Card>
        <Card>
          <Field label="Calories" value={form.calories} onChangeText={(calories) => props.setForm({ calories })} keyboardType="numeric" />
          <Field label="Protein g" value={form.protein} onChangeText={(protein) => props.setForm({ protein })} keyboardType="numeric" />
          <Field label="Carbs g" value={form.carbs} onChangeText={(carbs) => props.setForm({ carbs })} keyboardType="numeric" />
          <Field label="Fat g" value={form.fat} onChangeText={(fat) => props.setForm({ fat })} keyboardType="numeric" />
          <Text style={styles.hint}>Meal slots</Text>
          <View style={styles.chips}>
            {MEAL_SLOTS.map((slot) => (
              <Chip
                key={slot.key}
                label={slot.label}
                active={form.slots.includes(slot.key)}
                onPress={() =>
                  props.setForm({
                    slots: form.slots.includes(slot.key)
                      ? form.slots.filter((s) => s !== slot.key)
                      : [...form.slots, slot.key],
                  })
                }
              />
            ))}
          </View>
        </Card>
      </View>
      <Card>
        <Field
          label="Ingredients (one per line: amount | name)"
          value={form.ingredientsText}
          onChangeText={(ingredientsText) => props.setForm({ ingredientsText })}
          placeholder={'200g | chicken thigh\n1 | onion'}
          multiline
        />
        <Field
          label="Method (one step per line)"
          value={form.methodText}
          onChangeText={(methodText) => props.setForm({ methodText })}
          multiline
        />
      </Card>
    </>
  );
}

export function ImportChrome({
  desktop,
  children,
  error,
  blockedReason,
  online,
  busy,
  onSave,
}: {
  desktop: boolean;
  children: ReactNode;
  error: string | null;
  blockedReason: string | null;
  online: boolean;
  busy: boolean;
  onSave: () => void;
}) {
  return (
    <>
      <Text style={styles.kicker}>Household library</Text>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>Import recipe</Text>
      <Text style={styles.lede}>
        Fetch a URL or paste text to fill the form, then edit and save to this household. Generate Plan still runs locally
        from your library.
      </Text>
      {!online ? <ErrorText message={blockedReason} /> : null}
      {children}
      <ErrorText message={error} />
      <Btn label="Save to household" onPress={onSave} disabled={!online} busy={busy} />
    </>
  );
}

export const importStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: 12, paddingBottom: 48 },
  contentDesktop: { paddingHorizontal: 48, maxWidth: 1100 },
});

const styles = StyleSheet.create({
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  titleDesktop: { fontSize: 40 },
  lede: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  heading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  hint: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  sourceTitle: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cols: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  stack: { gap: 12 },
});
