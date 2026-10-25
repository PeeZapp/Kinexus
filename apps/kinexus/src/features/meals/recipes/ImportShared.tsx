import { Children, type ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { MEAL_SLOTS, RECIPE_CLASSES, type RecipeClass } from '@kinexus/domain';

import { BackLink, Btn, Card, ErrorText, Field } from '@/src/features/household/ui';
import { Chip } from '@/src/features/meals/meals-kit';
import { IngredientEditor, MethodEditor } from '@/src/features/meals/recipes/recipe-editors';
import type { RecipeFormState } from '@/src/features/meals/recipes/recipe-form';
import type { ImportSource, MissingRecipe } from '@/src/lib/meals-api';
import { openRecipeLink } from '@/src/features/meals/recipes/link-recipe';
import { colors, radius, space } from '@/src/features/shell/theme';

export type { RecipeFormState };
export type ImportFormState = RecipeFormState;

export type ImportRecipeViewProps = {
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
  missing: MissingRecipe | null;
  onDishName: (name: string) => void;
  onGenerateFromName: () => void;
  onSaveLink: () => void;
  error: string | null;
  blockedReason: string | null;
  busy: boolean;
  onExtract: () => void;
  onSave: () => void;
};

const SOURCE_COPY: Record<ImportSource, string> = {
  'json-ld': 'Read from the page. Check amounts before you cook.',
  'text-scraped': 'Structured from the page text. Wording may differ.',
  'blocked-ai': 'The site blocked a direct fetch. Review this carefully.',
  'text-paste': 'Structured from what you pasted.',
  'generated-name': 'A new recipe for the name you entered.',
};

const SOURCE_TITLE: Record<ImportSource, string> = {
  'json-ld': 'Recipe found',
  'text-scraped': 'Extracted from the page',
  'blocked-ai': 'AI reconstruction',
  'text-paste': 'Extracted from your text',
  'generated-name': 'Generated recipe',
};

export function ImportView(props: ImportRecipeViewProps) {
  const router = useRouter();
  const [pane, setPane] = useState(0);
  const [rowWidth, setRowWidth] = useState(0);
  const pad = pane >= 1200 ? 32 : pane >= 800 ? 24 : 16;
  const rail = rowWidth >= 900;

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.push('/meals/recipes' as Href);
  }

  return (
    <KeyboardAvoidingView
      style={importStyles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.width);
          setPane((current) => (current === next ? current : next));
        }}>
        <View style={[styles.page, { paddingHorizontal: pad, paddingTop: pad }]}>
          <View style={styles.header}>
            <BackLink label="Library" onPress={goBack} />
            <Text style={styles.title}>Import recipe</Text>
          </View>
          {!props.online ? <ErrorText message={props.blockedReason} /> : null}
          <View
            onLayout={(event) => {
              const next = Math.round(event.nativeEvent.layout.width);
              setRowWidth((current) => (current === next ? current : next));
            }}
            style={[styles.columns, rail && styles.columnsRail]}>
            <View style={[styles.sourceCol, rail && styles.sourceColRail]}>
              <ImportExtractCard {...props} />
            </View>
            <View style={styles.formCol}>
              <ImportFieldsCard form={props.form} setForm={props.setForm} />
            </View>
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <View style={[styles.footerInner, { paddingHorizontal: pad }, rail && styles.footerInnerRail]}>
          {props.error ? (
            <View style={styles.footerError}>
              <ErrorText message={props.error} />
            </View>
          ) : null}
          <View style={rail ? styles.saveRail : styles.saveStack}>
            <Btn label="Save to household" onPress={props.onSave} disabled={!props.online} busy={props.busy} />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export function ImportExtractCard(props: ImportRecipeViewProps) {
  const loading = props.phase !== 'idle';
  const fetchLabel = loading
    ? props.phase === 'fetching'
      ? 'Fetching page…'
      : 'Extracting…'
    : props.tab === 'url'
      ? 'Fetch recipe'
      : 'Extract recipe';

  return (
    <Card>
      <View style={styles.segment} accessibilityRole="tablist">
        <Segment label="Link" active={props.tab === 'url'} onPress={() => props.setTab('url')} />
        <Segment label="Text" active={props.tab === 'text'} onPress={() => props.setTab('text')} />
      </View>
      {props.tab === 'url' ? (
        <Field
          label="Recipe link"
          value={props.form.url}
          onChangeText={(url) => props.setForm({ url })}
          placeholder="https://"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      ) : (
        <Field
          label="Recipe text"
          value={props.paste}
          onChangeText={props.setPaste}
          placeholder="Paste a recipe"
          multiline
        />
      )}
      <Btn
        label={fetchLabel}
        disabled={!props.online || !props.apiReady || loading}
        busy={loading && !props.missing}
        onPress={props.onExtract}
      />
      {props.source ? (
        <View style={styles.note}>
          <Text style={styles.noteTitle}>{SOURCE_TITLE[props.source]}</Text>
          <Text style={styles.noteBody}>{SOURCE_COPY[props.source]}</Text>
        </View>
      ) : null}
      {props.missing ? <MissingRecipeCard {...props} /> : null}
      {!props.apiReady ? <Text style={styles.apiNote}>Recipe import needs the API server.</Text> : null}
    </Card>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.segmentItem, active && styles.segmentItemOn]}>
      <Text style={[styles.segmentLabel, active && styles.segmentLabelOn]}>{label}</Text>
    </Pressable>
  );
}

function MissingRecipeCard(props: ImportRecipeViewProps) {
  const missing = props.missing;
  if (!missing) return null;
  const loading = props.phase !== 'idle';
  return (
    <View style={styles.missing}>
      <Text style={styles.missingTitle}>No recipe on this page</Text>
      <Pressable onPress={() => openRecipeLink(missing.recipeUrl)} accessibilityRole="link">
        <Text style={styles.link}>{missing.recipeUrl}</Text>
      </Pressable>
      <View style={styles.pair}>
        <View style={styles.pairItem}>
          <Btn label="Open link" variant="secondary" onPress={() => openRecipeLink(missing.recipeUrl)} />
        </View>
        <View style={styles.pairItem}>
          <Btn
            label="Save link"
            variant="secondary"
            disabled={!props.online || props.busy || loading}
            busy={props.busy}
            onPress={props.onSaveLink}
          />
        </View>
      </View>
      <Field label="Dish name" value={missing.dishName} onChangeText={props.onDishName} placeholder="Steak alfredo" />
      <Btn
        label={loading ? 'Generating…' : 'Generate recipe'}
        disabled={!props.online || !props.apiReady || loading || missing.dishName.trim().length < 2}
        busy={loading}
        onPress={props.onGenerateFromName}
      />
    </View>
  );
}

export function ImportFieldsCard({
  form,
  setForm,
}: {
  form: RecipeFormState;
  setForm: (patch: Partial<RecipeFormState>) => void;
}) {
  const [width, setWidth] = useState(0);
  const metaCols = width >= 640 ? 3 : 1;
  const nutritionCols = width >= 640 ? 4 : 2;
  const notesCols = width >= 640 ? 2 : 1;
  const splitWork = width >= 760;

  return (
    <View
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setWidth((current) => (current === next ? current : next));
      }}
      style={styles.fields}>
      <Card>
        <Text style={styles.section}>Details</Text>
        <View style={styles.identity}>
          <View style={styles.emoji}>
            <Field label="Emoji" value={form.emoji} onChangeText={(emoji) => setForm({ emoji })} />
          </View>
          <View style={styles.identityName}>
            <Field label="Name" value={form.name} onChangeText={(name) => setForm({ name })} placeholder="Weeknight pasta" />
          </View>
        </View>
        {metaCols === 3 ? (
          <Split columns={3}>
            <Field label="Cuisine" value={form.cuisine} onChangeText={(cuisine) => setForm({ cuisine })} placeholder="Italian" />
            <Field
              label="Minutes"
              value={form.cookTime}
              onChangeText={(cookTime) => setForm({ cookTime })}
              keyboardType="numeric"
            />
            <Field
              label="Servings"
              value={form.servings}
              onChangeText={(servings) => setForm({ servings })}
              keyboardType="numeric"
            />
          </Split>
        ) : (
          <>
            <Field label="Cuisine" value={form.cuisine} onChangeText={(cuisine) => setForm({ cuisine })} placeholder="Italian" />
            <Split columns={2}>
              <Field
                label="Minutes"
                value={form.cookTime}
                onChangeText={(cookTime) => setForm({ cookTime })}
                keyboardType="numeric"
              />
              <Field
                label="Servings"
                value={form.servings}
                onChangeText={(servings) => setForm({ servings })}
                keyboardType="numeric"
              />
            </Split>
          </>
        )}
      </Card>
      <Card>
        <Text style={styles.section}>Nutrition</Text>
        <Split columns={nutritionCols}>
          <Field label="Calories" value={form.calories} onChangeText={(calories) => setForm({ calories })} keyboardType="numeric" />
          <Field label="Protein g" value={form.protein} onChangeText={(protein) => setForm({ protein })} keyboardType="numeric" />
          <Field label="Carbs g" value={form.carbs} onChangeText={(carbs) => setForm({ carbs })} keyboardType="numeric" />
          <Field label="Fat g" value={form.fat} onChangeText={(fat) => setForm({ fat })} keyboardType="numeric" />
        </Split>
      </Card>
      <Card>
        <Text style={styles.section}>Class</Text>
        <View style={styles.chips}>
          {RECIPE_CLASSES.map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              active={form.recipeClass === item.key}
              onPress={() =>
                setForm({
                  recipeClass: (form.recipeClass === item.key ? null : item.key) as RecipeClass | null,
                })
              }
            />
          ))}
        </View>
        <Text style={styles.section}>Meal slots</Text>
        <View style={styles.chips}>
          {MEAL_SLOTS.map((slot) => (
            <Chip
              key={slot.key}
              label={slot.label}
              active={form.slots.includes(slot.key)}
              onPress={() =>
                setForm({
                  slots: form.slots.includes(slot.key)
                    ? form.slots.filter((entry) => entry !== slot.key)
                    : [...form.slots, slot.key],
                })
              }
            />
          ))}
        </View>
      </Card>
      <View style={splitWork ? styles.workRow : styles.workStack}>
        <View style={splitWork ? styles.workCol : styles.workFull}>
          <Card>
            <IngredientEditor ingredients={form.ingredients} setForm={setForm} hint={false} />
          </Card>
        </View>
        <View style={splitWork ? styles.workCol : styles.workFull}>
          <Card>
            <MethodEditor method={form.method} setForm={setForm} hint={false} />
          </Card>
        </View>
      </View>
      <Card>
        <Split columns={notesCols}>
          <Field label="Chef tip" value={form.chefTip} onChangeText={(chefTip) => setForm({ chefTip })} multiline />
          <Field label="Notes" value={form.notes} onChangeText={(notes) => setForm({ notes })} multiline />
        </Split>
      </Card>
    </View>
  );
}

function Split({ columns, children }: { columns: 1 | 2 | 3 | 4; children: ReactNode }) {
  const items = Children.toArray(children);
  if (columns === 1) return <View style={styles.split}>{items}</View>;
  const rows: ReactNode[][] = [];
  for (let index = 0; index < items.length; index += columns) rows.push(items.slice(index, index + columns));
  return (
    <View style={styles.split}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.splitRow}>
          {row.map((item, itemIndex) => (
            <View key={itemIndex} style={styles.splitCell}>
              {item}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export const importStyles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, backgroundColor: colors.bg },
  content: {
    padding: space.md,
    gap: 12,
    paddingBottom: 48,
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
  },
  contentDesktop: { paddingHorizontal: 32, paddingTop: 28 },
});

const styles = StyleSheet.create({
  scroll: { flex: 1, minWidth: 0 },
  scrollContent: { flexGrow: 1 },
  page: { width: '100%', maxWidth: 1120, alignSelf: 'center', gap: 16, paddingBottom: 24 },
  header: { gap: 10 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  columns: { gap: 16, minWidth: 0 },
  columnsRail: { flexDirection: 'row', alignItems: 'flex-start' },
  sourceCol: { minWidth: 0 },
  sourceColRail: {
    width: 320,
    flexShrink: 0,
    ...(Platform.OS === 'web' ? { position: 'sticky' as const, top: 12 } : {}),
  },
  formCol: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 12 },
  fields: { gap: 12, minWidth: 0 },
  section: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  identity: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', minWidth: 0 },
  emoji: { width: 88, flexShrink: 0 },
  identityName: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  workRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', minWidth: 0 },
  workStack: { gap: 12, minWidth: 0 },
  workCol: { flex: 1, minWidth: 0 },
  workFull: { minWidth: 0, alignSelf: 'stretch' },
  split: { gap: 12 },
  splitRow: { flexDirection: 'row', gap: 12, minWidth: 0 },
  splitCell: { flex: 1, minWidth: 0 },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemOn: { backgroundColor: colors.bgHover },
  segmentLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  segmentLabelOn: { color: colors.text },
  note: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  noteTitle: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  noteBody: { color: colors.text, fontSize: 13, lineHeight: 18 },
  apiNote: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
  missing: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  missingTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  link: { color: colors.accent, fontSize: 14, lineHeight: 20 },
  pair: { flexDirection: 'row', gap: 8 },
  pairItem: { flex: 1, minWidth: 0 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingVertical: 12,
  },
  footerInner: { width: '100%', maxWidth: 1120, alignSelf: 'center', gap: 12 },
  footerInnerRail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  footerError: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  saveRail: { flexShrink: 0, minWidth: 200 },
  saveStack: { alignSelf: 'stretch' },
});
