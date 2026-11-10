import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  parseGoodreadsCsv,
  type GoodreadsImportRow,
} from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
import { pickListFile, type PickedListFile } from '@/src/features/lists/list-file-io';
import { Sheet } from '@/src/features/meals/meals-kit';
import {
  commitReadlistImport,
  matchReadlistImport,
  searchBooks,
  type ReadlistImportCommitRow,
  type ReadlistImportMatchCandidate,
  type ReadlistImportMatchResultRow,
} from '@/src/features/readlist/readlist-api';
import { colors, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

type Step = 'upload' | 'matching' | 'review' | 'progress' | 'check' | 'summary';

const MATCH_BATCH = 50;
const COMMIT_BATCH = 50;

function toCommitRow(row: ReadlistImportMatchResultRow): ReadlistImportCommitRow {
  return {
    key: row.key,
    tier: row.tier,
    workId: row.match?.workId ?? null,
    title: row.import.title,
    author: row.import.author,
    isbn10: row.import.isbn10,
    isbn13: row.import.isbn13,
    score: row.import.score,
    format: row.import.format,
    status: row.import.status,
  };
}

export function ReadlistGoodreadsImport({
  visible,
  listId,
  onClose,
  onDone,
}: {
  visible: boolean;
  listId: string | null;
  onClose: () => void;
  onDone?: () => void;
}) {
  useExperienceMode();
  const [step, setStep] = useState<Step>('upload');
  const [picked, setPicked] = useState<PickedListFile | null>(null);
  const [parsed, setParsed] = useState<GoodreadsImportRow[]>([]);
  const [matched, setMatched] = useState<ReadlistImportMatchResultRow[]>([]);
  const [checkThese, setCheckThese] = useState<ReadlistImportCommitRow[]>([]);
  const [checkIndex, setCheckIndex] = useState(0);
  const [manualQuery, setManualQuery] = useState('');
  const [manualHits, setManualHits] = useState<ReadlistImportMatchCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [importedCount, setImportedCount] = useState(0);
  const cancelRef = useRef({ cancelled: false });

  useEffect(() => {
    if (!visible) return;
    setStep('upload');
    setPicked(null);
    setParsed([]);
    setMatched([]);
    setCheckThese([]);
    setCheckIndex(0);
    setManualQuery('');
    setManualHits([]);
    setError(null);
    setBusy(false);
    setProgress({ done: 0, total: 0 });
    setImportedCount(0);
    cancelRef.current = { cancelled: false };
  }, [visible]);

  const counts = useMemo(() => {
    const total = matched.length;
    let exact = 0;
    let likely = 0;
    let unsure = 0;
    let none = 0;
    for (const row of matched) {
      if (row.tier === 'exact') exact += 1;
      else if (row.tier === 'likely') likely += 1;
      else if (row.tier === 'unsure') unsure += 1;
      else none += 1;
    }
    return { total, exact, likely, unsure, none, matched: exact + likely };
  }, [matched]);

  async function analyse(file?: PickedListFile | null) {
    const source = file ?? picked;
    const text = source?.text?.trim();
    if (!text) {
      setError('Choose a Goodreads CSV export');
      return;
    }
    if (!listId) {
      setError('Pick a list first');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const rows = parseGoodreadsCsv(text);
      if (rows.length === 0) throw new Error('No books found in that CSV');
      setParsed(rows);
      setStep('matching');
      const all: ReadlistImportMatchResultRow[] = [];
      for (let offset = 0; offset < rows.length; offset += MATCH_BATCH) {
        if (cancelRef.current.cancelled) break;
        const batch = rows.slice(offset, offset + MATCH_BATCH);
        const result = await matchReadlistImport(batch);
        all.push(...result.rows);
        setProgress({ done: all.length, total: rows.length });
        setMatched([...all]);
      }
      setMatched(all);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file');
      setStep('upload');
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!listId || busy) return;
    const auto = matched.filter((row) => row.tier === 'exact' || row.tier === 'likely').map(toCommitRow);
    const pendingCheck = matched.filter((row) => row.tier === 'unsure' || row.tier === 'none').map(toCommitRow);
    setStep('progress');
    setBusy(true);
    setError(null);
    cancelRef.current = { cancelled: false };
    let imported = 0;
    const leftover: ReadlistImportCommitRow[] = [...pendingCheck];
    try {
      setProgress({ done: 0, total: auto.length });
      for (let offset = 0; offset < auto.length; offset += COMMIT_BATCH) {
        if (cancelRef.current.cancelled) break;
        const batch = auto.slice(offset, offset + COMMIT_BATCH);
        const result = await commitReadlistImport(listId, batch);
        imported += result.progress.imported;
        leftover.push(...result.checkThese);
        setProgress({ done: Math.min(offset + batch.length, auto.length), total: auto.length });
      }
      setImportedCount(imported);
      if (leftover.length > 0) {
        setCheckThese(leftover);
        setCheckIndex(0);
        setManualQuery(leftover[0]?.title ?? '');
        setManualHits([]);
        setStep('check');
      } else {
        setStep('summary');
        onDone?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('review');
    } finally {
      setBusy(false);
    }
  }

  async function runManualSearch() {
    const query = manualQuery.trim() || checkThese[checkIndex]?.title || '';
    if (query.length < 2) {
      setError('Type at least two characters');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const hits = await searchBooks(query);
      setManualHits(
        hits.map((hit) => ({
          workId: hit.workId,
          title: hit.title,
          authors: hit.authors,
          firstPublishedYear: hit.firstPublishedYear,
          coverUrl: hit.coverUrl,
          isbn13: hit.ids.isbn13,
          confidence: 1,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  }

  async function acceptCheck(candidate: ReadlistImportMatchCandidate) {
    if (!listId) return;
    const current = checkThese[checkIndex];
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await commitReadlistImport(listId, [
        {
          ...current,
          tier: 'exact',
          workId: candidate.workId,
          title: candidate.title || current.title,
        },
      ]);
      setImportedCount((value) => value + 1);
      advanceCheck();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add book');
    } finally {
      setBusy(false);
    }
  }

  function advanceCheck() {
    const next = checkThese.slice(checkIndex + 1);
    if (next.length === 0) {
      setCheckThese([]);
      setStep('summary');
      onDone?.();
      return;
    }
    setCheckThese(next);
    setCheckIndex(0);
    setManualQuery(next[0]?.title ?? '');
    setManualHits([]);
  }

  const currentCheck = checkThese[checkIndex] ?? null;

  return (
    <Sheet visible={visible} title={step === 'check' ? 'Check these' : 'Import Readlist'} onClose={onClose}>
      <View style={styles.stack}>
        {step === 'upload' ? (
          <>
            <Text style={styles.hint}>Goodreads CSV export</Text>
            <View style={styles.wrap}>
              <Btn
                label="Choose file"
                variant="secondary"
                onPress={() =>
                  void pickListFile().then((file) => {
                    if (!file) return;
                    setPicked(file);
                  })
                }
              />
            </View>
            {picked ? <Text style={styles.hint}>{picked.fileName}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Btn
              label={busy ? 'Reading…' : 'Continue'}
              onPress={() => void analyse()}
              busy={busy}
              disabled={!picked?.text}
            />
          </>
        ) : null}

        {step === 'matching' ? (
          <>
            <Text style={styles.hint}>
              Matching… {progress.done} / {progress.total || parsed.length}
            </Text>
            <Btn
              label="Cancel"
              variant="secondary"
              onPress={() => {
                cancelRef.current.cancelled = true;
              }}
            />
          </>
        ) : null}

        {step === 'review' ? (
          <>
            <Text style={styles.summary}>
              {counts.total} books found, {counts.matched} matched
            </Text>
            <Text style={styles.hint}>
              {counts.exact} exact · {counts.likely} likely
              {counts.unsure + counts.none > 0 ? ` · ${counts.unsure + counts.none} to check` : ''}
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Btn
              label="Import"
              onPress={() => void runImport()}
              disabled={counts.matched === 0 && counts.unsure + counts.none === 0}
            />
            <Btn label="Back" variant="ghost" onPress={() => setStep('upload')} />
          </>
        ) : null}

        {step === 'progress' ? (
          <>
            <Text style={styles.hint}>
              Importing… {progress.done} / {progress.total}
            </Text>
            <Btn
              label="Cancel"
              variant="secondary"
              onPress={() => {
                cancelRef.current.cancelled = true;
              }}
            />
          </>
        ) : null}

        {step === 'check' && currentCheck ? (
          <>
            <Text style={styles.hint}>
              {checkIndex + 1} of {checkThese.length}
            </Text>
            <Text style={styles.rowTitle}>
              {currentCheck.title}
              {currentCheck.author ? ` — ${currentCheck.author}` : ''}
            </Text>
            <Field label="Search" value={manualQuery} onChangeText={setManualQuery} placeholder="Title or author" />
            <View style={styles.wrap}>
              <Btn label={busy ? 'Searching…' : 'Search'} onPress={() => void runManualSearch()} busy={busy} />
              <Btn label="Skip" variant="ghost" onPress={advanceCheck} />
            </View>
            <View style={styles.wrap}>
              {manualHits.map((hit) => (
                <Pill
                  key={hit.workId}
                  label={`${hit.title}${hit.authors[0] ? ` — ${hit.authors[0]}` : ''}`}
                  onPress={() => void acceptCheck(hit)}
                />
              ))}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        ) : null}

        {step === 'summary' ? (
          <>
            <Text style={styles.hint}>Imported {importedCount}</Text>
            <Btn label="Done" onPress={onClose} />
          </>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: colors.textMuted, fontSize: 14 },
  summary: { color: colors.text, fontSize: 16, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 14 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
