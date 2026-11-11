import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { connectionForPlatform } from '@/src/features/connectors/claude';
import {
  listMcpConnections,
  revokeMcpConnection,
  type McpConnection,
} from '@/src/features/connectors/connections-api';
import { aiChatMcpUrl } from '@/src/features/connectors/mcp-url';
import {
  aiChatPlatformById,
  buildAiChatSetupPrompt,
  connectWizardActions,
  openTargetForPlatform,
  visibleAiChatPlatforms,
  type AiChatPlatform,
} from '@/src/features/connectors/platforms';
import {
  findNewConnection,
  POLL_INTERVAL_MS,
  shouldShowWaitingHint,
  shouldStopPolling,
} from '@/src/features/connectors/poll';
import { Btn, Card, ErrorText } from '@/src/features/household/ui';
import { Toast } from '@/src/features/meals/Toast';
import { AppModal } from '@/src/features/shell/AppModal';
import { colors, radius, space } from '@/src/features/shell/theme';
import { confirmAction } from '@/src/lib/confirm';

function formatConnectedDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

function connectionLabel(row: McpConnection): { icon: string; name: string } {
  const platform = aiChatPlatformById(row.platform);
  if (platform) return { icon: platform.icon, name: platform.name };
  const name = row.clientName?.trim() || row.platform || 'AI app';
  return { icon: name.slice(0, 1).toUpperCase() || 'A', name };
}

/** Public MCP URL for Copy URL / guide — always current origin helper. */
function mcpUrlForCopy(): string {
  return aiChatMcpUrl();
}

async function openPlatform(platform: AiChatPlatform): Promise<void> {
  const isWeb = Platform.OS === 'web';
  let canOpenApp = false;
  if (!isWeb && platform.appDeepLink) {
    try {
      canOpenApp = await Linking.canOpenURL(platform.appDeepLink);
    } catch {
      canOpenApp = false;
    }
  }
  const url = openTargetForPlatform(platform, mcpUrlForCopy(), { isWeb, canOpenApp });
  if (url) await Linking.openURL(url);
}

export function ConnectedAiChats() {
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [waiting, setWaiting] = useState<AiChatPlatform | null>(null);
  const [connectedFlash, setConnectedFlash] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [troubleOpen, setTroubleOpen] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const baselineRef = useRef<Set<string>>(new Set());
  const closedRef = useRef(false);

  const platforms = visibleAiChatPlatforms();

  const reload = useCallback(async () => {
    const rows = await listMcpConnections();
    setConnections(rows);
    return rows;
  }, []);

  useEffect(() => {
    let cancel = false;
    setError(null);
    void reload().catch((err: unknown) => {
      if (!cancel) setError(err instanceof Error ? err.message : 'Could not load connections.');
    });
    return () => {
      cancel = true;
    };
  }, [reload]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active') return;
      void reload().catch(() => undefined);
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [reload]);

  useEffect(() => {
    if (!waiting) return;
    closedRef.current = false;
    setShowHint(false);
    setConnectedFlash(false);
    setTroubleOpen(false);
    const startedAt = Date.now();
    const platformId = waiting.id;

    const tick = async () => {
      if (
        shouldStopPolling({
          startedAt,
          now: Date.now(),
          closed: closedRef.current,
          found: false,
        })
      ) {
        return 'stop' as const;
      }
      if (shouldShowWaitingHint({ startedAt, now: Date.now() })) setShowHint(true);
      try {
        const rows = await listMcpConnections();
        setConnections(rows);
        const found = findNewConnection(baselineRef.current, rows, platformId);
        if (found) {
          setConnectedFlash(true);
          setTimeout(() => {
            closedRef.current = true;
            setWaiting(null);
            setConnectedFlash(false);
            setPickerOpen(false);
          }, 900);
          return 'stop' as const;
        }
      } catch {
        // Keep polling; transient failures are fine while the user finishes login.
      }
      if (
        shouldStopPolling({
          startedAt,
          now: Date.now(),
          closed: closedRef.current,
          found: false,
        })
      ) {
        return 'stop' as const;
      }
      return 'continue' as const;
    };

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loop = () => {
      void tick().then((result) => {
        if (cancelled || result === 'stop' || closedRef.current) return;
        timer = setTimeout(loop, POLL_INTERVAL_MS);
      });
    };
    timer = setTimeout(loop, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      closedRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [waiting]);

  async function onDisconnect(row: McpConnection) {
    const label = connectionLabel(row).name;
    const ok = await confirmAction(`Disconnect ${label}?`, 'That AI will lose access to your Kinexus account.');
    if (!ok) return;
    setError(null);
    try {
      await revokeMcpConnection(row.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect.');
    }
  }

  function onPick(platform: AiChatPlatform) {
    setError(null);
    if (platform.directoryUrl) {
      void Linking.openURL(platform.directoryUrl);
      setPickerOpen(false);
      return;
    }
    baselineRef.current = new Set(connections.map((row) => row.id));
    setWaiting(platform);
  }

  async function copyUrl() {
    await Clipboard.setStringAsync(mcpUrlForCopy());
    setCopiedToast(true);
  }

  async function copyGuide(platform: AiChatPlatform) {
    const text = buildAiChatSetupPrompt(platform, mcpUrlForCopy());
    await Clipboard.setStringAsync(text);
    setCopiedToast(true);
  }

  return (
    <Card>
      <Text style={styles.heading}>Connected AI chats</Text>
      <ErrorText message={error} />

      {connections.map((row) => {
        const label = connectionLabel(row);
        const relative = formatRelative(row.lastUsedAt);
        return (
          <View key={row.id} style={styles.row}>
            <View style={styles.icon}>
              <Text style={styles.iconLabel}>{label.icon}</Text>
            </View>
            <View style={styles.meta}>
              <Text style={styles.name}>{label.name}</Text>
              <Text style={styles.detail}>Connected {formatConnectedDate(row.createdAt)}</Text>
              {relative ? (
                <Text style={styles.detail}>
                  Last used {relative}
                  <Text style={styles.verified}> ✓</Text>
                </Text>
              ) : (
                <Text style={styles.detail}>Last used —</Text>
              )}
            </View>
            <Pressable onPress={() => void onDisconnect(row)} accessibilityRole="button">
              <Text style={styles.disconnect}>Disconnect</Text>
            </Pressable>
          </View>
        );
      })}

      {platforms.length > 0 ? <Btn label="Connect" onPress={() => setPickerOpen(true)} /> : null}

      <AppModal
        visible={pickerOpen && !waiting}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} accessibilityLabel="Close">
          <Pressable onPress={() => undefined} style={styles.sheet} accessibilityViewIsModal>
            <Text style={styles.sheetTitle}>Connect</Text>
            {platforms.map((platform) => {
              const already =
                Boolean(connectionForPlatform(connections, platform.id)) ||
                connections.some((row) => row.platform === platform.id);
              return (
                <Pressable
                  key={platform.id}
                  style={styles.platformRow}
                  onPress={() => onPick(platform)}
                  accessibilityRole="button">
                  <View style={styles.icon}>
                    <Text style={styles.iconLabel}>{platform.icon}</Text>
                  </View>
                  <Text style={styles.platformName}>{platform.name}</Text>
                  {already ? <Text style={styles.platformConnected}>Connected</Text> : null}
                </Pressable>
              );
            })}
            <Btn label="Cancel" variant="ghost" onPress={() => setPickerOpen(false)} />
          </Pressable>
        </Pressable>
      </AppModal>

      <AppModal
        visible={Boolean(waiting)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          closedRef.current = true;
          setWaiting(null);
        }}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            closedRef.current = true;
            setWaiting(null);
          }}
          accessibilityLabel="Close">
          <Pressable onPress={() => undefined} style={styles.sheet} accessibilityViewIsModal>
            {waiting ? (
              connectedFlash ? (
                <Text style={styles.connectedFlash}>Connected ✓</Text>
              ) : (
                <ConnectWizard
                  platform={waiting}
                  troubleOpen={troubleOpen}
                  onToggleTrouble={() => setTroubleOpen((v) => !v)}
                  showHint={showHint}
                  onCopyGuide={() => void copyGuide(waiting)}
                  onOpen={() => void openPlatform(waiting)}
                  onCopyUrl={() => void copyUrl()}
                />
              )
            ) : null}
          </Pressable>
        </Pressable>
      </AppModal>

      <Toast message="Copied" visible={copiedToast} durationMs={1200} onDismiss={() => setCopiedToast(false)} />
    </Card>
  );
}

function ConnectWizard({
  platform,
  troubleOpen,
  onToggleTrouble,
  showHint,
  onCopyGuide,
  onOpen,
  onCopyUrl,
}: {
  platform: AiChatPlatform;
  troubleOpen: boolean;
  onToggleTrouble: () => void;
  showHint: boolean;
  onCopyGuide: () => void;
  onOpen: () => void;
  onCopyUrl: () => void;
}) {
  const actions = connectWizardActions(platform);
  return (
    <View style={styles.wizard}>
      <Text style={styles.status}>Waiting for Connected…</Text>

      <View style={styles.actionBlock}>
        <Btn label={actions.copyGuide} onPress={onCopyGuide} />
        <Text style={styles.explainer}>{actions.explainer}</Text>
      </View>

      <Btn label={actions.open} variant="secondary" onPress={onOpen} />
      <Btn label={actions.copyUrl} variant="secondary" onPress={onCopyUrl} />

      <Pressable onPress={onToggleTrouble} accessibilityRole="button">
        <Text style={styles.tipsToggle}>{troubleOpen ? 'Having trouble? ▾' : 'Having trouble? ▸'}</Text>
      </Pressable>
      {troubleOpen
        ? platform.tips.map((tip) => (
            <Text key={tip} style={styles.tip}>
              {tip}
            </Text>
          ))
        : null}

      {showHint ? (
        <Pressable onPress={onCopyUrl} accessibilityRole="button">
          <Text style={styles.hint}>Still waiting… Copy URL again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 17, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { flex: 1, gap: 2, minWidth: 0 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  detail: { color: colors.textMuted, fontSize: 12 },
  verified: { color: colors.accent, fontWeight: '700' },
  disconnect: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.md,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '92%',
  },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  platformName: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  platformConnected: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  connectedFlash: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: space.md,
  },
  wizard: { gap: 12 },
  status: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  actionBlock: { gap: 6 },
  explainer: { color: colors.textMuted, fontSize: 13 },
  tipsToggle: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  tip: { color: colors.textMuted, fontSize: 13 },
});
