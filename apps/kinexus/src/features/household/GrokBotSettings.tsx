import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Btn, Card, ErrorText } from '@/src/features/household/ui';
import { colors } from '@/src/features/shell/theme';
import { GROK_BOT_SUNDAY_OPS_ROUTINE, GROK_BOT_SUNDAY_OPS_TITLE } from '@/src/lib/grok-bot-routine';
import { connectorAddress, connectorIsPublic, grokBotConnectMessage, openGrokBot } from '@/src/lib/grok-connect';
import { useHousehold } from '@/src/lib/household';
import {
  createGroceryConnector,
  listGroceryConnectors,
  revokeGroceryConnector,
  type GroceryConnector,
} from '@/src/lib/meals-api';

export function GrokBotSettings() {
  const { activeHousehold } = useHousehold();
  const [connectors, setConnectors] = useState<GroceryConnector[]>([]);
  const [issued, setIssued] = useState<{ address: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedRoutine, setCopiedRoutine] = useState(false);

  const householdId = activeHousehold?.id;

  useEffect(() => {
    if (!householdId) return;
    let cancel = false;
    void listGroceryConnectors(householdId)
      .then((result) => {
        if (!cancel) setConnectors(result.connectors.filter((row) => !row.revokedAt));
      })
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : 'Could not load Grok Bot.');
      });
    return () => {
      cancel = true;
    };
  }, [householdId]);

  if (!householdId) return null;

  async function connect() {
    setError(null);
    setBusy(true);
    try {
      const created = await createGroceryConnector(householdId!);
      const address = connectorAddress(created.mcpUrl, created.token);
      const message = grokBotConnectMessage(address);
      setIssued({ address, message });
      await Clipboard.setStringAsync(message);
      await openGrokBot();
      const result = await listGroceryConnectors(householdId!);
      setConnectors(result.connectors.filter((row) => !row.revokedAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect Grok Bot.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      await revokeGroceryConnector(id);
      const result = await listGroceryConnectors(householdId!);
      setConnectors(result.connectors.filter((row) => !row.revokedAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke that connector.');
    }
  }

  async function copySundayRoutine() {
    setError(null);
    try {
      await Clipboard.setStringAsync(GROK_BOT_SUNDAY_OPS_ROUTINE);
      setCopiedRoutine(true);
      await openGrokBot();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not copy the routine.');
    }
  }

  return (
    <Card style={styles.cardFill}>
      <Text style={styles.heading}>Grok Bot</Text>
      <ErrorText message={error} />
      <Btn label="Connect Grok Bot" busy={busy} disabled={busy} onPress={() => void connect()} />
      {issued ? (
        <View style={styles.issued}>
          <Pressable onPress={() => void Clipboard.setStringAsync(issued.message)}>
            <Text style={styles.message}>{issued.message}</Text>
          </Pressable>
          {connectorIsPublic(issued.address) ? null : <Text style={styles.note}>This address only works on this computer.</Text>}
          <Pressable onPress={() => void openGrokBot()}>
            <Text style={styles.open}>Open Grok Bot</Text>
          </Pressable>
        </View>
      ) : null}
      {connectors.length > 0 ? (
        <View style={styles.routine}>
          <Text style={styles.routineTitle}>{GROK_BOT_SUNDAY_OPS_TITLE}</Text>
          <Btn
            label={copiedRoutine ? 'Routine copied' : 'Copy Sunday ops routine'}
            onPress={() => void copySundayRoutine()}
          />
        </View>
      ) : null}
      {connectors.map((row) => (
        <View key={row.id} style={styles.connector}>
          <Text style={styles.connectorLabel}>{row.label}</Text>
          <Pressable onPress={() => void revoke(row.id)}>
            <Text style={styles.revoke}>Revoke</Text>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  cardFill: { flex: 1 },
  heading: { color: colors.text, fontSize: 17, fontWeight: '700' },
  issued: { gap: 8 },
  message: { color: colors.text, fontSize: 13 },
  note: { color: colors.textMuted, fontSize: 12 },
  open: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  routine: { gap: 8 },
  routineTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  connector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  connectorLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  revoke: { color: colors.danger, fontSize: 13, fontWeight: '700' },
});
