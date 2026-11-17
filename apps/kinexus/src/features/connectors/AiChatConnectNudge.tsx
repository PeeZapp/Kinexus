import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AI_CHAT_CAPABILITY_BULLETS,
  AI_CHAT_PLAN_INFO,
  AI_CHAT_TIPS_DISMISSED_QUERY_KEY,
  MCP_CONNECTIONS_QUERY_KEY,
  aiChatNudgeCopy,
  loadAiChatTipsDismissed,
  setAiChatTipsDismissed,
  type AiChatNudgeSection,
} from '@/src/features/connectors/ai-chat-nudge';
import { listMcpConnections } from '@/src/features/connectors/connections-api';
import { AppModal } from '@/src/features/shell/AppModal';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';

export function AiChatConnectNudge({ section }: { section: AiChatNudgeSection }) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [infoOpen, setInfoOpen] = useState(false);

  const connections = useQuery({
    queryKey: MCP_CONNECTIONS_QUERY_KEY,
    queryFn: listMcpConnections,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    retry: false,
  });

  const dismissed = useQuery({
    queryKey: [...AI_CHAT_TIPS_DISMISSED_QUERY_KEY, user?.id],
    queryFn: () => loadAiChatTipsDismissed(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const hasConnection = (connections.data?.length ?? 0) > 0;
  if (!user?.id || connections.isLoading || dismissed.isLoading) return null;
  if (connections.isError) return null;
  if (hasConnection || dismissed.data) return null;

  async function onDismiss() {
    await setAiChatTipsDismissed(user!.id, true);
    await queryClient.invalidateQueries({ queryKey: [...AI_CHAT_TIPS_DISMISSED_QUERY_KEY, user!.id] });
  }

  return (
    <>
      <View style={styles.banner}>
        <Text style={styles.text}>{aiChatNudgeCopy(section)}</Text>
        <View style={styles.actions}>
          <Pressable onPress={() => router.push('/settings/connections' as Href)} hitSlop={8}>
            <Text style={styles.action}>Connect</Text>
          </Pressable>
          <Pressable onPress={() => setInfoOpen(true)} hitSlop={8}>
            <Text style={styles.action}>More info</Text>
          </Pressable>
          <Pressable onPress={() => void onDismiss()} hitSlop={8}>
            <Text style={styles.dismiss}>Don't show</Text>
          </Pressable>
        </View>
      </View>
      <AiChatConnectInfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
}

export function AiChatConnectInfoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const free = AI_CHAT_PLAN_INFO.filter((row) => row.tier === 'free');
  const paid = AI_CHAT_PLAN_INFO.filter((row) => row.tier === 'paid');

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable onPress={() => undefined} style={styles.sheet} accessibilityViewIsModal>
          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetBody}>
            <Text style={styles.sheetTitle}>AI chat connectors</Text>
            <Text style={styles.sheetLead}>
              Link ChatGPT, Claude, Perplexity, or Grok so you can ask them about your household in Kinexus.
            </Text>

            <Text style={styles.sectionLabel}>What you can do</Text>
            {AI_CHAT_CAPABILITY_BULLETS.map((line) => (
              <Text key={line} style={styles.bullet}>
                • {line}
              </Text>
            ))}

            <Text style={styles.sectionLabel}>Free tier</Text>
            {free.map((row) => (
              <Text key={row.id} style={styles.bullet}>
                • {row.name} — {row.detail}
              </Text>
            ))}

            <Text style={styles.sectionLabel}>Needs a paid plan</Text>
            {paid.map((row) => (
              <Text key={row.id} style={styles.bullet}>
                • {row.name} — {row.detail}
              </Text>
            ))}

            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => {
                  onClose();
                  router.push('/settings/connections' as Href);
                }}
                hitSlop={8}>
                <Text style={styles.action}>Connect</Text>
              </Pressable>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.dismiss}>Close</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

/** Settings control when tips were turned off. */
export function AiChatTipsRestoreRow() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const dismissed = useQuery({
    queryKey: [...AI_CHAT_TIPS_DISMISSED_QUERY_KEY, user?.id],
    queryFn: () => loadAiChatTipsDismissed(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  if (!user?.id || !dismissed.data) return null;

  async function onRestore() {
    await setAiChatTipsDismissed(user!.id, false);
    await queryClient.invalidateQueries({ queryKey: [...AI_CHAT_TIPS_DISMISSED_QUERY_KEY, user!.id] });
  }

  return (
    <Pressable onPress={() => void onRestore()} hitSlop={8}>
      <Text style={styles.dismiss}>Show connect tips again</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: space.md,
    marginTop: space.sm,
    marginBottom: space.xs,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  text: { color: colors.text, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  action: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  dismiss: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: space.lg,
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  sheetScroll: { maxHeight: '100%' },
  sheetBody: { padding: space.lg, gap: 8 },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  sheetLead: { color: colors.textDim, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  bullet: { color: colors.text, fontSize: 14, lineHeight: 20 },
  sheetActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
    marginTop: 12,
  },
});
