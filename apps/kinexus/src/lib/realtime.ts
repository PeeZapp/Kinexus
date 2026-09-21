import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

type LiveChannel = {
  count: number;
  channel: RealtimeChannel;
};

const live = new Map<string, LiveChannel>();

function topicName(channel: RealtimeChannel): string {
  return channel.topic.startsWith('realtime:') ? channel.topic.slice('realtime:'.length) : channel.topic;
}

function isSubscribed(channel: RealtimeChannel): boolean {
  const state = String((channel as { state?: string }).state ?? '');
  return state === 'joined' || state === 'joining' || state === 'leaving';
}

/**
 * Share one Realtime channel per topic. Adding `.on()` after `.subscribe()` throws
 * (React Strict Mode remounts and stacked screens both call the same hook).
 */
export function retainPostgresChannel(
  client: SupabaseClient,
  topic: string,
  bind: (channel: RealtimeChannel) => RealtimeChannel,
): () => void {
  const existing = live.get(topic);
  if (existing) {
    existing.count += 1;
    return () => releaseChannel(client, topic);
  }

  const leftover = client.getChannels().find((channel) => topicName(channel) === topic);
  if (leftover && isSubscribed(leftover)) {
    live.set(topic, { count: 1, channel: leftover });
    return () => releaseChannel(client, topic);
  }

  const name = leftover ? `${topic}:${Date.now().toString(36)}` : topic;
  const channel = bind(client.channel(name)).subscribe();
  live.set(topic, { count: 1, channel });
  return () => releaseChannel(client, topic);
}

function releaseChannel(client: SupabaseClient, topic: string): void {
  const entry = live.get(topic);
  if (!entry) return;
  entry.count -= 1;
  if (entry.count > 0) return;
  live.delete(topic);
  void client.removeChannel(entry.channel);
}
