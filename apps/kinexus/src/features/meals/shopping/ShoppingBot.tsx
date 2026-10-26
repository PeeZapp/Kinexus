import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import {
  createGroceryConnector,
  createGroceryHandoff,
  listGroceryConnectors,
  revokeGroceryConnector,
  type GroceryConnector,
} from '@/src/lib/meals-api';
import { colors, radius } from '@/src/features/shell/theme';
import { connectorAddress, connectorIsPublic, grokBotConnectMessage, openGrokBot } from '@/src/lib/grok-connect';

export function ShoppingBot({
  householdId,
  weekStart,
  chains,
  preferredChainId,
  canChooseShop,
  online,
  onPrefer,
}: {
  householdId: string;
  weekStart: string;
  chains: readonly { id: string; name: string }[];
  preferredChainId: string | null;
  canChooseShop: boolean;
  online: boolean;
  onPrefer: (chainId: string) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<'shop' | 'trolley' | 'connect' | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [issued, setIssued] = useState<{ address: string; token: string } | null>(null);

  if (chains.length === 0) return null;

  async function choose(chainId: string) {
    setError(null);
    setBusy('shop');
    try {
      await onPrefer(chainId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that shop.');
    } finally {
      setBusy(null);
    }
  }

  async function fill() {
    setError(null);
    setNote(null);
    setBusy('trolley');
    try {
      const result = await createGroceryHandoff({ householdId, weekStart });
      const skipped = result.order.skipped.length;
      setNote(skipped > 0 ? `${skipped} still need a product` : `${result.order.lines.length} ready`);
      if (Platform.OS === 'web') window.open(result.shopUrl, '_blank', 'noopener');
      else await Linking.openURL(result.shopUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fill the trolley.');
    } finally {
      setBusy(null);
    }
  }

  async function connect() {
    setError(null);
    setBusy('connect');
    setConnectOpen(true);
    try {
      const created = await createGroceryConnector(householdId);
      const address = connectorAddress(created.mcpUrl, created.token);
      setIssued({ address, token: created.token });
      await Clipboard.setStringAsync(grokBotConnectMessage(address));
      await openGrokBot();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect Grok Bot.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.shops}>
        {chains.map((chain) => {
          const selected = chain.id === preferredChainId;
          return (
            <Pressable
              key={chain.id}
              disabled={!online || !canChooseShop || busy != null}
              onPress={() => void choose(chain.id)}
              style={[styles.shop, selected && styles.shopOn]}>
              <Text style={[styles.shopText, selected && styles.shopTextOn]}>{chain.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.actions}>
        <Btn label="Fill trolley" variant="secondary" disabled={!online || !preferredChainId || busy != null} busy={busy === 'trolley'} onPress={() => void fill()} />
        <Btn label="Connect Grok Bot" variant="ghost" disabled={!online || busy != null} busy={busy === 'connect'} onPress={() => void connect()} />
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <ErrorText message={error} />
      <ConnectSheet
        visible={connectOpen}
        householdId={householdId}
        issued={issued}
        error={error}
        onClose={() => setConnectOpen(false)}
      />
    </View>
  );
}

function ConnectSheet({
  visible,
  householdId,
  issued,
  error,
  onClose,
}: {
  visible: boolean;
  householdId: string;
  issued: { address: string; token: string } | null;
  error: string | null;
  onClose: () => void;
}) {
  const [connectors, setConnectors] = useState<GroceryConnector[] | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancel = false;
    void listGroceryConnectors(householdId)
      .then((result) => {
        if (!cancel) setConnectors(result.connectors.filter((row) => !row.revokedAt));
      })
      .catch((err: unknown) => {
        if (!cancel) setLocalError(err instanceof Error ? err.message : 'Could not load connectors.');
      });
    return () => {
      cancel = true;
    };
  }, [householdId, visible, issued?.token]);

  return (
    <Sheet visible={visible} title="Connect Grok Bot" onClose={onClose}>
      <View style={styles.sheet}>
        <ErrorText message={error ?? localError} />
        {issued ? (
          <View style={styles.secret}>
            <CopyRow label="Message" value={grokBotConnectMessage(issued.address)} />
            <Pressable onPress={() => void openGrokBot()}>
              <Text style={styles.shopText}>Open Grok Bot</Text>
            </Pressable>
            {connectorIsPublic(issued.address) ? null : (
              <Text style={styles.note}>Grok Bot needs the deployed https address. This one only works on this computer.</Text>
            )}
          </View>
        ) : null}
        {(connectors ?? []).map((row) => (
          <View key={row.id} style={styles.connector}>
            <Text style={styles.shopText}>{row.label}</Text>
            <Pressable
              onPress={() => {
                void revokeGroceryConnector(row.id)
                  .then(() => listGroceryConnectors(householdId))
                  .then((result) => setConnectors(result.connectors.filter((item) => !item.revokedAt)))
                  .catch((err: unknown) => setLocalError(err instanceof Error ? err.message : 'Could not revoke that connector.'));
              }}>
              <Text style={styles.revoke}>Revoke</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <Pressable onPress={() => void Clipboard.setStringAsync(value)} style={styles.copy}>
      <Text style={styles.copyLabel}>{label}</Text>
      <Text style={styles.copyValue} numberOfLines={2}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  shops: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shop: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shopOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  shopText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  shopTextOn: { color: colors.accent },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  note: { color: colors.textMuted, fontSize: 12 },
  sheet: { gap: 12, paddingTop: 8 },
  secret: { gap: 8 },
  copy: { gap: 2 },
  copyLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  copyValue: { color: colors.text, fontSize: 13 },
  connector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  revoke: { color: colors.danger, fontSize: 12, fontWeight: '700' },
});
