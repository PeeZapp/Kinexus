import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
  type ImageSourcePropType,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {
  CHATGPT_COPY_URL_LABEL,
  CHATGPT_OPEN_LABEL,
  CHATGPT_PLAN_NOTICE,
  CHATGPT_PRODUCTION_MCP_URL,
  CHATGPT_SETUP_STEPS,
  CHATGPT_TEST_PROMPT,
  CHATGPT_TIPS,
} from '@/src/features/connectors/chatgpt';
import {
  CLAUDE_COPY_URL_LABEL,
  CLAUDE_OPEN_LABEL,
  CLAUDE_PRODUCTION_MCP_URL,
  CLAUDE_SETUP_STEPS,
  CLAUDE_TEST_PROMPT,
  CLAUDE_TIPS,
  connectionForPlatform,
} from '@/src/features/connectors/claude';
import {
  listMcpConnections,
  revokeMcpConnection,
  type McpConnection,
} from '@/src/features/connectors/connections-api';
import { aiChatMcpUrl } from '@/src/features/connectors/mcp-url';
import {
  PERPLEXITY_COPY_URL_LABEL,
  PERPLEXITY_OPEN_LABEL,
  PERPLEXITY_PLAN_NOTICE,
  PERPLEXITY_PRODUCTION_MCP_URL,
  PERPLEXITY_SETUP_STEPS,
  PERPLEXITY_TEST_PROMPT,
  PERPLEXITY_TIPS,
} from '@/src/features/connectors/perplexity';
import {
  findNewConnection,
  POLL_INTERVAL_MS,
  shouldShowWaitingHint,
  shouldStopPolling,
} from '@/src/features/connectors/poll';
import {
  aiChatPlatformById,
  visibleAiChatPlatforms,
  type AiChatPlatform,
} from '@/src/features/connectors/platforms';
import { Btn, Card, ErrorText } from '@/src/features/household/ui';
import { AppModal } from '@/src/features/shell/AppModal';
import { colors, radius, space } from '@/src/features/shell/theme';
import { confirmAction } from '@/src/lib/confirm';

const FALLBACK_OPEN: Record<string, string> = {
  chatgpt: 'https://chatgpt.com/plugins',
  claude: 'https://claude.ai/customize/connectors',
  perplexity: 'https://www.perplexity.ai/computer/plugins',
};

const SETUP_PLACEHOLDER = require('../../../assets/images/icon.png') as ImageSourcePropType;

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

async function openPlatform(platform: AiChatPlatform): Promise<void> {
  const url = platform.deepLink || FALLBACK_OPEN[platform.id] || '';
  if (!url) return;
  await Linking.openURL(url);
}

function mcpUrlForPlatform(platform: AiChatPlatform): string {
  if (platform.id === 'chatgpt') return CHATGPT_PRODUCTION_MCP_URL;
  if (platform.id === 'claude') return CLAUDE_PRODUCTION_MCP_URL;
  if (platform.id === 'perplexity') return PERPLEXITY_PRODUCTION_MCP_URL;
  return aiChatMcpUrl();
}

function testPromptForPlatform(platformId: string): string {
  if (platformId === 'chatgpt') return CHATGPT_TEST_PROMPT;
  if (platformId === 'perplexity') return PERPLEXITY_TEST_PROMPT;
  return CLAUDE_TEST_PROMPT;
}

export function ConnectedAiChats() {
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [waiting, setWaiting] = useState<AiChatPlatform | null>(null);
  const [connectedFlash, setConnectedFlash] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const baselineRef = useRef<Set<string>>(new Set());
  const closedRef = useRef(false);

  const platforms = visibleAiChatPlatforms();
  const chatgptConnected = Boolean(connectionForPlatform(connections, 'chatgpt'));
  const claudeConnected = Boolean(connectionForPlatform(connections, 'claude'));
  const perplexityConnected = Boolean(connectionForPlatform(connections, 'perplexity'));

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
    setTipsOpen(false);
    setCopiedPrompt(false);
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

  async function onPick(platform: AiChatPlatform) {
    setError(null);
    if (platform.directoryUrl) {
      await Linking.openURL(platform.directoryUrl);
      setPickerOpen(false);
      return;
    }
    await Clipboard.setStringAsync(mcpUrlForPlatform(platform));
    baselineRef.current = new Set(connections.map((row) => row.id));
    setWaiting(platform);
  }

  async function copyUrl(platform: AiChatPlatform) {
    await Clipboard.setStringAsync(mcpUrlForPlatform(platform));
  }

  async function copyTestPrompt(platformId: string) {
    await Clipboard.setStringAsync(testPromptForPlatform(platformId));
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 1200);
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
                (platform.id === 'chatgpt' && chatgptConnected) ||
                (platform.id === 'claude' && claudeConnected) ||
                (platform.id === 'perplexity' && perplexityConnected) ||
                connections.some((row) => row.platform === platform.id);
              return (
                <Pressable
                  key={platform.id}
                  style={styles.platformRow}
                  onPress={() => void onPick(platform)}
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
              ) : waiting.id === 'chatgpt' ? (
                <ChatgptWizard
                  tipsOpen={tipsOpen}
                  onToggleTips={() => setTipsOpen((v) => !v)}
                  copiedPrompt={copiedPrompt}
                  showHint={showHint}
                  onCopyUrl={() => void copyUrl(waiting)}
                  onOpen={() => void openPlatform(waiting)}
                  onCopyPrompt={() => void copyTestPrompt('chatgpt')}
                />
              ) : waiting.id === 'claude' ? (
                <ClaudeWizard
                  tipsOpen={tipsOpen}
                  onToggleTips={() => setTipsOpen((v) => !v)}
                  copiedPrompt={copiedPrompt}
                  showHint={showHint}
                  onCopyUrl={() => void copyUrl(waiting)}
                  onOpen={() => void openPlatform(waiting)}
                  onCopyPrompt={() => void copyTestPrompt('claude')}
                />
              ) : waiting.id === 'perplexity' ? (
                <PerplexityWizard
                  tipsOpen={tipsOpen}
                  onToggleTips={() => setTipsOpen((v) => !v)}
                  copiedPrompt={copiedPrompt}
                  showHint={showHint}
                  onCopyUrl={() => void copyUrl(waiting)}
                  onOpen={() => void openPlatform(waiting)}
                  onCopyPrompt={() => void copyTestPrompt('perplexity')}
                />
              ) : (
                <>
                  <Image source={SETUP_PLACEHOLDER} style={styles.setupImage} resizeMode="contain" />
                  <Text style={styles.setupLine}>
                    Paste this in {waiting.name} → Add connector, then log in
                  </Text>
                  <Btn label={`Open ${waiting.name}`} onPress={() => void openPlatform(waiting)} />
                  {showHint ? (
                    <Pressable onPress={() => void copyUrl(waiting)} accessibilityRole="button">
                      <Text style={styles.hint}>Still waiting… Copy link again</Text>
                    </Pressable>
                  ) : null}
                </>
              )
            ) : null}
          </Pressable>
        </Pressable>
      </AppModal>
    </Card>
  );
}

function ChatgptWizard({
  tipsOpen,
  onToggleTips,
  copiedPrompt,
  showHint,
  onCopyUrl,
  onOpen,
  onCopyPrompt,
}: {
  tipsOpen: boolean;
  onToggleTips: () => void;
  copiedPrompt: boolean;
  showHint: boolean;
  onCopyUrl: () => void;
  onOpen: () => void;
  onCopyPrompt: () => void;
}) {
  return (
    <View style={styles.wizard}>
      <Text style={styles.planNotice}>{CHATGPT_PLAN_NOTICE}</Text>
      <View style={styles.actions}>
        <Btn label={CHATGPT_COPY_URL_LABEL} variant="secondary" onPress={onCopyUrl} />
        <Btn label={CHATGPT_OPEN_LABEL} onPress={onOpen} />
      </View>

      {CHATGPT_SETUP_STEPS.map((step) => (
        <View key={step.n} style={styles.stepRow}>
          {/* PLACEHOLDER: replace with real ChatGPT Plugins screenshots after deploy */}
          <Image source={SETUP_PLACEHOLDER} style={styles.stepImage} resizeMode="contain" accessibilityLabel={`Step ${step.n} screenshot placeholder`} />
          <View style={styles.stepMeta}>
            <Text style={styles.stepTitle}>
              {step.n}. {step.title}
            </Text>
            <Text style={styles.stepDetail}>{step.detail}</Text>
          </View>
        </View>
      ))}

      <Pressable onPress={onToggleTips} accessibilityRole="button">
        <Text style={styles.tipsToggle}>{tipsOpen ? 'Tips ▾' : 'Tips ▸'}</Text>
      </Pressable>
      {tipsOpen
        ? CHATGPT_TIPS.map((tip) => (
            <Text key={tip} style={styles.tip}>
              {tip}
            </Text>
          ))
        : null}

      <View style={styles.testBlock}>
        <Text style={styles.testHeading}>Test it</Text>
        <Text style={styles.testPrompt}>{CHATGPT_TEST_PROMPT}</Text>
        <Btn label={copiedPrompt ? 'Copied' : 'Copy'} variant="secondary" onPress={onCopyPrompt} />
      </View>

      {showHint ? (
        <Pressable onPress={onCopyUrl} accessibilityRole="button">
          <Text style={styles.hint}>Still waiting… Copy URL again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ClaudeWizard({
  tipsOpen,
  onToggleTips,
  copiedPrompt,
  showHint,
  onCopyUrl,
  onOpen,
  onCopyPrompt,
}: {
  tipsOpen: boolean;
  onToggleTips: () => void;
  copiedPrompt: boolean;
  showHint: boolean;
  onCopyUrl: () => void;
  onOpen: () => void;
  onCopyPrompt: () => void;
}) {
  return (
    <View style={styles.wizard}>
      <View style={styles.actions}>
        <Btn label={CLAUDE_COPY_URL_LABEL} variant="secondary" onPress={onCopyUrl} />
        <Btn label={CLAUDE_OPEN_LABEL} onPress={onOpen} />
      </View>

      {CLAUDE_SETUP_STEPS.map((step) => (
        <View key={step.n} style={styles.stepRow}>
          {/* PLACEHOLDER: replace with real Claude UI screenshots after deploy */}
          <Image source={SETUP_PLACEHOLDER} style={styles.stepImage} resizeMode="contain" accessibilityLabel={`Step ${step.n} screenshot placeholder`} />
          <View style={styles.stepMeta}>
            <Text style={styles.stepTitle}>
              {step.n}. {step.title}
            </Text>
            <Text style={styles.stepDetail}>{step.detail}</Text>
          </View>
        </View>
      ))}

      <Pressable onPress={onToggleTips} accessibilityRole="button">
        <Text style={styles.tipsToggle}>{tipsOpen ? 'Tips ▾' : 'Tips ▸'}</Text>
      </Pressable>
      {tipsOpen
        ? CLAUDE_TIPS.map((tip) => (
            <Text key={tip} style={styles.tip}>
              {tip}
            </Text>
          ))
        : null}

      <View style={styles.testBlock}>
        <Text style={styles.testHeading}>Test it</Text>
        <Text style={styles.testPrompt}>{CLAUDE_TEST_PROMPT}</Text>
        <Btn label={copiedPrompt ? 'Copied' : 'Copy'} variant="secondary" onPress={onCopyPrompt} />
      </View>

      {showHint ? (
        <Pressable onPress={onCopyUrl} accessibilityRole="button">
          <Text style={styles.hint}>Still waiting… Copy URL again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PerplexityWizard({
  tipsOpen,
  onToggleTips,
  copiedPrompt,
  showHint,
  onCopyUrl,
  onOpen,
  onCopyPrompt,
}: {
  tipsOpen: boolean;
  onToggleTips: () => void;
  copiedPrompt: boolean;
  showHint: boolean;
  onCopyUrl: () => void;
  onOpen: () => void;
  onCopyPrompt: () => void;
}) {
  return (
    <View style={styles.wizard}>
      <Text style={styles.planNotice}>{PERPLEXITY_PLAN_NOTICE}</Text>
      <View style={styles.actions}>
        <Btn label={PERPLEXITY_COPY_URL_LABEL} variant="secondary" onPress={onCopyUrl} />
        <Btn label={PERPLEXITY_OPEN_LABEL} onPress={onOpen} />
      </View>

      {PERPLEXITY_SETUP_STEPS.map((step) => (
        <View key={step.n} style={styles.stepRow}>
          {/* PLACEHOLDER: replace with real Perplexity Plugins screenshots after deploy */}
          <Image source={SETUP_PLACEHOLDER} style={styles.stepImage} resizeMode="contain" accessibilityLabel={`Step ${step.n} screenshot placeholder`} />
          <View style={styles.stepMeta}>
            <Text style={styles.stepTitle}>
              {step.n}. {step.title}
            </Text>
            <Text style={styles.stepDetail}>{step.detail}</Text>
          </View>
        </View>
      ))}

      <Pressable onPress={onToggleTips} accessibilityRole="button">
        <Text style={styles.tipsToggle}>{tipsOpen ? 'Tips ▾' : 'Tips ▸'}</Text>
      </Pressable>
      {tipsOpen
        ? PERPLEXITY_TIPS.map((tip) => (
            <Text key={tip} style={styles.tip}>
              {tip}
            </Text>
          ))
        : null}

      <View style={styles.testBlock}>
        <Text style={styles.testHeading}>Test it</Text>
        <Text style={styles.testPrompt}>{PERPLEXITY_TEST_PROMPT}</Text>
        <Btn label={copiedPrompt ? 'Copied' : 'Copy'} variant="secondary" onPress={onCopyPrompt} />
      </View>

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
  setupImage: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
  },
  setupLine: { color: colors.text, fontSize: 15, textAlign: 'center' },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  connectedFlash: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: space.md,
  },
  wizard: { gap: 12 },
  planNotice: { color: colors.text, fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  stepImage: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepMeta: { flex: 1, gap: 2, minWidth: 0 },
  stepTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  stepDetail: { color: colors.textMuted, fontSize: 13 },
  tipsToggle: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  tip: { color: colors.textMuted, fontSize: 13 },
  testBlock: { gap: 8, paddingTop: 4 },
  testHeading: { color: colors.text, fontSize: 14, fontWeight: '700' },
  testPrompt: { color: colors.text, fontSize: 14 },
});
